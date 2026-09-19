const express = require('express');
const router = express.Router();
const {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
} = require('../controllers/branchController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Branch Master
 *   description: Organization Office / Location Master management with Geofencing
 */

router.use(protect);

/**
 * @swagger
 * /api/branches:
 *   get:
 *     summary: Get all office branches
 *     tags: [Branch Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of branches
 *   post:
 *     summary: Create new office branch (Super Admin only)
 *     tags: [Branch Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: 'Ahmedabad Tech Park' }
 *               address: { type: string, example: 'SG Highway, Ahmedabad, Gujarat' }
 *               latitude: { type: number, example: 23.0225 }
 *               longitude: { type: number, example: 72.5714 }
 *               radius_m: { type: number, example: 200 }
 *               timezone: { type: string, example: 'Asia/Kolkata' }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Branch created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getBranches)
  .post(checkPermission('MASTERS', 'CREATE'), createBranch);

/**
 * @swagger
 * /api/branches/{id}:
 *   get:
 *     summary: Get branch by ID
 *     tags: [Branch Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Branch details
 *   put:
 *     summary: Update branch (Super Admin only)
 *     tags: [Branch Master]
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
 *               address: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               radius_m: { type: number }
 *               timezone: { type: string }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Branch updated
 *   delete:
 *     summary: Deactivate branch (Soft-delete, Super Admin only)
 *     tags: [Branch Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Branch deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getBranchById)
  .put(checkPermission('MASTERS', 'EDIT'), updateBranch)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteBranch);

module.exports = router;
