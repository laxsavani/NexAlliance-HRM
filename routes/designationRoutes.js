const express = require('express');
const router = express.Router();
const {
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation
} = require('../controllers/designationController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Designation Master
 *   description: Organization Designation / Job Role Master management
 */

router.use(protect);

/**
 * @swagger
 * /api/designations:
 *   get:
 *     summary: Get all designations
 *     tags: [Designation Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: department_id
 *         schema: { type: string }
 *         description: Filter by department
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of designations
 *   post:
 *     summary: Create new designation (Super Admin only)
 *     tags: [Designation Master]
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
 *               name: { type: string, example: 'Lead Architect' }
 *               code: { type: string, example: 'LA' }
 *               department_id: { type: string }
 *               level: { type: number, example: 2 }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Designation created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getDesignations)
  .post(checkPermission('MASTERS', 'CREATE'), createDesignation);

/**
 * @swagger
 * /api/designations/{id}:
 *   get:
 *     summary: Get designation by ID
 *     tags: [Designation Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Designation details
 *   put:
 *     summary: Update designation (Super Admin only)
 *     tags: [Designation Master]
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
 *               level: { type: number }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Designation updated
 *   delete:
 *     summary: Deactivate designation (Soft-delete, Super Admin only)
 *     tags: [Designation Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Designation deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getDesignationById)
  .put(checkPermission('MASTERS', 'EDIT'), updateDesignation)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteDesignation);

module.exports = router;
