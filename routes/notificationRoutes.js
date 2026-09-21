const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserNotifications
} = require('../controllers/notificationController');

// Super Admin guard middleware for support route
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.role_id || req.user.role_id.code !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Super Admin role required to view other user notification logs'
    });
  }
  next();
};

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: In-app notification inbox and admin support log viewer
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: "Get Current User's In-App Notifications (Self-scoped)"
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_read
 *         schema: { type: boolean }
 *         description: Filter by read/unread status
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: ['IN_APP', 'EMAIL'], default: 'IN_APP' }
 *         description: Filter by channel
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated in-app notification inbox list
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMyNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: "Get Current User's Unread In-App Notifications Count (Self-scoped)"
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread notification count for badge display
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 unread_count: { type: integer, example: 3 }
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count', getUnreadCount);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   put:
 *     summary: "Mark All Unread In-App Notifications as Read (Self-scoped)"
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All unread in-app notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "All notifications marked as read" }
 *                 modified_count: { type: integer, example: 3 }
 *       401:
 *         description: Unauthorized
 */
router.put('/mark-all-read', markAllNotificationsAsRead);

/**
 * @swagger
 * /api/notifications/{id}/mark-read:
 *   put:
 *     summary: "Mark Single Notification as Read (Self-scoped owner check)"
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found or belongs to another user
 *       401:
 *         description: Unauthorized
 */
router.put('/:id/mark-read', markNotificationAsRead);

/**
 * @swagger
 * /api/notifications/user/{userId}:
 *   get:
 *     summary: "Get User Notification History (Super Admin Troubleshooting view)"
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         description: Target user ID
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: ['IN_APP', 'EMAIL'] }
 *       - in: query
 *         name: is_read
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Full notification history for target user
 *       403:
 *         description: Access Denied (Super Admin only)
 *       401:
 *         description: Unauthorized
 */
router.get('/user/:userId', requireSuperAdmin, getUserNotifications);

module.exports = router;
