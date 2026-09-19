const express = require('express');
const router = express.Router();
const {
  getRolePermissionMatrix,
  updateRolePermissionMatrix
} = require('../controllers/permissionMatrixController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Permission Matrix
 *   description: Role-based Module & Action Permission matrix configuration
 */

router.use(protect);

/**
 * @swagger
 * /api/permission-matrix/{roleId}:
 *   get:
 *     summary: Get complete Permission Matrix for a specific role
 *     tags: [Permission Matrix]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permission matrix list with allowed status and scopes
 *       404:
 *         description: Role not found
 *   put:
 *     summary: Update Permission Matrix for a specific role (Super Admin only)
 *     tags: [Permission Matrix]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [permission_id, allowed, scope]
 *                   properties:
 *                     permission_id: { type: string }
 *                     allowed: { type: boolean }
 *                     scope: { type: string, enum: ['OWN', 'DEPT', 'ALL', 'MATRIX', 'N/A', 'NO'] }
 *     responses:
 *       200:
 *         description: Matrix updated successfully
 *       400:
 *         description: Cannot edit locked Super Admin role
 */
router.route('/:roleId')
  .get(checkPermission('PERMISSION_MATRIX', 'VIEW'), getRolePermissionMatrix)
  .put(checkPermission('PERMISSION_MATRIX', 'EDIT'), updateRolePermissionMatrix);

module.exports = router;
