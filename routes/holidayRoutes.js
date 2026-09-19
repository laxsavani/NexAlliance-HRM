const express = require('express');
const router = express.Router();
const {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidayController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Holiday & Weekly Off Calendar
 *   description: Company Holiday Calendar and Location-specific Weekly Offs
 */

router.use(protect);

/**
 * @swagger
 * /api/holidays:
 *   get:
 *     summary: Get all holidays & weekly-offs
 *     tags: [Holiday & Weekly Off Calendar]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: branch_id
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: ['HOLIDAY', 'WEEKLY_OFF'] }
 *     responses:
 *       200:
 *         description: List of holidays and weekly offs
 *   post:
 *     summary: Add holiday / weekly off (Super Admin only)
 *     tags: [Holiday & Weekly Off Calendar]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date, name]
 *             properties:
 *               date: { type: string, example: '26/01/2026' }
 *               name: { type: string, example: 'Republic Day' }
 *               type: { type: string, enum: ['HOLIDAY', 'WEEKLY_OFF'], example: 'HOLIDAY' }
 *               branch_id: { type: string, example: null }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Holiday created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getHolidays)
  .post(checkPermission('MASTERS', 'CREATE'), createHoliday);

/**
 * @swagger
 * /api/holidays/{id}:
 *   get:
 *     summary: Get holiday by ID
 *     tags: [Holiday & Weekly Off Calendar]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Holiday details
 *   put:
 *     summary: Update holiday entry (Super Admin only)
 *     tags: [Holiday & Weekly Off Calendar]
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
 *               date: { type: string }
 *               name: { type: string }
 *               type: { type: string, enum: ['HOLIDAY', 'WEEKLY_OFF'] }
 *               branch_id: { type: string }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Holiday updated
 *   delete:
 *     summary: "Deactivate holiday (Soft-delete, Super Admin only)"
 *     tags: [Holiday & Weekly Off Calendar]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Holiday deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getHolidayById)
  .put(checkPermission('MASTERS', 'EDIT'), updateHoliday)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteHoliday);

module.exports = router;
