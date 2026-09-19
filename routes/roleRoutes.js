const express = require('express');
const router = express.Router();
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
} = require('../controllers/roleController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Role Master
 *   description: Dynamic Role management (Super Admin, CEO, CTO, Employee, Custom Roles)
 */

router.use(protect);

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Get all system and custom roles
 *     tags: [Role Master]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *   post:
 *     summary: Create a custom role (Super Admin only)
 *     tags: [Role Master]
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
 *               name: { type: string, example: 'Project Manager' }
 *               code: { type: string, example: 'PM' }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Duplicate or invalid payload
 */
router.route('/')
  .get(checkPermission('ROLE', 'VIEW'), getRoles)
  .post(checkPermission('ROLE', 'CREATE'), createRole);

/**
 * @swagger
 * /api/roles/{id}:
 *   get:
 *     summary: Get role details by ID
 *     tags: [Role Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role details
 *       404:
 *         description: Role not found
 *   put:
 *     summary: Update custom role (Super Admin only)
 *     tags: [Role Master]
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
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Role updated
 *   delete:
 *     summary: "Deactivate role (Super Admin only, system roles & assigned roles protected)"
 *     tags: [Role Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deactivated (soft-delete)
 *       400:
 *         description: Blocked (System role or assigned to active users)
 */
router.route('/:id')
  .get(checkPermission('ROLE', 'VIEW'), getRoleById)
  .put(checkPermission('ROLE', 'EDIT'), updateRole)
  .delete(checkPermission('ROLE', 'DELETE'), deleteRole);

module.exports = router;
