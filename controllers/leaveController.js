const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveLedger = require('../models/LeaveLedger');
const AttendanceDaily = require('../models/AttendanceDaily');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate } = require('../utils/dateUtils');
const { normalizeDate } = require('../services/attendanceService');
const {
  resolveApprovers,
  calculateLeaveDays,
  getOrCreateLeaveBalance,
  recordLedgerTransaction,
  queueLeaveEmail
} = require('../services/leaveService');
const { isPayrollMonthLocked } = require('../services/regularizationService');

/**
 * @desc    Apply for Leave (Employee, CEO, CTO - NOT Super Admin)
 * @route   POST /api/leaves
 * @access  Private (Non-exempt users)
 */
const applyLeave = async (req, res, next) => {
  try {
    const user = req.user;

    // Super Admin is exempt from attendance and cannot apply
    if (user.attendance_exempt === true) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin is exempt from attendance tracking and cannot apply for leave'
      });
    }

    const {
      leave_type_id,
      from_date,
      to_date,
      day_part = 'FULL',
      from_time,
      to_time,
      reason,
      attachment_url
    } = req.body;

    if (!leave_type_id || !from_date || !to_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide leave_type_id, from_date, to_date, and reason'
      });
    }

    const leaveType = await LeaveType.findById(leave_type_id);
    if (!leaveType || leaveType.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive leave type selected'
      });
    }

    const parsedFrom = parseDate(from_date);
    const parsedTo = parseDate(to_date);

    if (!parsedFrom || isNaN(parsedFrom.getTime()) || !parsedTo || isNaN(parsedTo.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use DD/MM/YYYY or YYYY-MM-DD'
      });
    }

    const normalizedFrom = normalizeDate(parsedFrom);
    const normalizedTo = normalizeDate(parsedTo);

    if (normalizedFrom.getTime() > normalizedTo.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'From Date cannot be later than To Date'
      });
    }

    // Notice days check
    if (leaveType.notice_days > 0) {
      const today = normalizeDate(new Date());
      const daysAhead = Math.floor((normalizedFrom.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAhead < leaveType.notice_days) {
        return res.status(400).json({
          success: false,
          message: `This leave type requires at least ${leaveType.notice_days} days advance notice`
        });
      }
    }

    // Attachment check
    if (leaveType.needs_attachment && !attachment_url) {
      return res.status(400).json({
        success: false,
        message: `Supporting document attachment is required for ${leaveType.name}`
      });
    }

    // Short leave specific validations
    if (day_part === 'SHORT' || leaveType.code === 'SHORT_LEAVE') {
      if (normalizedFrom.getTime() !== normalizedTo.getTime()) {
        return res.status(400).json({
          success: false,
          message: 'Short Leave can only be applied for a single day'
        });
      }
      if (!from_time || !to_time) {
        return res.status(400).json({
          success: false,
          message: 'From Time and To Time are required for Short Leave'
        });
      }
      const [sh, sm] = from_time.split(':').map(Number);
      const [eh, em] = to_time.split(':').map(Number);
      const diffMinutes = (eh * 60 + em) - (sh * 60 + sm);

      if (diffMinutes <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Short Leave To Time must be later than From Time'
        });
      }
      const maxMins = leaveType.max_duration_minutes || 120;
      if (diffMinutes > maxMins) {
        return res.status(400).json({
          success: false,
          message: `Short Leave duration exceeds max allowed limit of ${maxMins} minutes (${maxMins / 60} hours)`
        });
      }
    }

    // Overlapping leave check
    const existingOverlap = await LeaveRequest.findOne({
      user_id: user._id,
      status: { $in: ['Pending', 'Approved'] },
      from_date: { $lte: normalizedTo },
      to_date: { $gte: normalizedFrom }
    });

    if (existingOverlap) {
      return res.status(400).json({
        success: false,
        message: `You already have an active leave request covering dates between [${formatDate(normalizedFrom)}] and [${formatDate(normalizedTo)}]`
      });
    }

    // Payroll lock check
    const isLocked = await isPayrollMonthLocked(normalizedFrom);
    if (isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for leave inside an already locked payroll month'
      });
    }

    // Calculate requested days / units
    const branchId = user.branch_id?._id || user.branch_id;
    const leaveUnits = await calculateLeaveDays(normalizedFrom, normalizedTo, day_part, branchId);

    if (leaveUnits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected date range contains only holidays/weekly offs. No leave required.'
      });
    }

    // Balance check & Hold Pending Balance
    const year = normalizedFrom.getUTCFullYear();
    const month = normalizedFrom.getUTCMonth() + 1;
    const balance = await getOrCreateLeaveBalance(user._id, leaveType, year, month);

    if (leaveType.quota > 0) {
      const available = (balance.opening + balance.accrued + balance.adjusted) - (balance.used + balance.pending + balance.lapsed);
      if (leaveUnits > available) {
        if (leaveType.code === 'SHORT_LEAVE' || leaveType.quota_period === 'MONTH') {
          return res.status(400).json({
            success: false,
            message: `Monthly quota exceeded for ${leaveType.name} (Max allowed: ${leaveType.quota}/month, Available: ${available})`
          });
        }
        return res.status(400).json({
          success: false,
          message: `Insufficient leave balance for ${leaveType.name}. Requested: ${leaveUnits} day(s), Available: ${available} day(s)`
        });
      }
    }

    // Hold balance in pending
    balance.pending += leaveUnits;
    await balance.save();

    // Resolve approver chain snapshot (Matrix A)
    const { approverIds, approvalsNeeded } = await resolveApprovers(user);

    const leaveRequest = await LeaveRequest.create({
      user_id: user._id,
      leave_type_id: leaveType._id,
      from_date: normalizedFrom,
      to_date: normalizedTo,
      day_part,
      from_time: from_time || null,
      to_time: to_time || null,
      days: leaveUnits,
      reason: reason.trim(),
      attachment_url: attachment_url || null,
      status: 'Pending',
      approvers: approverIds,
      approvals_needed: approvalsNeeded,
      approvals_done: 0,
      approvals: []
    });

    await queueLeaveEmail(leaveRequest, 'SUBMITTED');

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully and queued for approval',
      data: leaveRequest
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Leave Requests (Scope enforced: ALL / OWN)
 * @route   GET /api/leaves
 * @access  Private (ALL for Super Admin/CEO/CTO, OWN for Employee)
 */
const getLeaves = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    const filter = {};

    if (scope === 'OWN') {
      filter.user_id = req.user._id;
      if (req.query.user_id && req.query.user_id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot view leave requests of other employees'
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

    if (req.query.leave_type_id) {
      filter.leave_type_id = req.query.leave_type_id;
    }

    if (req.query.from || req.query.to) {
      filter.from_date = {};
      if (req.query.from) filter.from_date.$gte = normalizeDate(parseDate(req.query.from));
      if (req.query.to) filter.to_date = { $lte: normalizeDate(parseDate(req.query.to)) };
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await LeaveRequest.countDocuments(filter);
    const requests = await LeaveRequest.find(filter)
      .populate('user_id', 'employee_code name email department_id designation_id branch_id')
      .populate('leave_type_id', 'code name is_paid quota_period')
      .populate('approvers', 'employee_code name email role_id')
      .populate('approvals.approver_id', 'employee_code name')
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
 * @desc    Get Leave Request by ID
 * @route   GET /api/leaves/:id
 * @access  Private (Scope checked)
 */
const getLeaveById = async (req, res, next) => {
  try {
    const request = await LeaveRequest.findById(req.params.id)
      .populate('user_id', 'employee_code name email department_id designation_id branch_id')
      .populate('leave_type_id', 'code name is_paid quota_period')
      .populate('approvers', 'employee_code name email role_id')
      .populate('approvals.approver_id', 'employee_code name');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const scope = req.permissionScope || 'OWN';
    if (scope === 'OWN' && request.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You cannot view leave requests of other employees'
      });
    }

    res.status(200).json({
      success: true,
      data: request
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get User Leave Balances
 * @route   GET /api/leaves/balance
 * @access  Private (ALL for Super Admin/CEO/CTO, OWN for Employee)
 */
const getLeaveBalance = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    let targetUserId = req.user._id;

    if (req.query.user_id) {
      if (scope === 'OWN' && req.query.user_id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot view leave balances of other employees'
        });
      }
      targetUserId = req.query.user_id;
    }

    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getUTCFullYear();
    const month = parseInt(req.query.month, 10) || now.getUTCMonth() + 1;

    // Fetch all active leave types
    const leaveTypes = await LeaveType.find({ status: 'Active' }).sort({ name: 1 });
    const balances = [];

    for (const lt of leaveTypes) {
      const bal = await getOrCreateLeaveBalance(targetUserId, lt, year, month);
      balances.push({
        leave_type: lt,
        year,
        month: lt.quota_period === 'MONTH' ? month : null,
        opening: bal.opening,
        accrued: bal.accrued,
        used: bal.used,
        pending: bal.pending,
        adjusted: bal.adjusted,
        lapsed: bal.lapsed,
        available: bal.available
      });
    }

    res.status(200).json({
      success: true,
      user_id: targetUserId,
      year,
      month,
      data: balances
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Approve Leave Request (Dual CEO+CTO Engine & Super Admin Override)
 * @route   PUT /api/leaves/:id/approve
 * @access  Private (Assigned Approvers & Super Admin)
 */
const approveLeave = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('leave_type_id')
      .populate('user_id');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with status [${leaveRequest.status}]`
      });
    }

    // Caller authorization check
    const isAssignedApprover = leaveRequest.approvers.some(
      appId => appId.toString() === req.user._id.toString()
    );

    if (!isAssignedApprover && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not an assigned approver for this leave request'
      });
    }

    // Check if caller already acted on this request
    const alreadyActed = leaveRequest.approvals.some(
      a => a.approver_id.toString() === req.user._id.toString()
    );

    if (alreadyActed && !isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted your decision for this leave request'
      });
    }

    // Record this approver's action
    leaveRequest.approvals.push({
      approver_id: req.user._id,
      action: 'APPROVE',
      remark: req.body.remark || req.body.decision_remark || 'Approved',
      acted_at: new Date()
    });

    leaveRequest.approvals_done += 1;

    let fullyApproved = false;

    // Fully approved if all needed approvals are done or Super Admin overrides
    if (leaveRequest.approvals_done >= leaveRequest.approvals_needed || isSuperAdmin) {
      fullyApproved = true;
      leaveRequest.status = 'Approved';
      if (isSuperAdmin && leaveRequest.approvals_done < leaveRequest.approvals_needed) {
        leaveRequest.is_override = true;
      }

      // 1. Balance deduction: move from pending to used
      const year = leaveRequest.from_date.getUTCFullYear();
      const month = leaveRequest.from_date.getUTCMonth() + 1;
      const balance = await getOrCreateLeaveBalance(leaveRequest.user_id._id, leaveRequest.leave_type_id, year, month);

      balance.pending = Math.max(0, balance.pending - leaveRequest.days);
      balance.used += leaveRequest.days;
      await balance.save();

      // 2. Append to LeaveLedger
      await recordLedgerTransaction({
        userId: leaveRequest.user_id._id,
        leaveTypeId: leaveRequest.leave_type_id._id,
        txnType: 'USED',
        qty: -leaveRequest.days,
        refId: leaveRequest._id,
        createdBy: req.user._id,
        remarks: `Leave approved (${leaveRequest.leave_type_id.name})`
      });

      // 3. Attendance integration
      if (leaveRequest.day_part === 'SHORT') {
        const { markShortLeaveCover } = require('../services/attendanceService');
        await markShortLeaveCover(
          leaveRequest.user_id._id,
          leaveRequest.from_date,
          leaveRequest.from_time,
          leaveRequest.to_time
        );
      } else {
        // Mark AttendanceDaily records as Leave
        let cur = new Date(leaveRequest.from_date.getTime());
        const end = new Date(leaveRequest.to_date.getTime());
        while (cur.getTime() <= end.getTime()) {
          const normDate = normalizeDate(cur);
          await AttendanceDaily.findOneAndUpdate(
            { user_id: leaveRequest.user_id._id, date: normDate },
            {
              $set: {
                status: 'Leave',
                remarks: `Approved Leave (${leaveRequest.leave_type_id.name})`
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }

      await queueLeaveEmail(leaveRequest, 'APPROVED');
    } else {
      // Partially approved (e.g. 1 of 2)
      await queueLeaveEmail(leaveRequest, 'PARTIALLY_APPROVED');
    }

    await leaveRequest.save();

    await AuditLog.record(
      req.user._id,
      'LEAVE',
      fullyApproved ? 'FINAL_APPROVE_LEAVE' : 'PARTIAL_APPROVE_LEAVE',
      { status: 'Pending' },
      { leaveRequest, approvals_done: leaveRequest.approvals_done },
      req
    );

    res.status(200).json({
      success: true,
      message: fullyApproved
        ? 'Leave request fully approved and balance deducted'
        : `Approval recorded (${leaveRequest.approvals_done} of ${leaveRequest.approvals_needed} approvals done)`,
      data: leaveRequest,
      fully_approved: fullyApproved
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reject Leave Request (Immediate rejection on single reject)
 * @route   PUT /api/leaves/:id/reject
 * @access  Private (Assigned Approvers & Super Admin)
 */
const rejectLeave = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('leave_type_id')
      .populate('user_id');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status [${leaveRequest.status}]`
      });
    }

    const isAssignedApprover = leaveRequest.approvers.some(
      appId => appId.toString() === req.user._id.toString()
    );

    if (!isAssignedApprover && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not an assigned approver for this leave request'
      });
    }

    const { remark, decision_remark } = req.body;
    const reasonText = decision_remark || remark;

    if (!reasonText || !reasonText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Decision remark is required when rejecting a leave request'
      });
    }

    leaveRequest.status = 'Rejected';
    leaveRequest.approvals.push({
      approver_id: req.user._id,
      action: 'REJECT',
      remark: reasonText.trim(),
      acted_at: new Date()
    });

    // Release held pending balance
    const year = leaveRequest.from_date.getUTCFullYear();
    const month = leaveRequest.from_date.getUTCMonth() + 1;
    const balance = await getOrCreateLeaveBalance(leaveRequest.user_id._id, leaveRequest.leave_type_id, year, month);

    balance.pending = Math.max(0, balance.pending - leaveRequest.days);
    await balance.save();

    await recordLedgerTransaction({
      userId: leaveRequest.user_id._id,
      leaveTypeId: leaveRequest.leave_type_id._id,
      txnType: 'RELEASED',
      qty: leaveRequest.days,
      refId: leaveRequest._id,
      createdBy: req.user._id,
      remarks: `Leave rejected by approver: ${reasonText.trim()}`
    });

    await leaveRequest.save();

    await AuditLog.record(
      req.user._id,
      'LEAVE',
      'REJECT_LEAVE',
      { status: 'Pending' },
      { leaveRequest },
      req
    );

    await queueLeaveEmail(leaveRequest, 'REJECTED');

    res.status(200).json({
      success: true,
      message: 'Leave request rejected and held pending balance released',
      data: leaveRequest
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Cancel Leave Request (Requester for Pending/Future Approved; Super Admin for Past Approved)
 * @route   PUT /api/leaves/:id/cancel
 * @access  Private (Requester & Super Admin)
 */
const cancelLeave = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';

    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate('leave_type_id')
      .populate('user_id');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const isRequester = leaveRequest.user_id._id.toString() === req.user._id.toString();
    const now = normalizeDate(new Date());

    if (!isRequester && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only the requester or Super Admin can cancel this request'
      });
    }

    if (leaveRequest.status === 'Cancelled' || leaveRequest.status === 'Rejected') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a leave request that is already [${leaveRequest.status}]`
      });
    }

    const wasApproved = leaveRequest.status === 'Approved';

    // Requester can cancel Pending or Future Approved
    if (isRequester && !isSuperAdmin) {
      if (wasApproved && leaveRequest.from_date.getTime() < now.getTime()) {
        return res.status(403).json({
          success: false,
          message: 'Past approved leave can only be cancelled by Super Admin'
        });
      }
    }

    const year = leaveRequest.from_date.getUTCFullYear();
    const month = leaveRequest.from_date.getUTCMonth() + 1;
    const balance = await getOrCreateLeaveBalance(leaveRequest.user_id._id, leaveRequest.leave_type_id, year, month);

    if (wasApproved) {
      // Revert used balance
      balance.used = Math.max(0, balance.used - leaveRequest.days);
      await balance.save();

      await recordLedgerTransaction({
        userId: leaveRequest.user_id._id,
        leaveTypeId: leaveRequest.leave_type_id._id,
        txnType: 'RELEASED',
        qty: leaveRequest.days,
        refId: leaveRequest._id,
        createdBy: req.user._id,
        remarks: 'Approved leave cancelled, balance returned'
      });

      // Clear AttendanceDaily leave status
      if (leaveRequest.day_part === 'SHORT') {
        await AttendanceDaily.findOneAndUpdate(
          { user_id: leaveRequest.user_id._id, date: leaveRequest.from_date },
          { $set: { remarks: 'Short Leave Cancelled' } }
        );
      } else {
        let cur = new Date(leaveRequest.from_date.getTime());
        const end = new Date(leaveRequest.to_date.getTime());
        while (cur.getTime() <= end.getTime()) {
          const normDate = normalizeDate(cur);
          await AttendanceDaily.findOneAndUpdate(
            { user_id: leaveRequest.user_id._id, date: normDate },
            { $set: { status: 'Absent', remarks: 'Leave Cancelled' } }
          );
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
      }
    } else {
      // Pending request cancelled: release held pending balance
      balance.pending = Math.max(0, balance.pending - leaveRequest.days);
      await balance.save();

      await recordLedgerTransaction({
        userId: leaveRequest.user_id._id,
        leaveTypeId: leaveRequest.leave_type_id._id,
        txnType: 'RELEASED',
        qty: leaveRequest.days,
        refId: leaveRequest._id,
        createdBy: req.user._id,
        remarks: 'Pending leave cancelled by requester'
      });
    }

    leaveRequest.status = 'Cancelled';
    await leaveRequest.save();

    await AuditLog.record(
      req.user._id,
      'LEAVE',
      'CANCEL_LEAVE',
      { previous_status: wasApproved ? 'Approved' : 'Pending' },
      { leaveRequest },
      req
    );

    await queueLeaveEmail(leaveRequest, 'CANCELLED');

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully and balance adjusted',
      data: leaveRequest
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Manual Leave Balance Adjustment (Super Admin ONLY)
 * @route   POST /api/leaves/adjust-balance
 * @access  Private (SUPER_ADMIN only)
 */
const adjustBalance = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can manually adjust leave balances'
      });
    }

    const { user_id, leave_type_id, year, month, qty, reason } = req.body;

    if (!user_id || !leave_type_id || !year || qty === undefined || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide user_id, leave_type_id, year, qty (+/-), and reason'
      });
    }

    const leaveType = await LeaveType.findById(leave_type_id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }

    const balance = await getOrCreateLeaveBalance(user_id, leaveType, Number(year), month ? Number(month) : null);
    const oldVal = balance.toObject();

    balance.adjusted += Number(qty);
    await balance.save();

    await recordLedgerTransaction({
      userId: user_id,
      leaveTypeId: leave_type_id,
      txnType: 'ADJUSTED',
      qty: Number(qty),
      createdBy: req.user._id,
      remarks: reason.trim()
    });

    await AuditLog.record(
      req.user._id,
      'LEAVE',
      'ADJUST_BALANCE',
      oldVal,
      balance,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Leave balance adjusted successfully and recorded in ledger',
      data: balance
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  applyLeave,
  getLeaves,
  getLeaveById,
  getLeaveBalance,
  approveLeave,
  rejectLeave,
  cancelLeave,
  adjustBalance
};
