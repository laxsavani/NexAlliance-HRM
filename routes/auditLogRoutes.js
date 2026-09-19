const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditLogController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Audit Logs
 *   description: System-wide audit trail and compliance activity logs
 */

router.use(protect);

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Retrieve system audit logs (Super Admin only)
 *     tags: [Audit Logs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *         description: Filter by user ID
 *       - in: query
 *         name: module
 *         schema: { type: string }
 *         description: Filter by module (EMPLOYEE, MASTERS, ROLE, AUTH, etc.)
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filter by action (CREATE, UPDATE, DELETE, LOGIN, etc.)
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated audit log records
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.get('/', checkPermission('AUDIT', 'VIEW'), getAuditLogs);

module.exports = router;
