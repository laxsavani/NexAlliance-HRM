const express = require('express');
const router = express.Router();
const {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
} = require('../controllers/shiftController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Shift & Late Policy Master
 *   description: Office Shifts, Work Hours, Grace Time, and Late Mark Penalties
 */

router.use(protect);

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: Get all shift definitions
 *     tags: [Shift & Late Policy Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of shifts
 *   post:
 *     summary: Create a new shift & late policy (Super Admin only)
 *     tags: [Shift & Late Policy Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: 'General Day Shift' }
 *               start_time: { type: string, example: '10:00' }
 *               end_time: { type: string, example: '18:30' }
 *               grace_in_min: { type: number, example: 10 }
 *               monthly_late_allowed: { type: number, example: 3 }
 *               late_action: { type: string, enum: ['DEDUCT', 'FLAG'], example: 'DEDUCT' }
 *               late_deduct_days: { type: number, example: 0.5 }
 *               half_day_hrs: { type: number, example: 4 }
 *               full_day_hrs: { type: number, example: 8 }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Shift created successfully
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getShifts)
  .post(checkPermission('MASTERS', 'CREATE'), createShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: Get shift by ID
 *     tags: [Shift & Late Policy Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shift details
 *   put:
 *     summary: Update shift & late policy (Super Admin only)
 *     tags: [Shift & Late Policy Master]
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
 *               start_time: { type: string }
 *               end_time: { type: string }
 *               grace_in_min: { type: number }
 *               monthly_late_allowed: { type: number }
 *               late_action: { type: string, enum: ['DEDUCT', 'FLAG'] }
 *               late_deduct_days: { type: number }
 *               half_day_hrs: { type: number }
 *               full_day_hrs: { type: number }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Shift updated
 *   delete:
 *     summary: "Deactivate shift (Soft-delete, Super Admin only)"
 *     tags: [Shift & Late Policy Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Shift deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getShiftById)
  .put(checkPermission('MASTERS', 'EDIT'), updateShift)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteShift);

module.exports = router;
