const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getLeaves,
  getLeaveById,
  getLeaveBalance,
  approveLeave,
  rejectLeave,
  cancelLeave,
  adjustBalance,
  overrideLeaveDecision
} = require('../controllers/leaveController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Leave Management
 *   description: Leave application, balance tracking, ledger history, and Dual CEO+CTO approval workflow
 */

router.use(protect);

/**
 * @swagger
 * /api/leaves/balance:
 *   get:
 *     summary: "Get Leave Balances (Scope enforced: ALL / OWN)"
 *     tags: [Leave Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 9 }
 *     responses:
 *       200:
 *         description: List of leave balances per type
 *       403:
 *         description: Access Denied (Scope violation)
 */
router.get('/balance', checkPermission('LEAVE', 'VIEW'), getLeaveBalance);

/**
 * @swagger
 * /api/leaves/adjust-balance:
 *   post:
 *     summary: "Manual Leave Balance Adjustment (Super Admin ONLY)"
 *     tags: [Leave Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, leave_type_id, year, qty, reason]
 *             properties:
 *               user_id: { type: string }
 *               leave_type_id: { type: string }
 *               year: { type: integer, example: 2026 }
 *               month: { type: integer, example: 9 }
 *               qty: { type: number, example: 2 }
 *               reason: { type: string, example: 'Compensatory off credit for weekend server migration' }
 *     responses:
 *       200:
 *         description: Leave balance adjusted and recorded in ledger
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.post('/adjust-balance', adjustBalance);

/**
 * @swagger
 * /api/leaves:
 *   post:
 *     summary: "Apply for Leave (Employee, CEO, CTO)"
 *     tags: [Leave Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leave_type_id, from_date, to_date, reason]
 *             properties:
 *               leave_type_id: { type: string }
 *               from_date: { type: string, example: '25/09/2026' }
 *               to_date: { type: string, example: '26/09/2026' }
 *               day_part: { type: string, enum: ['FULL', 'FIRST_HALF', 'SECOND_HALF', 'SHORT'], default: 'FULL' }
 *               from_time: { type: string, example: '10:00' }
 *               to_time: { type: string, example: '11:30' }
 *               reason: { type: string, example: 'Family personal function' }
 *               attachment_url: { type: string }
 *     responses:
 *       201:
 *         description: Leave application submitted and pending approval
 *       400:
 *         description: Validation error or insufficient balance
 *       403:
 *         description: Super Admin is exempt and blocked from applying
 *   get:
 *     summary: "Get Leave Requests (Scope enforced: ALL / OWN)"
 *     tags: [Leave Management]
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
 *         name: leave_type_id
 *         schema: { type: string }
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
 *         description: List of leave requests
 *       403:
 *         description: Access Denied (Scope violation)
 */
router.route('/')
  .post(checkPermission('LEAVE', 'APPLY'), applyLeave)
  .get(checkPermission('LEAVE', 'VIEW'), getLeaves);

/**
 * @swagger
 * /api/leaves/{id}:
 *   get:
 *     summary: "Get Leave Request by ID"
 *     tags: [Leave Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave request details
 *       403:
 *         description: Access Denied (Scope violation)
 *       404:
 *         description: Request not found
 */
router.get('/:id', checkPermission('LEAVE', 'VIEW'), getLeaveById);

/**
 * @swagger
 * /api/leaves/{id}/override-decision:
 *   put:
 *     summary: "Super Admin Emergency Override (Approve or Reject)"
 *     tags: [Leave Management]
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
 *             required: [decision, reason]
 *             properties:
 *               decision: { type: string, enum: ['APPROVED', 'REJECTED'] }
 *               reason: { type: string, example: 'Emergency CEO medical absence override' }
 *     responses:
 *       200:
 *         description: Leave request overridden successfully
 *       400:
 *         description: Missing reason, invalid status, or invalid decision
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.put('/:id/override-decision', overrideLeaveDecision);

/**
 * @swagger
 * /api/leaves/{id}/approve:
 *   put:
 *     summary: "Approve Leave Request (Dual CEO+CTO Approvers & Super Admin Override)"
 *     tags: [Leave Management]
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
 *               remark: { type: string, example: 'Approved' }
 *     responses:
 *       200:
 *         description: Approval recorded (Final or Partial)
 *       400:
 *         description: Already acted or invalid status
 *       403:
 *         description: Caller is not in assigned approvers list
 */
router.put('/:id/approve', checkPermission('LEAVE', 'APPROVE'), approveLeave);

/**
 * @swagger
 * /api/leaves/{id}/reject:
 *   put:
 *     summary: "Reject Leave Request (Immediate rejection on single reject)"
 *     tags: [Leave Management]
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
 *             required: [remark]
 *             properties:
 *               remark: { type: string, example: 'Critical sprint delivery scheduled on these dates' }
 *     responses:
 *       200:
 *         description: Leave request rejected and held pending balance released
 *       400:
 *         description: Missing remark or invalid status
 *       403:
 *         description: Caller is not in assigned approvers list
 */
router.put('/:id/reject', checkPermission('LEAVE', 'REJECT'), rejectLeave);

/**
 * @swagger
 * /api/leaves/{id}/cancel:
 *   put:
 *     summary: "Cancel Leave Request (Requester for Pending/Future Approved; Super Admin for Past Approved)"
 *     tags: [Leave Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave cancelled and balance restored/released
 *       400:
 *         description: Request already processed / invalid state
 *       403:
 *         description: Access Denied
 */
router.put('/:id/cancel', cancelLeave);

module.exports = router;
