const express = require('express');
const router = express.Router();
const {
  getSensitiveChangeRequests,
  approveSensitiveChangeRequest,
  rejectSensitiveChangeRequest
} = require('../controllers/sensitiveChangeRequestController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Sensitive Data & Change Approvals
 *   description: Super Admin approval workflow for Employee Bank Account, PAN, and Aadhaar updates
 */

router.use(protect);

/**
 * @swagger
 * /api/sensitive-change-requests:
 *   get:
 *     summary: List all sensitive change requests (Super Admin only)
 *     tags: [Sensitive Data & Change Approvals]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: ['Pending', 'Approved', 'Rejected'] }
 *         description: Filter by request status
 *     responses:
 *       200:
 *         description: List of sensitive change requests
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.get('/', getSensitiveChangeRequests);

/**
 * @swagger
 * /api/sensitive-change-requests/{id}/approve:
 *   put:
 *     summary: Approve sensitive field change and apply AES-256 encrypted update to user (Super Admin only)
 *     tags: [Sensitive Data & Change Approvals]
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
 *               remark: { type: string, example: 'Verified with bank passbook' }
 *     responses:
 *       200:
 *         description: Request approved and User record updated
 *       400:
 *         description: Request already decided
 *       403:
 *         description: Access Denied
 *       404:
 *         description: Request not found
 */
router.put('/:id/approve', approveSensitiveChangeRequest);

/**
 * @swagger
 * /api/sensitive-change-requests/{id}/reject:
 *   put:
 *     summary: Reject sensitive field change request (Super Admin only)
 *     tags: [Sensitive Data & Change Approvals]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [remark]
 *             properties:
 *               remark: { type: string, example: 'Account number does not match IFSC' }
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Missing remark or already decided
 *       403:
 *         description: Access Denied
 *       404:
 *         description: Request not found
 */
router.put('/:id/reject', rejectSensitiveChangeRequest);

module.exports = router;
