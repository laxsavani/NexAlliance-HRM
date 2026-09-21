const express = require('express');
const router = express.Router();
const {
  applyRegularization,
  getRegularizations,
  getRegularizationById,
  approveRegularization,
  rejectRegularization,
  cancelRegularization
} = require('../controllers/regularizationController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Attendance Regularization
 *   description: Attendance correction requests and Super Admin exclusive approval workflow
 */

router.use(protect);

/**
 * @swagger
 * /api/regularizations:
 *   post:
 *     summary: "Apply for Attendance Regularization (Employee, CEO, CTO)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, req_in, req_out, reason_id]
 *             properties:
 *               date: { type: string, example: '15/09/2026' }
 *               req_in: { type: string, format: date-time, example: '2026-09-15T04:30:00.000Z' }
 *               req_out: { type: string, format: date-time, example: '2026-09-15T13:00:00.000Z' }
 *               reason_id: { type: string, example: '66ebc1234567890abcdef123' }
 *               remark: { type: string, example: 'Biometric fingerprint device failed' }
 *     responses:
 *       201:
 *         description: Regularization request submitted successfully
 *       400:
 *         description: Validation error, duplicate pending request, or window limit exceeded
 *       403:
 *         description: Super Admin is exempt and blocked from applying
 *   get:
 *     summary: "Get Regularization Requests (Scope enforced: ALL / OWN)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'] }
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '01/09/2026' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '30/09/2026' }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of regularization requests
 *       403:
 *         description: Access Denied (Scope violation)
 */
router.route('/')
  .post(checkPermission('REGULARIZATION', 'APPLY'), applyRegularization)
  .get(checkPermission('REGULARIZATION', 'VIEW'), getRegularizations);

/**
 * @swagger
 * /api/regularizations/{id}:
 *   get:
 *     summary: "Get Regularization Request by ID (Includes daily attendance & punch logs context)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detailed regularization request with attendance context
 *       403:
 *         description: Access Denied (Scope violation)
 *       404:
 *         description: Request not found
 */
router.get('/:id', checkPermission('REGULARIZATION', 'VIEW'), getRegularizationById);

/**
 * @swagger
 * /api/regularizations/{id}/approve:
 *   put:
 *     summary: "Approve Regularization Request (Super Admin ONLY)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               decision_remark: { type: string, example: 'Approved after verification' }
 *     responses:
 *       200:
 *         description: Request approved, AttendanceDaily updated to Regularized, and late counter recalculated
 *       400:
 *         description: Request is not in Pending status
 *       403:
 *         description: Access Denied (Super Admin only - CEO/CTO get 403)
 */
router.put('/:id/approve', checkPermission('REGULARIZATION', 'APPROVE'), approveRegularization);

/**
 * @swagger
 * /api/regularizations/{id}/reject:
 *   put:
 *     summary: "Reject Regularization Request (Super Admin ONLY)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [decision_remark]
 *             properties:
 *               decision_remark: { type: string, example: 'Punch logs show absent from campus' }
 *     responses:
 *       200:
 *         description: Request rejected and AttendanceDaily left untouched
 *       400:
 *         description: Missing decision remark or invalid status
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.put('/:id/reject', checkPermission('REGULARIZATION', 'REJECT'), rejectRegularization);

/**
 * @swagger
 * /api/regularizations/{id}/cancel:
 *   put:
 *     summary: "Cancel Regularization Request (Original Requester ONLY, Pending ONLY)"
 *     tags: [Attendance Regularization]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request cancelled successfully
 *       400:
 *         description: Request already processed and cannot be cancelled
 *       403:
 *         description: Access Denied (Only requester can cancel)
 */
router.put('/:id/cancel', cancelRegularization);

module.exports = router;
