const { normalizeDate } = require('./attendanceService');

/**
 * Validates if the target regularization date falls within the allowed request window
 * Default: past 7 days, and not a future date
 * @param {Date} targetDate 
 * @param {number} allowedDays 
 * @returns {{ valid: boolean, message?: string }}
 */
const validateRegularizationWindow = (targetDate, allowedDays = 7) => {
  const normalizedTarget = normalizeDate(targetDate);
  const now = new Date();
  const normalizedToday = normalizeDate(now);

  // Guard against future dates
  if (normalizedTarget.getTime() > normalizedToday.getTime()) {
    return {
      valid: false,
      message: 'Cannot apply regularization for a future date'
    };
  }

  // Calculate cutoff threshold in UTC
  const cutoffTime = normalizedToday.getTime() - allowedDays * 24 * 60 * 60 * 1000;
  if (normalizedTarget.getTime() < cutoffTime) {
    return {
      valid: false,
      message: `Regularization request allowed only within the last ${allowedDays} days`
    };
  }

  return { valid: true };
};

/**
 * Checks if the payroll for the given month is locked (Approved, Released, or Paid)
 * @param {Date} date 
 * @returns {Promise<boolean>}
 */
const isPayrollMonthLocked = async (date) => {
  const { isPayrollMonthLocked: checkLocked } = require('./payrollService');
  return await checkLocked(date);
};

/**
 * Module 7 Forward Hook: Dispatches notification on regularization lifecycle events
 * @param {Object} request - RegularizationRequest document
 * @param {'SUBMITTED'|'APPROVED'|'REJECTED'|'CANCELLED'} eventType 
 */
const queueRegularizationEmail = async (request, eventType) => {
  try {
    const { sendNotification } = require('./notificationService');
    const User = require('../models/User');
    const { formatDate } = require('../utils/dateUtils');

    if (!request) return;

    let eventCode = null;
    if (eventType === 'APPROVED') {
      eventCode = 'REGULARIZATION_APPROVED';
    } else if (eventType === 'REJECTED') {
      eventCode = 'REGULARIZATION_REJECTED';
    }

    if (!eventCode) return; // Only notify on Approved / Rejected as per doc

    const userId = request.user_id?._id || request.user_id;
    let employeeName = request.user_id?.name;
    if (!employeeName) {
      const user = await User.findById(userId);
      employeeName = user ? user.name : 'Employee';
    }

    const inTimeStr = request.req_in ? new Date(request.req_in).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : (request.requested_in_time || 'N/A');
    const outTimeStr = request.req_out ? new Date(request.req_out).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : (request.requested_out_time || 'N/A');

    const context = {
      employee_name: employeeName,
      date: request.date ? formatDate(request.date) : '',
      in_time: inTimeStr,
      out_time: outTimeStr,
      rejection_reason: request.decision_remark || request.rejection_reason || request.remarks || '',
      reason: request.remark || request.reason || ''
    };

    await sendNotification(userId, eventCode, context, request._id);
  } catch (err) {
    console.error('[queueRegularizationEmail Error]:', err.message);
  }
};

module.exports = {
  validateRegularizationWindow,
  isPayrollMonthLocked,
  queueRegularizationEmail
};
