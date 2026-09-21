const express = require('express');
const router = express.Router();
const {
  getLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
} = require('../controllers/leaveTypeController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Leave Type Master
 *   description: Leave policy types (Short Leave, Unpaid Leave, Casual/Sick/Paid/Comp-off)
 */

router.use(protect);

/**
 * @swagger
 * /api/leave-types:
 *   get:
 *     summary: Get all leave types
 *     tags: [Leave Type Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of leave types
 *   post:
 *     summary: Create new leave type (Super Admin only)
 *     tags: [Leave Type Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties:
 *               code: { type: string, example: 'CL' }
 *               name: { type: string, example: 'Casual Leave' }
 *               is_paid: { type: boolean, example: true }
 *               quota: { type: number, example: 12 }
 *               quota_period: { type: string, enum: ['MONTH', 'YEAR'], example: 'YEAR' }
 *               carry_forward: { type: boolean, example: false }
 *               deduct_salary: { type: boolean, example: false }
 *               max_duration_minutes: { type: number, example: null }
 *               half_day_allowed: { type: boolean, example: true }
 *               needs_attachment: { type: boolean, example: false }
 *               notice_days: { type: number, example: 2 }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Leave type created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getLeaveTypes)
  .post(checkPermission('MASTERS', 'CREATE'), createLeaveType);

/**
 * @swagger
 * /api/leave-types/{id}:
 *   get:
 *     summary: Get leave type by ID
 *     tags: [Leave Type Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave type details
 *   put:
 *     summary: Update leave type (Super Admin only)
 *     tags: [Leave Type Master]
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
 *               name: { type: string }
 *               quota: { type: number }
 *               is_paid: { type: boolean }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Leave type updated
 *   delete:
 *     summary: Deactivate leave type (Soft-delete, Super Admin only)
 *     tags: [Leave Type Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave type deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getLeaveTypeById)
  .put(checkPermission('MASTERS', 'EDIT'), updateLeaveType)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteLeaveType);

module.exports = router;
