const express = require('express');
const router = express.Router();
const {
  getSalaryComponents,
  createSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent
} = require('../controllers/salaryComponentController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Payroll Management
 *   description: Salary components, salary structures, payroll cycles, LOP calculations, approval flow, and payslips
 */

router.use(protect);

/**
 * @swagger
 * /api/salary-components:
 *   get:
 *     summary: "Get all Salary Components (Super Admin / CEO / CTO)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: ['EARNING', 'DEDUCTION'] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of salary components
 *       403:
 *         description: Access Denied
 *   post:
 *     summary: "Create Salary Component (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, calc_type]
 *             properties:
 *               name: { type: string, example: 'House Rent Allowance (HRA)' }
 *               type: { type: string, enum: ['EARNING', 'DEDUCTION'], example: 'EARNING' }
 *               calc_type: { type: string, enum: ['FIXED', 'PERCENT_OF_BASIC', 'FORMULA'], example: 'PERCENT_OF_BASIC' }
 *               value: { type: number, example: 40 }
 *               taxable: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Component created
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.route('/')
  .get(getSalaryComponents)
  .post(createSalaryComponent);

/**
 * @swagger
 * /api/salary-components/{id}:
 *   put:
 *     summary: "Update Salary Component (Super Admin ONLY)"
 *     tags: [Payroll Management]
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
 *               type: { type: string, enum: ['EARNING', 'DEDUCTION'] }
 *               calc_type: { type: string, enum: ['FIXED', 'PERCENT_OF_BASIC', 'FORMULA'] }
 *               value: { type: number }
 *               taxable: { type: boolean }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Component updated
 *       403:
 *         description: Access Denied
 *   delete:
 *     summary: "Soft Delete Salary Component (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Component deactivated (status = Inactive)
 *       403:
 *         description: Access Denied
 */
router.route('/:id')
  .put(updateSalaryComponent)
  .delete(deleteSalaryComponent);

module.exports = router;
