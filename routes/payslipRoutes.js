const express = require('express');
const router = express.Router();
const {
  getPayslip,
  getPayslipPDF
} = require('../controllers/payrollController');
const { protect } = require('../middlewares/auth');

router.use(protect);

/**
 * @swagger
 * /api/payslips/{runId}:
 *   get:
 *     summary: "Get Payslip Details (Scope: ALL for Admin/Exec, OWN for Employee)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payslip details
 *       403:
 *         description: Access Denied (Scope violation)
 *       404:
 *         description: Payslip not found
 */
router.get('/:runId', getPayslip);

/**
 * @swagger
 * /api/payslips/{runId}/pdf:
 *   get:
 *     summary: "Download Payslip PDF (Requires status >= Released)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Binary PDF stream
 *       400:
 *         description: Payslip not yet released
 *       403:
 *         description: Access Denied
 */
router.get('/:runId/pdf', getPayslipPDF);

module.exports = router;
