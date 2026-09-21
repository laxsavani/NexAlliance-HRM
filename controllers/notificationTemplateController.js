const NotificationTemplate = require('../models/NotificationTemplate');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all notification templates (Filter by channel, status, event)
 * @route   GET /api/notification-templates
 * @access  Private (Super Admin only)
 */
const getNotificationTemplates = async (req, res) => {
  try {
    const { channel, status, event } = req.query;
    const filter = {};

    if (channel) filter.channel = channel;
    if (status) filter.status = status;
    if (event) filter.event = event;

    const templates = await NotificationTemplate.find(filter).sort({ event: 1, channel: 1 });

    return res.status(200).json({
      success: true,
      count: templates.length,
      templates
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notification templates',
      error: error.message
    });
  }
};

/**
 * @desc    Create a new notification template
 * @route   POST /api/notification-templates
 * @access  Private (Super Admin only)
 */
const createNotificationTemplate = async (req, res) => {
  try {
    const { event, channel, subject, body, status = 'Active' } = req.body;

    if (!event || !channel || !body) {
      return res.status(400).json({
        success: false,
        message: 'Event code, channel (EMAIL/IN_APP), and body are required'
      });
    }

    // Check for duplicate event + channel pair
    const existing = await NotificationTemplate.findOne({ event, channel });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Template for event '${event}' and channel '${channel}' already exists`
      });
    }

    const template = await NotificationTemplate.create({
      event,
      channel,
      subject: channel === 'EMAIL' ? (subject || event) : null,
      body,
      status
    });

    await AuditLog.record(
      req.user._id,
      'SETTINGS',
      'NOTIFICATION_TEMPLATE_CREATE',
      null,
      { template_id: template._id, event, channel },
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Notification template created successfully',
      template
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create notification template',
      error: error.message
    });
  }
};

/**
 * @desc    Update an existing notification template
 * @route   PUT /api/notification-templates/:id
 * @access  Private (Super Admin only)
 */
const updateNotificationTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, body, status } = req.body;

    const template = await NotificationTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Notification template not found'
      });
    }

    const oldState = { subject: template.subject, body: template.body, status: template.status };

    if (subject !== undefined) template.subject = subject;
    if (body !== undefined) template.body = body;
    if (status !== undefined) template.status = status;

    await template.save();

    await AuditLog.record(
      req.user._id,
      'SETTINGS',
      'NOTIFICATION_TEMPLATE_UPDATE',
      oldState,
      { template_id: template._id, event: template.event, channel: template.channel, status: template.status },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Notification template updated successfully',
      template
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification template',
      error: error.message
    });
  }
};

/**
 * @desc    Soft delete (deactivate) notification template
 * @route   DELETE /api/notification-templates/:id
 * @access  Private (Super Admin only)
 */
const deleteNotificationTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const template = await NotificationTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Notification template not found'
      });
    }

    template.status = 'Inactive';
    await template.save();

    await AuditLog.record(
      req.user._id,
      'SETTINGS',
      'NOTIFICATION_TEMPLATE_DEACTIVATE',
      { status: 'Active' },
      { template_id: template._id, event: template.event, channel: template.channel, status: 'Inactive' },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Notification template deactivated successfully',
      template
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to deactivate notification template',
      error: error.message
    });
  }
};

module.exports = {
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate
};
