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
 * Module 6 Forward Hook: Checks if the payroll for the given month is locked
 * (Stub until Module 6 ships - currently returns false)
 * @param {Date} date 
 * @returns {Promise<boolean>}
 */
const isPayrollMonthLocked = async (date) => {
  // Placeholder for Module 6 (Payroll Locking)
  return false;
};

/**
 * Module 7 Forward Hook: Queues notification email on request lifecycle events
 * (Stub until Module 7 ships)
 * @param {Object} request - RegularizationRequest document
 * @param {'SUBMITTED'|'APPROVED'|'REJECTED'|'CANCELLED'} eventType 
 */
const queueRegularizationEmail = async (request, eventType) => {
  // Placeholder for Module 7 (Notification Engine)
  return true;
};

module.exports = {
  validateRegularizationWindow,
  isPayrollMonthLocked,
  queueRegularizationEmail
};
