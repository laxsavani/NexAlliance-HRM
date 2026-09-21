const RegularizationRequest = require('../models/RegularizationRequest');
const RegularizationReason = require('../models/RegularizationReason');
const AttendanceDaily = require('../models/AttendanceDaily');
const AttendancePunch = require('../models/AttendancePunch');
const Shift = require('../models/Shift');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate } = require('../utils/dateUtils');
const {
  normalizeDate,
  evaluateLateMark,
  recalculateLateStatus
} = require('../services/attendanceService');
const {
  validateRegularizationWindow,
  isPayrollMonthLocked,
  queueRegularizationEmail
} = require('../services/regularizationService');

/**
 * @desc    Apply for Attendance Regularization (Employee, CEO, CTO - NOT Super Admin)
 * @route   POST /api/regularizations
 * @access  Private (Non-exempt users)
 */
const applyRegularization = async (req, res, next) => {
  try {
    const user = req.user;

    // Super Admin is exempt and blocked from applying
    if (user.attendance_exempt === true) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin is exempt from attendance tracking and cannot apply for regularization'
      });
    }

    const { date, req_in, req_out, reason_id, remark } = req.body;

    if (!date || !req_in || !req_out || !reason_id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide date, req_in, req_out, and reason_id'
      });
    }

    const parsedDate = parseDate(date);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please provide date as DD/MM/YYYY or YYYY-MM-DD'
      });
    }
    const normalizedTargetDate = normalizeDate(parsedDate);

    // 1. Validate submission window (default 7 days, non-future)
    const windowCheck = validateRegularizationWindow(normalizedTargetDate, 7);
    if (!windowCheck.valid) {
      return res.status(400).json({
        success: false,
        message: windowCheck.message
      });
    }

    // 2. Validate payroll month lock (Module 6 forward check)
    const locked = await isPayrollMonthLocked(normalizedTargetDate);
    if (locked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot regularize attendance for an already locked payroll month'
      });
    }

    // 3. Validate reason exists & is active
    const reasonObj = await RegularizationReason.findById(reason_id);
    if (!reasonObj || reasonObj.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive regularization reason selected'
      });
    }

    // 4. Validate in/out timestamps
    const parsedReqIn = new Date(req_in);
    const parsedReqOut = new Date(req_out);
    if (isNaN(parsedReqIn.getTime()) || isNaN(parsedReqOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid req_in or req_out timestamp format'
      });
    }
    if (parsedReqIn >= parsedReqOut) {
      return res.status(400).json({
        success: false,
        message: 'Requested In-Time must be earlier than Requested Out-Time'
      });
    }

    // 5. Guard against duplicate Pending request for the same date
    const existingPending = await RegularizationRequest.findOne({
      user_id: user._id,
      date: normalizedTargetDate,
      status: 'Pending'
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: `An open pending regularization request already exists for date [${formatDate(normalizedTargetDate)}]`
      });
    }

    // Create request
    const regularizationReq = await RegularizationRequest.create({
      user_id: user._id,
      date: normalizedTargetDate,
      req_in: parsedReqIn,
      req_out: parsedReqOut,
      reason_id: reasonObj._id,
      remark: remark ? remark.trim() : null,
      status: 'Pending'
    });

    await queueRegularizationEmail(regularizationReq, 'SUBMITTED');

    res.status(201).json({
      success: true,
      message: 'Regularization request submitted successfully and queued for Super Admin review',
      data: regularizationReq
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Regularization Requests (Scope enforced: ALL / OWN)
 * @route   GET /api/regularizations
 * @access  Private (ALL for Super Admin/CEO/CTO, OWN for Employee)
 */
const getRegularizations = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    const filter = {};

    if (scope === 'OWN') {
      filter.user_id = req.user._id;
      if (req.query.user_id && req.query.user_id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot view regularization requests of other employees'
        });
      }
    } else {
      // Scope === 'ALL' (Super Admin, CEO, CTO)
      if (req.query.user_id) {
        filter.user_id = req.query.user_id;
      }
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
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await RegularizationRequest.countDocuments(filter);
    const requests = await RegularizationRequest.find(filter)
      .populate('user_id', 'employee_code name email department_id designation_id branch_id')
      .populate('reason_id', 'reason')
      .populate('decided_by', 'employee_code name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Regularization Request by ID (Includes original attendance & punches context)
 * @route   GET /api/regularizations/:id
 * @access  Private (Scope checked)
 */
const getRegularizationById = async (req, res, next) => {
  try {
    const request = await RegularizationRequest.findById(req.params.id)
      .populate('user_id', 'employee_code name email department_id designation_id branch_id')
      .populate('reason_id', 'reason')
      .populate('decided_by', 'employee_code name');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found'
      });
    }

    const scope = req.permissionScope || 'OWN';
    if (scope === 'OWN' && request.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You cannot view regularization requests of other employees'
      });
    }

    // Fetch original AttendanceDaily record and raw AttendancePunch logs for context
    const dailyRecord = await AttendanceDaily.findOne({
      user_id: request.user_id._id,
      date: request.date
    });

    const nextDay = new Date(request.date.getTime() + 24 * 60 * 60 * 1000);
    const originalPunches = await AttendancePunch.find({
      user_id: request.user_id._id,
      time_utc: { $gte: request.date, $lt: nextDay }
    }).sort({ time_utc: 1 });

    res.status(200).json({
      success: true,
      data: {
        request,
        attendance_context: {
          daily_record: dailyRecord,
          original_punches: originalPunches
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Approve Regularization Request (Super Admin ONLY)
 * @route   PUT /api/regularizations/:id/approve
 * @access  Private (SUPER_ADMIN only)
 */
const approveRegularization = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Regularization requests can only be approved by Super Admin'
      });
    }

    const regularizationReq = await RegularizationRequest.findById(req.params.id);
    if (!regularizationReq) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found'
      });
    }

    if (regularizationReq.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status [${regularizationReq.status}]`
      });
    }

    // 1. Fetch user shift & branch for timezone/late evaluation
    const targetUser = await User.findById(regularizationReq.user_id)
      .populate('shift_id')
      .populate('branch_id');

    const defaultShift = await Shift.findOne({ status: 'Active' });
    const shift = targetUser?.shift_id || defaultShift;
    const timezone = targetUser?.branch_id?.timezone || 'Asia/Kolkata';

    // 2. Evaluate late mark on requested in-time
    const isLate = evaluateLateMark(regularizationReq.req_in, shift, timezone);

    // 3. Compute work minutes
    const workMinutes = Math.max(
      0,
      Math.floor((new Date(regularizationReq.req_out) - new Date(regularizationReq.req_in)) / (1000 * 60))
    );

    // 4. Update / Upsert AttendanceDaily
    let daily = await AttendanceDaily.findOne({
      user_id: regularizationReq.user_id,
      date: regularizationReq.date
    });
    const oldDailyVal = daily ? daily.toObject() : null;

    daily = await AttendanceDaily.findOneAndUpdate(
      { user_id: regularizationReq.user_id, date: regularizationReq.date },
      {
        $set: {
          first_in: regularizationReq.req_in,
          last_out: regularizationReq.req_out,
          work_minutes: workMinutes,
          status: 'Regularized',
          is_regularized: true,
          is_late: isLate,
          remarks: req.body.remarks || regularizationReq.remark || 'Regularization Approved'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Recalculate Monthly Late Status via Module 2's single source of truth
    const year = regularizationReq.date.getUTCFullYear();
    const month = regularizationReq.date.getUTCMonth() + 1;
    const updatedLateSummary = await recalculateLateStatus(regularizationReq.user_id, year, month);

    // 6. Update RegularizationRequest status to Approved
    regularizationReq.status = 'Approved';
    regularizationReq.decided_by = req.user._id;
    regularizationReq.decision_remark = req.body.decision_remark || req.body.remark || 'Approved by Super Admin';
    regularizationReq.decided_at = new Date();
    await regularizationReq.save();

    // 7. Record Audit Log
    await AuditLog.record(
      req.user._id,
      'REGULARIZATION',
      'APPROVE_REGULARIZATION',
      { request_status: 'Pending', daily: oldDailyVal },
      { request: regularizationReq, daily, updatedLateSummary },
      req
    );

    await queueRegularizationEmail(regularizationReq, 'APPROVED');

    res.status(200).json({
      success: true,
      message: 'Regularization request approved, attendance updated to Regularized, and late counter recalculated',
      data: {
        request: regularizationReq,
        daily,
        late_summary: updatedLateSummary
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reject Regularization Request (Super Admin ONLY)
 * @route   PUT /api/regularizations/:id/reject
 * @access  Private (SUPER_ADMIN only)
 */
const rejectRegularization = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Regularization requests can only be rejected by Super Admin'
      });
    }

    const { remark, decision_remark } = req.body;
    const reasonText = decision_remark || remark;

    if (!reasonText || !reasonText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Decision remark is required when rejecting a regularization request'
      });
    }

    const regularizationReq = await RegularizationRequest.findById(req.params.id);
    if (!regularizationReq) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found'
      });
    }

    if (regularizationReq.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status [${regularizationReq.status}]`
      });
    }

    regularizationReq.status = 'Rejected';
    regularizationReq.decided_by = req.user._id;
    regularizationReq.decision_remark = reasonText.trim();
    regularizationReq.decided_at = new Date();
    await regularizationReq.save();

    await AuditLog.record(
      req.user._id,
      'REGULARIZATION',
      'REJECT_REGULARIZATION',
      { request_status: 'Pending' },
      { request: regularizationReq },
      req
    );

    await queueRegularizationEmail(regularizationReq, 'REJECTED');

    res.status(200).json({
      success: true,
      message: 'Regularization request rejected. Attendance record remains unchanged.',
      data: regularizationReq
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Cancel Regularization Request (Requester only, Pending only)
 * @route   PUT /api/regularizations/:id/cancel
 * @access  Private (Requester only)
 */
const cancelRegularization = async (req, res, next) => {
  try {
    const regularizationReq = await RegularizationRequest.findById(req.params.id);
    if (!regularizationReq) {
      return res.status(404).json({
        success: false,
        message: 'Regularization request not found'
      });
    }

    if (regularizationReq.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only the original requester can cancel this request'
      });
    }

    if (regularizationReq.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a regularization request that is already [${regularizationReq.status}]`
      });
    }

    regularizationReq.status = 'Cancelled';
    await regularizationReq.save();

    await AuditLog.record(
      req.user._id,
      'REGULARIZATION',
      'CANCEL_REGULARIZATION',
      { request_status: 'Pending' },
      { request: regularizationReq },
      req
    );

    await queueRegularizationEmail(regularizationReq, 'CANCELLED');

    res.status(200).json({
      success: true,
      message: 'Regularization request cancelled successfully',
      data: regularizationReq
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  applyRegularization,
  getRegularizations,
  getRegularizationById,
  approveRegularization,
  rejectRegularization,
  cancelRegularization
};
