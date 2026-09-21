const User = require('../models/User');
const Role = require('../models/Role');
const Holiday = require('../models/Holiday');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveLedger = require('../models/LeaveLedger');
const { normalizeDate } = require('./attendanceService');

const approvalMatrixService = require('./approvalMatrixService');

/**
 * Resolves the approver chain snapshot based on Approval Matrix 3-tier precedence
 * @param {Object} user - Populated User document or user ID
 * @returns {Promise<{ approverIds: Array<ObjectId>, approvalsNeeded: number }>}
 */
const resolveApprovers = async (user) => {
  return await approvalMatrixService.resolveApprovers(user, 'LEAVE');
};

/**
 * Calculates work days excluding holidays and weekly offs from the Holiday master
 * @param {Date} fromDate 
 * @param {Date} toDate 
 * @param {'FULL'|'FIRST_HALF'|'SECOND_HALF'|'SHORT'} dayPart 
 * @param {ObjectId} branchId 
 * @returns {Promise<number>}
 */
const calculateLeaveDays = async (fromDate, toDate, dayPart = 'FULL', branchId = null) => {
  if (dayPart === 'SHORT') {
    return 1; // 1 Short Leave unit / session
  }

  if (dayPart === 'FIRST_HALF' || dayPart === 'SECOND_HALF') {
    return 0.5;
  }

  const start = normalizeDate(fromDate);
  const end = normalizeDate(toDate);

  // Fetch holidays & weekly offs in range
  const holidays = await Holiday.find({
    date: { $gte: start, $lte: end },
    status: 'Active'
  });

  const holidayDateStrings = new Set();
  holidays.forEach(h => {
    if (!h.branch_id || (branchId && h.branch_id.toString() === branchId.toString())) {
      holidayDateStrings.add(normalizeDate(h.date).toISOString().split('T')[0]);
    }
  });

  let workingDays = 0;
  const current = new Date(start.getTime());

  while (current.getTime() <= end.getTime()) {
    const dateStr = current.toISOString().split('T')[0];
    if (!holidayDateStrings.has(dateStr)) {
      workingDays++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return Math.max(0, workingDays);
};

/**
 * Retrieves or initializes the LeaveBalance for a user and leave type
 * @param {ObjectId} userId 
 * @param {Object} leaveType - LeaveType document
 * @param {number} year 
 * @param {number|null} month 
 * @returns {Promise<Object>} LeaveBalance document
 */
const getOrCreateLeaveBalance = async (userId, leaveType, year, month = null) => {
  const isMonthly = leaveType.quota_period === 'MONTH';
  const queryMonth = isMonthly ? month : null;

  let balance = await LeaveBalance.findOne({
    user_id: userId,
    leave_type_id: leaveType._id,
    year,
    month: queryMonth
  });

  if (!balance) {
    const openingQuota = leaveType.quota || 0;
    balance = await LeaveBalance.create({
      user_id: userId,
      leave_type_id: leaveType._id,
      year,
      month: queryMonth,
      opening: openingQuota,
      accrued: 0,
      used: 0,
      pending: 0,
      adjusted: 0,
      lapsed: 0
    });
  }

  return balance;
};

/**
 * Appends an immutable audit transaction into LeaveLedger
 * @param {Object} params
 */
const recordLedgerTransaction = async ({ userId, leaveTypeId, txnType, qty, refId = null, createdBy, remarks = null }) => {
  return await LeaveLedger.create({
    user_id: userId,
    leave_type_id: leaveTypeId,
    txn_type: txnType,
    qty,
    ref_id: refId,
    created_by: createdBy,
    remarks
  });
};

/**
 * Module 7 Forward Hook: Dispatches notification on leave events
 * @param {Object} request - LeaveRequest document
 * @param {'SUBMITTED'|'PARTIALLY_APPROVED'|'APPROVED'|'REJECTED'|'CANCELLED'} eventType 
 */
const queueLeaveEmail = async (request, eventType) => {
  try {
    const { sendNotification } = require('./notificationService');
    const User = require('../models/User');
    const LeaveType = require('../models/LeaveType');
    const { formatDate } = require('../utils/dateUtils');

    if (!request) return;

    const requesterId = request.user_id?._id || request.user_id;
    let employeeName = request.user_id?.name;
    if (!employeeName) {
      const user = await User.findById(requesterId);
      employeeName = user ? user.name : 'Employee';
    }

    let leaveTypeName = request.leave_type_id?.name;
    if (!leaveTypeName) {
      const lt = await LeaveType.findById(request.leave_type_id?._id || request.leave_type_id);
      leaveTypeName = lt ? lt.name : 'Leave';
    }

    const approvers = request.approvers || request.assigned_approvers || [];
    const daysCount = request.days !== undefined ? request.days : (request.total_days || 0);

    const context = {
      employee_name: employeeName,
      leave_type: leaveTypeName,
      from_date: request.from_date ? formatDate(request.from_date) : '',
      to_date: request.to_date ? formatDate(request.to_date) : '',
      days: daysCount,
      reason: request.reason || '',
      rejection_reason: request.rejection_reason || '',
      approvals_done: request.approvals_done,
      approvals_needed: request.approvals_needed
    };

    if (eventType === 'SUBMITTED') {
      // Notify both/all resolved approvers
      for (const approverId of approvers) {
        await sendNotification(approverId, 'LEAVE_APPLIED', context, request._id);
      }
    } else if (eventType === 'PARTIALLY_APPROVED') {
      // Notify requester that first approval is recorded
      await sendNotification(requesterId, 'LEAVE_FIRST_APPROVAL', context, request._id);
    } else if (eventType === 'APPROVED') {
      // Final approval notification to requester
      await sendNotification(requesterId, 'LEAVE_APPROVED', context, request._id);
    } else if (eventType === 'REJECTED') {
      // Rejection notification to requester
      await sendNotification(requesterId, 'LEAVE_REJECTED', context, request._id);
    } else if (eventType === 'CANCELLED') {
      // Notify approvers of cancellation of approved leave
      for (const approverId of approvers) {
        await sendNotification(approverId, 'LEAVE_CANCELLED_NOTICE', context, request._id);
      }
    }
  } catch (err) {
    console.error('[queueLeaveEmail Error]:', err.message);
  }
};

module.exports = {
  resolveApprovers,
  calculateLeaveDays,
  getOrCreateLeaveBalance,
  recordLedgerTransaction,
  queueLeaveEmail
};
