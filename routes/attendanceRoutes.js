const express = require('express');
const router = express.Router();
const {
  clockIn,
  clockOut,
  getAttendance,
  getLateSummary,
  exportAttendance,
  manualEditAttendance,
  triggerDailyJob
} = require('../controllers/attendanceController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Attendance Engine
 *   description: Clock In/Out, Geofencing, Late Mark Counter, Daily Status Reconciliation, and Reports
 */

router.use(protect);

/**
 * @swagger
 * /api/attendance/clock-in:
 *   post:
 *     summary: "Perform Clock-In (Employee, CEO, CTO - Super Admin is exempt)"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lat: { type: number, example: 21.1702 }
 *               lng: { type: number, example: 72.8311 }
 *               source: { type: string, enum: ['WEB', 'MOBILE'], example: 'WEB' }
 *               device_info: { type: string, example: 'Chrome on Windows 11' }
 *     responses:
 *       200:
 *         description: Clock-in recorded with Late Mark evaluation
 *       400:
 *         description: Geo-fence validation failed
 *       403:
 *         description: Super Admin is exempt and blocked from clocking in
 */
router.post('/clock-in', checkPermission('ATTENDANCE', 'CLOCK_IN'), clockIn);

/**
 * @swagger
 * /api/attendance/clock-out:
 *   post:
 *     summary: "Perform Clock-Out"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lat: { type: number, example: 21.1702 }
 *               lng: { type: number, example: 72.8311 }
 *               source: { type: string, enum: ['WEB', 'MOBILE'], example: 'WEB' }
 *     responses:
 *       200:
 *         description: Clock-out recorded and work hours calculated
 *       403:
 *         description: Super Admin is exempt
 */
router.post('/clock-out', checkPermission('ATTENDANCE', 'CLOCK_OUT'), clockOut);

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: "Get Daily Attendance Records (Scope-enforced: ALL / DEPT / OWN)"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Present', 'Half Day', 'Absent', 'Leave', 'Holiday', 'Week Off', 'Late', 'Incomplete', 'Regularized'] }
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
 *         schema: { type: integer, default: 31 }
 *     responses:
 *       200:
 *         description: List of daily attendance state records
 *       403:
 *         description: Access Denied (Scope violation)
 */
router.get('/', checkPermission('ATTENDANCE', 'VIEW'), getAttendance);

/**
 * @swagger
 * /api/attendance/late-summary:
 *   get:
 *     summary: "Get Monthly Late Counter & LOP Deduction Days"
 *     tags: [Attendance Engine]
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
 *         description: Rolling late summary (late_count, allowed, extra_lates, deduction_days)
 */
router.get('/late-summary', checkPermission('ATTENDANCE', 'VIEW'), getLateSummary);

/**
 * @swagger
 * /api/attendance/export:
 *   get:
 *     summary: "Export Attendance Report to CSV/JSON (Super Admin, CEO, CTO only)"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, example: '01/09/2026' }
 *       - in: query
 *         name: to
 *         schema: { type: string, example: '30/09/2026' }
 *       - in: query
 *         name: branch_id
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: ['json', 'csv'], default: 'json' }
 *     responses:
 *       200:
 *         description: Attendance export dataset
 *       403:
 *         description: Access Denied (Employee cannot export)
 */
router.get('/export', checkPermission('REPORTS', 'EXPORT'), exportAttendance);

/**
 * @swagger
 * /api/attendance/{userId}/{date}:
 *   put:
 *     summary: "Manual Admin Attendance Edit (Super Admin only - Recalculates Late Status)"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, example: '19/09/2026' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_in: { type: string, format: date-time }
 *               last_out: { type: string, format: date-time }
 *               status: { type: string, enum: ['Present', 'Half Day', 'Absent', 'Late', 'Incomplete', 'Regularized'] }
 *               is_late: { type: boolean }
 *               remarks: { type: string }
 *     responses:
 *       200:
 *         description: Attendance record updated and monthly late summary recalculated
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.put('/:userId/:date', checkPermission('ATTENDANCE', 'EDIT'), manualEditAttendance);

/**
 * @swagger
 * /api/attendance/run-daily-job:
 *   post:
 *     summary: "Trigger End-of-Day Attendance Reconciliation Job (Super Admin only)"
 *     tags: [Attendance Engine]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, example: '19/09/2026' }
 *     responses:
 *       200:
 *         description: Daily status reconciliation job executed
 */
router.post('/run-daily-job', checkPermission('ATTENDANCE', 'EDIT'), triggerDailyJob);

module.exports = router;
