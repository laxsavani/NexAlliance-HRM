const express = require('express');
const router = express.Router();
const {
  createPayrollCycle,
  getPayrollCycles,
  processPayroll,
  getPayrollRuns,
  approvePayrollCycle,
  releasePayrollCycle,
  markPaidPayrollCycle,
  reopenPayrollCycle
} = require('../controllers/payrollController');
const { protect } = require('../middlewares/auth');

router.use(protect);

/**
 * @swagger
 * /api/payroll/cycles:
 *   post:
 *     summary: "Create Payroll Cycle (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [month, year, from_date, to_date]
 *             properties:
 *               month: { type: integer, example: 9 }
 *               year: { type: integer, example: 2026 }
 *               from_date: { type: string, example: '01/09/2026' }
 *               to_date: { type: string, example: '30/09/2026' }
 *               cut_off: { type: string, example: '25/09/2026' }
 *               pay_date: { type: string, example: '01/10/2026' }
 *     responses:
 *       201:
 *         description: Payroll cycle created
 *       403:
 *         description: Access Denied
 *   get:
 *     summary: "Get Payroll Cycles (Super Admin / CEO / CTO)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of payroll cycles
 */
router.route('/cycles')
  .post(createPayrollCycle)
  .get(getPayrollCycles);

/**
 * @swagger
 * /api/payroll/process:
 *   post:
 *     summary: "Process Monthly Payroll (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cycle_id]
 *             properties:
 *               cycle_id: { type: string, example: '66ebc1234567890abcdef123' }
 *     responses:
 *       200:
 *         description: Payroll processed for all active non-exempt employees
 *       400:
 *         description: Cycle is locked
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.post('/process', processPayroll);

/**
 * @swagger
 * /api/payroll/{cycleId}/runs:
 *   get:
 *     summary: "Get Employee Payroll Runs for a Cycle (Super Admin / CEO / CTO)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of calculated employee payroll runs
 */
router.get('/:cycleId/runs', getPayrollRuns);

/**
 * @swagger
 * /api/payroll/{cycleId}/approve:
 *   put:
 *     summary: "Approve Payroll Cycle (Super Admin / CEO / CTO - ALL scope)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payroll cycle approved and locked
 *       403:
 *         description: Access Denied
 */
router.put('/:cycleId/approve', approvePayrollCycle);

/**
 * @swagger
 * /api/payroll/{cycleId}/release:
 *   put:
 *     summary: "Release Payslips for a Cycle (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payslips released and notification emails queued
 *       403:
 *         description: Access Denied
 */
router.put('/:cycleId/release', releasePayrollCycle);

/**
 * @swagger
 * /api/payroll/{cycleId}/mark-paid:
 *   put:
 *     summary: "Mark Payroll Cycle as Paid (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bank_advice_ref: { type: string, example: 'HDFC-ADV-2026-09-001' }
 *     responses:
 *       200:
 *         description: Payroll marked as Paid
 *       403:
 *         description: Access Denied
 */
router.put('/:cycleId/mark-paid', markPaidPayrollCycle);

/**
 * @swagger
 * /api/payroll/{cycleId}/reopen:
 *   put:
 *     summary: "Reopen Locked Payroll Cycle (Super Admin ONLY, Mandatory Reason)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cycleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: 'Corrections required for late mark regularization' }
 *     responses:
 *       200:
 *         description: Payroll cycle reopened to Draft and unlocked
 *       400:
 *         description: Missing mandatory reason
 *       403:
 *         description: Access Denied
 */
router.put('/:cycleId/reopen', reopenPayrollCycle);

module.exports = router;
