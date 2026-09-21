const Notification = require('../models/Notification');

/**
 * @desc    Get current user's in-app notification inbox (Self-scoped only)
 * @route   GET /api/notifications
 * @access  Private (All authenticated users)
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_read, channel, page = 1, limit = 20 } = req.query;

    const filter = { user_id: userId };

    if (is_read !== undefined) {
      filter.is_read = is_read === 'true' || is_read === true;
    }
    if (channel) {
      filter.channel = channel;
    } else {
      // By default for user inbox, show IN_APP channel
      filter.channel = 'IN_APP';
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Get current user's unread in-app notifications count (Self-scoped)
 * @route   GET /api/notifications/unread-count
 * @access  Private (All authenticated users)
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.countDocuments({
      user_id: userId,
      channel: 'IN_APP',
      is_read: false
    });

    return res.status(200).json({
      success: true,
      unread_count: count
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to count unread notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Mark single notification as read (Self-scoped owner check)
 * @route   PUT /api/notifications/:id/mark-read
 * @access  Private (Owner only)
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      _id: id,
      user_id: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.is_read = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all unread in-app notifications as read for current user
 * @route   PUT /api/notifications/mark-all-read
 * @access  Private (All authenticated users)
 */
const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      {
        user_id: userId,
        channel: 'IN_APP',
        is_read: false
      },
      {
        $set: { is_read: true }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      modified_count: result.modifiedCount
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read',
      error: error.message
    });
  }
};

/**
 * @desc    Get notification history of any user (Super Admin support view)
 * @route   GET /api/notifications/user/:userId
 * @access  Private (Super Admin only)
 */
const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { channel, is_read, page = 1, limit = 50 } = req.query;

    const filter = { user_id: userId };
    if (channel) filter.channel = channel;
    if (is_read !== undefined) filter.is_read = is_read === 'true' || is_read === true;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      user_id: userId,
      count: notifications.length,
      total,
      notifications
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user notifications',
      error: error.message
    });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserNotifications
};
