const User = require('../models/User');
const Role = require('../models/Role');
const Holiday = require('../models/Holiday');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveLedger = require('../models/LeaveLedger');
const { normalizeDate } = require('./attendanceService');

/**
 * Resolves the approver chain snapshot based on Matrix A rules
 * - Requester is EMPLOYEE -> Approvers: [CEO, CTO], approvals_needed: 2
 * - Requester is CTO      -> Approver: [CEO], approvals_needed: 1
 * - Requester is CEO      -> Approver: [CTO], approvals_needed: 1
 * - Requester is excluded from their own approvers list
 * @param {Object} user - Populated User document
 * @returns {Promise<{ approverIds: Array<ObjectId>, approvalsNeeded: number }>}
 */
const resolveApprovers = async (user) => {
  const roleCode = user.role_id?.code || '';

  // Lookup CEO and CTO roles
  const ceoRole = await Role.findOne({ code: 'CEO' });
  const ctoRole = await Role.findOne({ code: 'CTO' });

  // Lookup active users with CEO and CTO roles
  const ceos = ceoRole ? await User.find({ role_id: ceoRole._id, status: 'Active' }) : [];
  const ctos = ctoRole ? await User.find({ role_id: ctoRole._id, status: 'Active' }) : [];

  const ceoUser = ceos[0];
  const ctoUser = ctos[0];

  const candidateApprovers = [];

  if (roleCode === 'CTO') {
    if (ceoUser && ceoUser._id.toString() !== user._id.toString()) {
      candidateApprovers.push(ceoUser._id);
    }
    return {
      approverIds: candidateApprovers,
      approvalsNeeded: candidateApprovers.length > 0 ? 1 : 0
    };
  }

  if (roleCode === 'CEO') {
    if (ctoUser && ctoUser._id.toString() !== user._id.toString()) {
      candidateApprovers.push(ctoUser._id);
    }
    return {
      approverIds: candidateApprovers,
      approvalsNeeded: candidateApprovers.length > 0 ? 1 : 0
    };
  }

  // Default for Employee & all other roles: Both CEO and CTO must approve
  if (ceoUser && ceoUser._id.toString() !== user._id.toString()) {
    candidateApprovers.push(ceoUser._id);
  }
  if (ctoUser && ctoUser._id.toString() !== user._id.toString()) {
    candidateApprovers.push(ctoUser._id);
  }

  return {
    approverIds: candidateApprovers,
    approvalsNeeded: candidateApprovers.length // 2 if both present
  };
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
 * Module 7 Forward Hook: Queues notification email on leave events
 * @param {Object} request - LeaveRequest document
 * @param {'SUBMITTED'|'PARTIALLY_APPROVED'|'APPROVED'|'REJECTED'|'CANCELLED'} eventType 
 */
const queueLeaveEmail = async (request, eventType) => {
  // Placeholder for Module 7 (Notification Engine)
  return true;
};

module.exports = {
  resolveApprovers,
  calculateLeaveDays,
  getOrCreateLeaveBalance,
  recordLedgerTransaction,
  queueLeaveEmail
};
