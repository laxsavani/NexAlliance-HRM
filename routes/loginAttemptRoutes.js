const express = require('express');
const router = express.Router();
const { getLoginAttempts } = require('../controllers/loginAttemptController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Security & Login Audits
 *   description: Login attempt monitoring and brute-force tracking
 */

router.use(protect);

/**
 * @swagger
 * /api/login-attempts:
 *   get:
 *     summary: Get login attempt audit log (Super Admin only)
 *     tags: [Security & Login Audits]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_email
 *         schema: { type: string }
 *         description: Filter by user email
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *         description: Start date
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *         description: End date
 *     responses:
 *       200:
 *         description: List of login attempts
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.get('/', getLoginAttempts);

module.exports = router;
