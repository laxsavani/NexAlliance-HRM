const express = require('express');
const router = express.Router();
const {
  getReasons,
  getReasonById,
  createReason,
  updateReason,
  deleteReason
} = require('../controllers/regularizationReasonController');
const { protect, checkPermission } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Regularization Reason Master
 *   description: Master catalog of reasons for attendance regularization requests
 */

router.use(protect);

/**
 * @swagger
 * /api/regularization-reasons:
 *   get:
 *     summary: Get all regularization reasons
 *     tags: [Regularization Reason Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: List of regularization reasons
 *   post:
 *     summary: Create new regularization reason (Super Admin only)
 *     tags: [Regularization Reason Master]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: 'Biometric / Device Issue' }
 *               status: { type: string, enum: ['Active', 'Inactive'], example: 'Active' }
 *     responses:
 *       201:
 *         description: Regularization reason created
 */
router.route('/')
  .get(checkPermission('MASTERS', 'VIEW'), getReasons)
  .post(checkPermission('MASTERS', 'CREATE'), createReason);

/**
 * @swagger
 * /api/regularization-reasons/{id}:
 *   get:
 *     summary: Get regularization reason by ID
 *     tags: [Regularization Reason Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Regularization reason details
 *   put:
 *     summary: Update regularization reason (Super Admin only)
 *     tags: [Regularization Reason Master]
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
 *               reason: { type: string }
 *               status: { type: string, enum: ['Active', 'Inactive'] }
 *     responses:
 *       200:
 *         description: Regularization reason updated
 *   delete:
 *     summary: Deactivate regularization reason (Soft-delete, Super Admin only)
 *     tags: [Regularization Reason Master]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reason deactivated
 */
router.route('/:id')
  .get(checkPermission('MASTERS', 'VIEW'), getReasonById)
  .put(checkPermission('MASTERS', 'EDIT'), updateReason)
  .delete(checkPermission('MASTERS', 'DELETE'), deleteReason);

module.exports = router;
