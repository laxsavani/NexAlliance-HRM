const NotificationTemplate = require('../models/NotificationTemplate');
const Notification = require('../models/Notification');
const LeaveRequest = require('../models/LeaveRequest');
const { formatDate } = require('../utils/dateUtils');

/**
 * Resolves {{placeholder}} tokens in template text against provided contextData
 * Gracefully defaults missing tokens to empty string without throwing.
 * @param {string} text - Template text containing placeholders
 * @param {Object} context - Object with replacement keys
 * @returns {string} - Resolved string
 */
const resolvePlaceholders = (text, context = {}) => {
  if (!text) return '';
  return text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    if (context && context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    return '';
  });
};

/**
 * Core notification dispatcher. Looks up active templates for eventCode and creates
 * Notification documents for IN_APP and EMAIL channels.
 * 
 * @param {string|mongoose.Types.ObjectId} userId - Target recipient User ID
 * @param {string} eventCode - Notification event code (e.g. 'LEAVE_APPROVED')
 * @param {Object} contextData - Key-value map for resolving placeholders
 * @param {string|mongoose.Types.ObjectId} refId - Optional related entity ID
 * @returns {Promise<Array>} - List of created Notification records
 */
const sendNotification = async (userId, eventCode, contextData = {}, refId = null) => {
  try {
    if (!userId || !eventCode) return [];

    // Query active templates for this event code (0, 1, or 2 rows: EMAIL and/or IN_APP)
    const activeTemplates = await NotificationTemplate.find({
      event: eventCode,
      status: 'Active'
    });

    if (!activeTemplates || activeTemplates.length === 0) {
      return []; // Silently skip if no active templates configured
    }

    const createdNotifications = [];

    for (const tmpl of activeTemplates) {
      const resolvedTitle = resolvePlaceholders(tmpl.subject || tmpl.event, contextData);
      const resolvedBody = resolvePlaceholders(tmpl.body, contextData);

      const notificationPayload = {
        user_id: userId,
        event: eventCode,
        channel: tmpl.channel,
        title: resolvedTitle,
        body: resolvedBody,
        is_read: false,
        delivery_status: tmpl.channel === 'EMAIL' ? 'QUEUED' : 'N/A',
        ref_id: refId
      };

      const notificationDoc = await Notification.create(notificationPayload);
      createdNotifications.push(notificationDoc);
    }

    return createdNotifications;
  } catch (error) {
    console.error(`[Notification Dispatcher Error] event: ${eventCode}, user: ${userId}:`, error.message);
    // Never propagate errors to block business execution
    return [];
  }
};

/**
 * Daily reminder job for pending leave requests exceeding threshold duration
 * @param {number} thresholdDays - Number of days a leave request has been pending
 * @returns {Promise<{ processed_requests: number, reminders_sent: number }>}
 */
const runLeavePendingReminderJob = async (thresholdDays = 2) => {
  const cutoffDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);

  const pendingRequests = await LeaveRequest.find({
    status: 'Pending',
    createdAt: { $lte: cutoffDate }
  }).populate('user_id leave_type_id');

  let remindersSent = 0;

  for (const req of pendingRequests) {
    const approvalsList = req.approvals || req.approvals_history || [];
    const alreadyApprovedIds = new Set(
      approvalsList.map((h) => (h.approver_id ? h.approver_id.toString() : ''))
    );

    // Identify unresolved approvers
    const allApprovers = req.approvers || req.assigned_approvers || [];
    const remainingApprovers = allApprovers.filter(
      (apprId) => apprId && !alreadyApprovedIds.has(apprId.toString())
    );

    const daysPending = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const daysCount = req.days !== undefined ? req.days : (req.total_days || 0);

    const context = {
      employee_name: req.user_id?.name || 'Employee',
      leave_type: req.leave_type_id?.name || 'Leave',
      days: daysCount,
      days_pending: daysPending,
      from_date: req.from_date ? formatDate(req.from_date) : '',
      to_date: req.to_date ? formatDate(req.to_date) : ''
    };

    for (const approverId of remainingApprovers) {
      await sendNotification(approverId, 'LEAVE_PENDING_REMINDER', context, req._id);
      remindersSent++;
    }
  }

  return {
    processed_requests: pendingRequests.length,
    reminders_sent: remindersSent
  };
};

module.exports = {
  resolvePlaceholders,
  sendNotification,
  runLeavePendingReminderJob
};
