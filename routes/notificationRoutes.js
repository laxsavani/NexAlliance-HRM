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

// Self-scoped routes for all authenticated users
router.get('/', getMyNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllNotificationsAsRead);
router.put('/:id/mark-read', markNotificationAsRead);

// Super Admin support view
router.get('/user/:userId', requireSuperAdmin, getUserNotifications);

module.exports = router;
