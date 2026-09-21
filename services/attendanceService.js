const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');
const User = require('../models/User');
const AttendancePunch = require('../models/AttendancePunch');
const AttendanceDaily = require('../models/AttendanceDaily');
const LateMonthlySummary = require('../models/LateMonthlySummary');

/**
 * Normalizes any Date or Date string to midnight UTC (00:00:00.000Z)
 * @param {Date|string} dateInput 
 * @returns {Date}
 */
const normalizeDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Calculates distance in meters between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === null || lat1 === undefined || isNaN(lat1) ||
    lon1 === null || lon1 === undefined || isNaN(lon1) ||
    lat2 === null || lat2 === undefined || isNaN(lat2) ||
    lon2 === null || lon2 === undefined || isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371e3; // Earth radius in meters
  const φ1 = (Number(lat1) * Math.PI) / 180;
  const φ2 = (Number(lat2) * Math.PI) / 180;
  const Δφ = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const Δλ = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Gets hours and minutes in a target timezone from a UTC Date
 */
const getTimeInTimezone = (dateUtc, timezone = 'Asia/Kolkata') => {
  try {
    const d = new Date(dateUtc);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(d);
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return { hour, minute, totalMinutes: hour * 60 + minute };
  } catch (err) {
    // Fallback if timezone string is invalid
    const d = new Date(dateUtc);
    const hour = d.getUTCHours();
    const minute = d.getUTCMinutes();
    return { hour, minute, totalMinutes: hour * 60 + minute };
  }
};

/**
 * Evaluates whether a punch-in is On Time or Late based on Shift start_time and grace_in_min
 * @param {Date} punchTimeUtc - Punch UTC timestamp
 * @param {Object} shift - Shift document
 * @param {string} timezone - Branch timezone
 * @returns {boolean} isLate
 */
const evaluateLateMark = (punchTimeUtc, shift, timezone = 'Asia/Kolkata') => {
  if (!shift) return false;

  const { totalMinutes: punchMinutes } = getTimeInTimezone(punchTimeUtc, timezone);

  const [startHour, startMin] = (shift.start_time || '10:00').split(':').map(Number);
  const shiftStartMinutes = startHour * 60 + startMin;
  const graceLimitMinutes = shiftStartMinutes + (shift.grace_in_min || 10);

  // If punch is after grace limit (e.g. 10:11 AM when limit is 10:10 AM), mark as Late
  return punchMinutes > graceLimitMinutes;
};

/**
 * Recalculates Late Monthly Summary for a user in a specific year and month
 * @param {string|ObjectId} userId 
 * @param {number} year 
 * @param {number} month (1-12)
 * @returns {Promise<Object>} Updated LateMonthlySummary
 */
const recalculateLateStatus = async (userId, year, month) => {
  const user = await User.findById(userId).populate('shift_id');
  if (!user || user.attendance_exempt) return null;

  // Get user's shift settings
  let shift = user.shift_id;
  if (!shift) {
    shift = await Shift.findOne({ status: 'Active' });
  }

  const allowed = shift?.monthly_late_allowed ?? 3;
  const lateAction = shift?.late_action || 'DEDUCT';
  const lateDeductDays = shift?.late_deduct_days ?? 0.5;

  // Date range for the month in UTC
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Count all days where is_late === true
  const lateDaysCount = await AttendanceDaily.countDocuments({
    user_id: userId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
    is_late: true
  });

  const extraLates = Math.max(0, lateDaysCount - allowed);
  const deductionDays = lateAction === 'DEDUCT' ? extraLates * lateDeductDays : 0;

  const summary = await LateMonthlySummary.findOneAndUpdate(
    { user_id: userId, year, month },
    {
      $set: {
        late_count: lateDaysCount,
        allowed,
        extra_lates: extraLates,
        deduction_days: deductionDays
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return summary;
};

/**
 * End-of-Day Reconciliation Job: Sets daily status for all active non-exempt employees
 * Precedence: Holiday/Week-Off > Approved Leave > Punch Hours (Present / Half Day / Late) > Absent
 * @param {Date|string} targetDateInput 
 */
const runDailyStatusJob = async (targetDateInput = new Date()) => {
  const targetDate = normalizeDate(targetDateInput);
  const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  console.log(`⏱️ Running End-of-Day Attendance Reconciliation for Date: ${targetDate.toISOString().split('T')[0]}`);

  // Fetch all active, non-exempt employees
  const users = await User.find({ status: 'Active', attendance_exempt: false })
    .populate('shift_id')
    .populate('branch_id');

  const defaultShift = await Shift.findOne({ status: 'Active' });

  // Fetch holidays on this date
  const holidays = await Holiday.find({
    date: { $gte: targetDate, $lt: nextDay },
    status: 'Active'
  });

  let processedCount = 0;

  for (const user of users) {
    const shift = user.shift_id || defaultShift;
    const branch = user.branch_id;
    const timezone = branch?.timezone || 'Asia/Kolkata';

    // Check if record is already regularized by Module 3 (preserve regularized state)
    let daily = await AttendanceDaily.findOne({ user_id: user._id, date: targetDate });

    if (daily && daily.is_regularized) {
      continue;
    }

    // 1. Precedence: Check Holiday / Weekly Off for this branch or global
    const holidayMatch = holidays.find(
      h => !h.branch_id || (branch && h.branch_id.toString() === branch._id.toString())
    );

    if (holidayMatch) {
      const holidayStatus = holidayMatch.type === 'WEEKLY_OFF' ? 'Week Off' : 'Holiday';
      await AttendanceDaily.findOneAndUpdate(
        { user_id: user._id, date: targetDate },
        {
          $set: {
            status: holidayStatus,
            remarks: holidayMatch.name
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      processedCount++;
      continue;
    }

    // 2. Precedence: Module 4 Leave Hook
    const hasApprovedLeave = await isOnApprovedLeave(user._id, targetDate);
    if (hasApprovedLeave) {
      await AttendanceDaily.findOneAndUpdate(
        { user_id: user._id, date: targetDate },
        { $set: { status: 'Leave' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      processedCount++;
      continue;
    }

    // 3. Precedence: Check Punches on this day
    const punches = await AttendancePunch.find({
      user_id: user._id,
      time_utc: { $gte: targetDate, $lt: nextDay }
    }).sort({ time_utc: 1 });

    if (!punches || punches.length === 0) {
      // No punches on working day -> Absent
      await AttendanceDaily.findOneAndUpdate(
        { user_id: user._id, date: targetDate },
        {
          $set: {
            first_in: null,
            last_out: null,
            work_minutes: 0,
            status: 'Absent',
            is_late: false
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      const inPunches = punches.filter(p => p.type === 'IN');
      const outPunches = punches.filter(p => p.type === 'OUT');

      const firstIn = inPunches.length > 0 ? inPunches[0].time_utc : punches[0].time_utc;
      const lastOut = outPunches.length > 0 ? outPunches[outPunches.length - 1].time_utc : null;

      let workMinutes = 0;
      let status = 'Incomplete';

      const isLate = evaluateLateMark(firstIn, shift, timezone);

      if (firstIn && lastOut) {
        workMinutes = Math.max(0, Math.floor((new Date(lastOut) - new Date(firstIn)) / (1000 * 60)));

        const fullDayMins = (shift?.full_day_hrs || 8) * 60;
        const halfDayMins = (shift?.half_day_hrs || 4) * 60;

        if (workMinutes >= fullDayMins) {
          status = isLate ? 'Late' : 'Present';
        } else if (workMinutes >= halfDayMins) {
          status = 'Half Day';
        } else {
          status = 'Absent';
        }
      } else {
        // Missed clock out -> Incomplete
        status = 'Incomplete';
      }

      await AttendanceDaily.findOneAndUpdate(
        { user_id: user._id, date: targetDate },
        {
          $set: {
            first_in: firstIn,
            last_out: lastOut,
            work_minutes: workMinutes,
            status,
            is_late: isLate
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Trigger late counter update for this month
      const punchYear = targetDate.getUTCFullYear();
      const punchMonth = targetDate.getUTCMonth() + 1;
      await recalculateLateStatus(user._id, punchYear, punchMonth);
    }

    processedCount++;
  }

  console.log(`✅ Daily Status Job completed. Processed ${processedCount} employees.`);
  return { date: targetDate, processedCount };
};

/**
 * Module 4 Leave Hook: Checks if employee has an Approved leave on this date
 * @param {ObjectId} userId 
 * @param {Date} dateInput 
 * @returns {Promise<boolean>}
 */
const isOnApprovedLeave = async (userId, dateInput) => {
  try {
    const LeaveRequest = require('../models/LeaveRequest');
    const targetDate = normalizeDate(dateInput);
    const exists = await LeaveRequest.exists({
      user_id: userId,
      status: 'Approved',
      from_date: { $lte: targetDate },
      to_date: { $gte: targetDate },
      day_part: { $ne: 'SHORT' }
    });
    return Boolean(exists);
  } catch (err) {
    console.error('Error checking approved leave status:', err);
    return false;
  }
};

/**
 * Module 4 Short Leave Hook: Covers late mark and creates Short Leave exception
 * @param {ObjectId} userId 
 * @param {Date} dateInput 
 * @param {string} fromTime 
 * @param {string} toTime 
 */
const markShortLeaveCover = async (userId, dateInput, fromTime, toTime) => {
  try {
    const targetDate = normalizeDate(dateInput);
    await AttendanceDaily.findOneAndUpdate(
      { user_id: userId, date: targetDate },
      {
        $set: {
          is_late: false,
          remarks: `Covered by Short Leave (${fromTime || ''} - ${toTime || ''})`
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return true;
  } catch (err) {
    console.error('Error applying short leave cover:', err);
    return false;
  }
};

module.exports = {
  normalizeDate,
  calculateDistance,
  getTimeInTimezone,
  evaluateLateMark,
  recalculateLateStatus,
  runDailyStatusJob,
  isOnApprovedLeave,
  markShortLeaveCover
};
