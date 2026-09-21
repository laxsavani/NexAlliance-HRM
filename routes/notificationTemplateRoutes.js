const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  getNotificationTemplates,
  createNotificationTemplate,
  updateNotificationTemplate,
  deleteNotificationTemplate
} = require('../controllers/notificationTemplateController');

// Middleware to ensure Super Admin access for template editing
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.role_id || req.user.role_id.code !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Super Admin role required for Notification Template management'
    });
  }
  next();
};

router.use(protect);
router.use(requireSuperAdmin);

/**
 * @swagger
 * tags:
 *   name: Notification Templates
 *   description: Notification template configuration (Super Admin only)
 */

router.route('/')
  .get(getNotificationTemplates)
  .post(createNotificationTemplate);

router.route('/:id')
  .put(updateNotificationTemplate)
  .delete(deleteNotificationTemplate);

module.exports = router;
