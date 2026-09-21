const express = require('express');
const router = express.Router();
const {
  getApprovalMatrix,
  createApprovalMatrixRow,
  updateApprovalMatrixRow,
  deleteApprovalMatrixRow
} = require('../controllers/approvalMatrixController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Approval Matrix
 *   description: Configurable 3-tier Approval Chains (User, Department, Role) & Mapping Screen
 */

router.use(protect);

/**
 * @swagger
 * /api/approval-matrix:
 *   get:
 *     summary: "Get Approval Matrix Mappings (Super Admin, CEO, CTO)"
 *     tags: [Approval Matrix]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: requester_type
 *         schema: { type: string, enum: ['USER', 'DEPARTMENT', 'ROLE'] }
 *       - in: query
 *         name: requester_ref
 *         schema: { type: string }
 *       - in: query
 *         name: module
 *         schema: { type: string, enum: ['LEAVE', 'REGULARIZATION'] }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of approval matrix mappings
 *       403:
 *         description: Access Denied (Employee cannot view matrix configuration)
 *   post:
 *     summary: "Create Approval Matrix Mapping (Super Admin ONLY)"
 *     tags: [Approval Matrix]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requester_type, requester_ref, module, approvers]
 *             properties:
 *               requester_type: { type: string, enum: ['USER', 'DEPARTMENT', 'ROLE'], example: 'DEPARTMENT' }
 *               requester_ref: { type: string, example: '60c72b2f9b1d8b2bad000001' }
 *               module: { type: string, enum: ['LEAVE'], example: 'LEAVE' }
 *               level_no: { type: integer, default: 1 }
 *               approvers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [approver_type, approver_ref]
 *                   properties:
 *                     approver_type: { type: string, enum: ['USER', 'ROLE'] }
 *                     approver_ref: { type: string }
 *               rule: { type: string, enum: ['ALL', 'ANY'], default: 'ALL' }
 *     responses:
 *       201:
 *         description: Mapping created
 *       400:
 *         description: Validation error / self-approval blocked / Regularization locked
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.route('/')
  .get(getApprovalMatrix)
  .post(createApprovalMatrixRow);

/**
 * @swagger
 * /api/approval-matrix/{id}:
 *   put:
 *     summary: "Update Approval Matrix Mapping (Super Admin ONLY)"
 *     tags: [Approval Matrix]
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
 *             properties:
 *               requester_type: { type: string, enum: ['USER', 'DEPARTMENT', 'ROLE'] }
 *               requester_ref: { type: string }
 *               module: { type: string, enum: ['LEAVE'] }
 *               level_no: { type: integer }
 *               approvers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     approver_type: { type: string, enum: ['USER', 'ROLE'] }
 *                     approver_ref: { type: string }
 *               rule: { type: string, enum: ['ALL', 'ANY'] }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Mapping updated
 *       400:
 *         description: Locked row cannot be modified / validation error
 *       403:
 *         description: Access Denied (Super Admin only)
 *   delete:
 *     summary: "Soft Delete Approval Matrix Mapping (Super Admin ONLY)"
 *     tags: [Approval Matrix]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "Mapping deactivated (is_active: false)"
 *       400:
 *         description: Locked row cannot be deleted
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.route('/:id')
  .put(updateApprovalMatrixRow)
  .delete(deleteApprovalMatrixRow);

module.exports = router;
