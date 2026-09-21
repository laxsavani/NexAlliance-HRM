const express = require('express');
const router = express.Router();
const {
  getAttendanceReport,
  exportAttendanceReportCSV,
  getLeaveBalanceReport,
  getLeaveLedgerReport,
  getLeaveUtilizationReport,
  getShortLeaveUsageReport,
  getLopReport,
  getPayrollRegisterReport,
  exportPayrollRegisterCSV,
  getAuditSummaryReport
} = require('../controllers/reportController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Reports & Analytics
 *   description: Executive and administrative read-only aggregation reports across Attendance, Leaves, Payroll, and Audit
 */

router.use(protect);

/**
 * @swagger
 * /api/reports/attendance:
 *   get:
 *     summary: Get Attendance Summary Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
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
 *         name: department_id
 *         schema: { type: string }
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Attendance summary data
 *       403:
 *         description: Access Denied (Employee restricted)
 */
router.get('/attendance', getAttendanceReport);

/**
 * @swagger
 * /api/reports/attendance/export:
 *   get:
 *     summary: Export Attendance Summary Report as CSV (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *       - in: query
 *         name: branch_id
 *         schema: { type: string }
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *       403:
 *         description: Access Denied
 */
router.get('/attendance/export', exportAttendanceReportCSV);

/**
 * @swagger
 * /api/reports/leave-balance:
 *   get:
 *     summary: Get Leave Balance Report by Year/Month/Department (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 9 }
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Leave balance data across employees
 *       403:
 *         description: Access Denied
 */
router.get('/leave-balance', getLeaveBalanceReport);

/**
 * @swagger
 * /api/reports/leave-ledger:
 *   get:
 *     summary: Get Leave Ledger History Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *       - in: query
 *         name: leave_type_id
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Leave ledger transaction history
 *       403:
 *         description: Access Denied
 */
router.get('/leave-ledger', getLeaveLedgerReport);

/**
 * @swagger
 * /api/reports/leave-utilization:
 *   get:
 *     summary: Get Leave Utilization Percentage Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Utilization percentages per leave type
 *       403:
 *         description: Access Denied
 */
router.get('/leave-utilization', getLeaveUtilizationReport);

/**
 * @swagger
 * /api/reports/short-leave-usage:
 *   get:
 *     summary: Get Monthly Short Leave Usage Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 9 }
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Short leave application counts and duration per employee
 *       403:
 *         description: Access Denied
 */
router.get('/short-leave-usage', getShortLeaveUsageReport);

/**
 * @swagger
 * /api/reports/lop:
 *   get:
 *     summary: Get Loss of Pay (LOP) Days Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: LOP, absent, and late deduction breakdown per employee
 *       403:
 *         description: Access Denied
 */
router.get('/lop', getLopReport);

/**
 * @swagger
 * /api/reports/payroll-register:
 *   get:
 *     summary: Get Company-wide Payroll Register Report (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detailed payroll register entries
 *       403:
 *         description: Access Denied
 */
router.get('/payroll-register', getPayrollRegisterReport);

/**
 * @swagger
 * /api/reports/payroll-register/export:
 *   get:
 *     summary: Export Payroll Register Report as CSV (Super Admin / CEO / CTO)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: cycle_id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file download of payroll register
 *         content:
 *           text/csv:
 *             schema: { type: string }
 *       403:
 *         description: Access Denied
 */
router.get('/payroll-register/export', exportPayrollRegisterCSV);

/**
 * @swagger
 * /api/reports/audit-summary:
 *   get:
 *     summary: Get System-wide Audit Summary Report (SUPER_ADMIN ONLY)
 *     tags: [Reports & Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: module
 *         schema: { type: string, example: 'PAYROLL' }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Audit log breakdown and recent entries
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.get('/audit-summary', getAuditSummaryReport);

module.exports = router;
