const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} = require('../controllers/departmentController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Department Master
 *   description: Organization Department Master management
 */

router.use(protect);

/**
 * @swagger
 * /api/departments:
 *   get:
 *     summary: Get all departments
 *     tags: [Department Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of departments
 *   post:
 *     summary: Create new department (Super Admin only)
 *     tags: [Department Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, code]
 *             properties:
 *               name: { type: string, example: 'Engineering' }
 *               code: { type: string, example: 'ENG' }
 *               head: { type: string, example: '66ebc1234567890abcdef123' }
 *               parent_id: { type: string }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Department created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getDepartments)
  .post(checkPermission('MASTERS', 'CREATE'), createDepartment);

/**
 * @swagger
 * /api/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Department Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department details
 *   put:
 *     summary: Update department (Super Admin only)
 *     tags: [Department Master]
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
 *               code: { type: string }
 *               head: { type: string }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Department updated
 *   delete:
 *     summary: "Deactivate department (Soft-delete, Super Admin only)"
 *     tags: [Department Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Department deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getDepartmentById)
  .put(checkPermission('MASTERS', 'EDIT'), updateDepartment)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteDepartment);

module.exports = router;
