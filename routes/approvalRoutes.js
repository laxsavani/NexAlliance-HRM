const express = require('express');
const router = express.Router();
const { getPendingApprovalsForMe } = require('../controllers/approvalMatrixController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Approval Actions
 *   description: Approver action queues and personal pending approval queries
 */

router.use(protect);

/**
 * @swagger
 * /api/approvals/pending-for-me:
 *   get:
 *     summary: "Get Pending Requests Assigned to Current User"
 *     tags: [Approval Actions]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending requests awaiting caller's decision
 */
router.get('/pending-for-me', getPendingApprovalsForMe);

module.exports = router;
