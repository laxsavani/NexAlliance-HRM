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

/**
 * @swagger
 * /api/notification-templates:
 *   get:
 *     summary: "Get all Notification Templates (Super Admin only)"
 *     tags: [Notification Templates]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema: { type: string, enum: ['EMAIL', 'IN_APP'] }
 *         description: Filter by delivery channel
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *         description: Filter by status
 *       - in: query
 *         name: event
 *         schema: { type: string }
 *         description: Filter by event code (e.g. LEAVE_APPROVED)
 *     responses:
 *       200:
 *         description: List of configured notification templates
 *       403:
 *         description: Access Denied (Super Admin only)
 *   post:
 *     summary: "Create a new Notification Template (Super Admin only)"
 *     tags: [Notification Templates]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event, channel, body]
 *             properties:
 *               event:
 *                 type: string
 *                 example: "CUSTOM_ANNOUNCEMENT"
 *                 description: Unique event code
 *               channel:
 *                 type: string
 *                 enum: ['EMAIL', 'IN_APP']
 *                 example: "IN_APP"
 *               subject:
 *                 type: string
 *                 example: "Important Announcement: {{employee_name}}"
 *                 description: Subject line for Email channel (ignored for IN_APP)
 *               body:
 *                 type: string
 *                 example: "Dear {{employee_name}}, here is an update regarding {{topic}}."
 *                 description: Template body text with {{placeholder}} tokens
 *               status:
 *                 type: string
 *                 enum: ['Active', 'Inactive']
 *                 default: "Active"
 *     responses:
 *       201:
 *         description: Notification template created successfully
 *       400:
 *         description: Missing required fields or duplicate event+channel pair
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.route('/')
  .get(getNotificationTemplates)
  .post(createNotificationTemplate);

/**
 * @swagger
 * /api/notification-templates/{id}:
 *   put:
 *     summary: "Update Notification Template (Super Admin only)"
 *     tags: [Notification Templates]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Notification template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *                 example: "Updated Subject for {{employee_name}}"
 *               body:
 *                 type: string
 *                 example: "Updated body text for {{employee_name}}."
 *               status:
 *                 type: string
 *                 enum: ['Active', 'Inactive']
 *     responses:
 *       200:
 *         description: Notification template updated successfully
 *       404:
 *         description: Notification template not found
 *       403:
 *         description: Access Denied
 *   delete:
 *     summary: "Soft Delete / Deactivate Notification Template (Super Admin only)"
 *     tags: [Notification Templates]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification template deactivated (status = Inactive)
 *       404:
 *         description: Notification template not found
 *       403:
 *         description: Access Denied
 */
router.route('/:id')
  .put(updateNotificationTemplate)
  .delete(deleteNotificationTemplate);

module.exports = router;
