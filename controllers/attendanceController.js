const AttendancePunch = require('../models/AttendancePunch');
const AttendanceDaily = require('../models/AttendanceDaily');
const LateMonthlySummary = require('../models/LateMonthlySummary');
const Shift = require('../models/Shift');
const Branch = require('../models/Branch');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate } = require('../utils/dateUtils');
const {
  normalizeDate,
  calculateDistance,
  evaluateLateMark,
  recalculateLateStatus,
  runDailyStatusJob
} = require('../services/attendanceService');

/**
 * @desc    Clock In (Employee, CEO, CTO - NOT Super Admin)
 * @route   POST /api/attendance/clock-in
 * @access  Private (Non-exempt users)
 */
const clockIn = async (req, res, next) => {
  try {
    const user = req.user;

    // Rule: Super Admin is exempt and blocked from clock in/out
    if (user.attendance_exempt === true) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin is exempt from attendance tracking and cannot clock in'
      });
    }

    const { lat, lng, source = 'WEB', device_info } = req.body;
    const now = new Date();
    const today = normalizeDate(now);

    // Fetch user branch & shift details
    const branchId = user.branch_id?._id || user.branch_id;
    const branch = (user.branch_id && user.branch_id.latitude !== undefined) 
      ? user.branch_id 
      : (branchId ? await Branch.findById(branchId) : null);

    const shiftId = user.shift_id?._id || user.shift_id;
    const shift = (user.shift_id && user.shift_id.start_time) 
      ? user.shift_id 
      : (shiftId ? await Shift.findById(shiftId) : await Shift.findOne({ status: 'Active' }));

    const timezone = branch?.timezone || 'Asia/Kolkata';

    // Geo-fence validation if branch has geofencing configured
    if (branch && branch.latitude != null && branch.longitude != null && branch.radius_m) {
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({
          success: false,
          message: `Location coordinates (lat, lng) are required for branch [${branch.name}]`
        });
      }

      const distance = calculateDistance(Number(lat), Number(lng), branch.latitude, branch.longitude);
      if (distance > branch.radius_m) {
        return res.status(400).json({
          success: false,
          message: `Clock-in rejected: You are ${Math.round(distance)}m away from branch [${branch.name}] (Max allowed: ${branch.radius_m}m)`
        });
      }
    }

    // 1. Record append-only raw punch
    const punch = await AttendancePunch.create({
      user_id: user._id,
      time_utc: now,
      type: 'IN',
      source,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      device_info: device_info || null
    });

    // 2. Evaluate Late Mark
    const isLate = evaluateLateMark(now, shift, timezone);

    // 3. Upsert today's AttendanceDaily
    let daily = await AttendanceDaily.findOne({ user_id: user._id, date: today });
    if (!daily) {
      daily = await AttendanceDaily.create({
        user_id: user._id,
        date: today,
        first_in: now,
        last_out: null,
        work_minutes: 0,
        status: isLate ? 'Late' : 'Present',
        is_late: isLate
      });
    } else {
      // Keep earliest first_in if multiple IN punches
      if (!daily.first_in) {
        daily.first_in = now;
        daily.is_late = isLate;
        daily.status = isLate ? 'Late' : 'Present';
        await daily.save();
      }
    }

    // 4. Update rolling late counter
    const punchYear = today.getUTCFullYear();
    const punchMonth = today.getUTCMonth() + 1;
    const lateSummary = await recalculateLateStatus(user._id, punchYear, punchMonth);

    res.status(200).json({
      success: true,
      message: isLate ? 'Clock-in recorded (Late Mark Applied)' : 'Clock-in recorded successfully (On Time)',
      is_late: isLate,
      punch,
      daily,
      late_summary: lateSummary
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Clock Out (Employee, CEO, CTO)
 * @route   POST /api/attendance/clock-out
 * @access  Private (Non-exempt users)
 */
const clockOut = async (req, res, next) => {
  try {
    const user = req.user;

    if (user.attendance_exempt === true) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin is exempt from attendance tracking and cannot clock out'
      });
    }

    const { lat, lng, source = 'WEB', device_info } = req.body;
    const now = new Date();
    const today = normalizeDate(now);

    const branchId = user.branch_id?._id || user.branch_id;
    const branch = (user.branch_id && user.branch_id.latitude !== undefined) 
      ? user.branch_id 
      : (branchId ? await Branch.findById(branchId) : null);

    const shiftId = user.shift_id?._id || user.shift_id;
    const shift = (user.shift_id && user.shift_id.start_time) 
      ? user.shift_id 
      : (shiftId ? await Shift.findById(shiftId) : await Shift.findOne({ status: 'Active' }));

    // Geo-fence validation
    if (branch && branch.latitude != null && branch.longitude != null && branch.radius_m) {
      if (lat !== undefined && lng !== undefined) {
        const distance = calculateDistance(Number(lat), Number(lng), branch.latitude, branch.longitude);
        if (distance > branch.radius_m) {
          return res.status(400).json({
            success: false,
            message: `Clock-out rejected: You are ${Math.round(distance)}m away from branch [${branch.name}]`
          });
        }
      }
    }

    // 1. Record raw punch
    const punch = await AttendancePunch.create({
      user_id: user._id,
      time_utc: now,
      type: 'OUT',
      source,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      device_info: device_info || null
    });

    // 2. Update today's AttendanceDaily
    let daily = await AttendanceDaily.findOne({ user_id: user._id, date: today });
    if (!daily) {
      daily = await AttendanceDaily.create({
        user_id: user._id,
        date: today,
        first_in: now,
        last_out: now,
        work_minutes: 0,
        status: 'Incomplete'
      });
    } else {
      daily.last_out = now;
      if (daily.first_in) {
        const workMinutes = Math.max(0, Math.floor((new Date(now) - new Date(daily.first_in)) / (1000 * 60)));
        daily.work_minutes = workMinutes;

        const fullDayMins = (shift?.full_day_hrs || 8) * 60;
        const halfDayMins = (shift?.half_day_hrs || 4) * 60;

        if (workMinutes >= fullDayMins) {
          daily.status = daily.is_late ? 'Late' : 'Present';
        } else if (workMinutes >= halfDayMins) {
          daily.status = 'Half Day';
        } else {
          daily.status = 'Absent';
        }
      }
      await daily.save();
    }

    res.status(200).json({
      success: true,
      message: 'Clock-out recorded successfully',
      punch,
      daily
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Daily Attendance Records (Scope enforced: ALL / DEPT / OWN)
 * @route   GET /api/attendance
 * @access  Private
 */
const getAttendance = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    const filter = {};

    if (scope === 'OWN') {
      filter.user_id = req.user._id;
      // If employee requested another user's attendance, fail loud with 403
      if (req.query.user_id && req.query.user_id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot view attendance records of other employees'
        });
      }
    } else if (scope === 'DEPT') {
      const deptUsers = await User.find({ department_id: req.user.department_id }).select('_id');
      const deptUserIds = deptUsers.map(u => u._id);
      if (req.query.user_id) {
        if (!deptUserIds.some(id => id.toString() === req.query.user_id)) {
          return res.status(403).json({
            success: false,
            message: 'Access Denied: User is not in your department'
          });
        }
        filter.user_id = req.query.user_id;
      } else {
        filter.user_id = { $in: deptUserIds };
      }
    } else {
      // Scope === 'ALL'
      if (req.query.user_id) filter.user_id = req.query.user_id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = normalizeDate(parseDate(req.query.from));
      if (req.query.to) filter.date.$lte = normalizeDate(parseDate(req.query.to));
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 31));
    const skip = (page - 1) * limit;

    const total = await AttendanceDaily.countDocuments(filter);
    const records = await AttendanceDaily.find(filter)
      .populate('user_id', 'employee_code name email department_id designation_id branch_id')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: records
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Rolling Late Summary for User
 * @route   GET /api/attendance/late-summary
 * @access  Private (Scope enforced)
 */
const getLateSummary = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    let targetUserId = req.user._id;

    if (req.query.user_id) {
      if (scope === 'OWN' && req.query.user_id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot view late summaries of other employees'
        });
      }
      targetUserId = req.query.user_id;
    }

    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
    const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

    // Recalculate to ensure absolute fresh accuracy
    const summary = await recalculateLateStatus(targetUserId, year, month);

    res.status(200).json({
      success: true,
      year,
      month,
      data: summary || {
        user_id: targetUserId,
        year,
        month,
        late_count: 0,
        allowed: 3,
        extra_lates: 0,
        deduction_days: 0
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Export Attendance Report (Super Admin, CEO, CTO only)
 * @route   GET /api/attendance/export
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const exportAttendance = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = normalizeDate(parseDate(req.query.from));
      if (req.query.to) filter.date.$lte = normalizeDate(parseDate(req.query.to));
    }

    if (req.query.branch_id) {
      const branchUsers = await User.find({ branch_id: req.query.branch_id }).select('_id');
      filter.user_id = { $in: branchUsers.map(u => u._id) };
    }

    const records = await AttendanceDaily.find(filter)
      .populate('user_id', 'employee_code name email department_id designation_id')
      .sort({ date: -1 });

    const format = req.query.format || 'json';

    if (format === 'csv') {
      const header = 'Employee Code,Name,Email,Date,Status,First In,Last Out,Work Minutes,Is Late,Is Regularized\n';
      const rows = records.map(r => {
        const u = r.user_id || {};
        const dateStr = formatDate(r.date);
        const firstInStr = r.first_in ? new Date(r.first_in).toISOString() : '';
        const lastOutStr = r.last_out ? new Date(r.last_out).toISOString() : '';
        return `"${u.employee_code || ''}","${u.name || ''}","${u.email || ''}","${dateStr}","${r.status}","${firstInStr}","${lastOutStr}",${r.work_minutes},${r.is_late},${r.is_regularized}`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_export_${Date.now()}.csv`);
      return res.status(200).send(header + rows);
    }

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Manual Edit Attendance (Super Admin only)
 * @route   PUT /api/attendance/:userId/:date
 * @access  Private (SUPER_ADMIN only)
 */
const manualEditAttendance = async (req, res, next) => {
  try {
    const { userId, date } = req.params;
    const { first_in, last_out, status, is_late, remarks } = req.body;

    const normalizedDate = normalizeDate(parseDate(date));

    let daily = await AttendanceDaily.findOne({ user_id: userId, date: normalizedDate });
    const oldVal = daily ? daily.toObject() : null;

    let workMinutes = daily ? daily.work_minutes : 0;
    const parsedFirstIn = first_in ? new Date(first_in) : (daily ? daily.first_in : null);
    const parsedLastOut = last_out ? new Date(last_out) : (daily ? daily.last_out : null);

    if (parsedFirstIn && parsedLastOut) {
      workMinutes = Math.max(0, Math.floor((parsedLastOut - parsedFirstIn) / (1000 * 60)));
    }

    daily = await AttendanceDaily.findOneAndUpdate(
      { user_id: userId, date: normalizedDate },
      {
        $set: {
          first_in: parsedFirstIn,
          last_out: parsedLastOut,
          work_minutes: workMinutes,
          status: status || (daily ? daily.status : 'Present'),
          is_late: is_late !== undefined ? Boolean(is_late) : (daily ? daily.is_late : false),
          remarks: remarks !== undefined ? remarks : (daily ? daily.remarks : 'Manual Admin Override')
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Recalculate rolling late summary for the month
    const year = normalizedDate.getUTCFullYear();
    const month = normalizedDate.getUTCMonth() + 1;
    const updatedSummary = await recalculateLateStatus(userId, year, month);

    await AuditLog.record(
      req.user._id,
      'ATTENDANCE',
      'MANUAL_OVERRIDE',
      oldVal,
      { daily, updatedSummary },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Attendance record updated and late summary recalculated',
      data: daily,
      late_summary: updatedSummary
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Trigger End-of-Day Reconciliation Job (Super Admin / Cron)
 * @route   POST /api/attendance/run-daily-job
 * @access  Private (SUPER_ADMIN only)
 */
const triggerDailyJob = async (req, res, next) => {
  try {
    const { date } = req.body;
    const targetDate = date ? parseDate(date) : new Date();

    const result = await runDailyStatusJob(targetDate);

    await AuditLog.record(
      req.user._id,
      'ATTENDANCE',
      'RUN_DAILY_JOB',
      null,
      result,
      req
    );

    res.status(200).json({
      success: true,
      message: `Daily status reconciliation job executed for date: ${result.date.toISOString().split('T')[0]}`,
      result
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  clockIn,
  clockOut,
  getAttendance,
  getLateSummary,
  exportAttendance,
  manualEditAttendance,
  triggerDailyJob
};
