const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getSalaryStructure,
  createSalaryStructure
} = require('../controllers/salaryStructureController');
const { protect } = require('../middlewares/auth');

router.use(protect);

/**
 * @swagger
 * /api/employees/{userId}/salary-structure:
 *   get:
 *     summary: "Get Employee Salary Structure History (Super Admin / CEO / CTO)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Salary structure history for employee
 *       403:
 *         description: Access Denied (Employee cannot view structure configuration)
 *   post:
 *     summary: "Assign / Update Salary Structure for Employee (Super Admin ONLY)"
 *     tags: [Payroll Management]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [effective_from, basic]
 *             properties:
 *               effective_from: { type: string, example: '01/09/2026' }
 *               basic: { type: number, example: 35000 }
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [component_id, value]
 *                   properties:
 *                     component_id: { type: string }
 *                     value: { type: number, example: 40 }
 *     responses:
 *       201:
 *         description: New salary structure version created
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.route('/')
  .get(getSalaryStructure)
  .post(createSalaryStructure);

module.exports = router;
