const express = require('express');
const router = express.Router();
const { 
  login, 
  getMe, 
  getMyPermissions, 
  setup2FA, 
  verify2FA, 
  refreshToken 
} = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { loginRateLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication, lockout management, 2FA, and token management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate employee and get JWT token (Rate limited, lockout on 5 failed attempts)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: 'admin@nexalliance.com' }
 *               password: { type: string, example: 'Admin@12345' }
 *               totp_code: { type: string, example: '123456', description: 'Required if 2FA enabled' }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing credentials or TOTP code required
 *       401:
 *         description: Invalid credentials or invalid TOTP
 *       403:
 *         description: Account or role deactivated
 *       423:
 *         description: Account temporarily locked due to failed attempts
 *       429:
 *         description: Rate limit exceeded (20 req/min)
 */
router.post('/login', loginRateLimiter, login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get currently logged-in employee profile (Masked sensitive fields)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile data
 *       401:
 *         description: Unauthorized, invalid/missing token
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /api/auth/me/permissions:
 *   get:
 *     summary: Get resolved permission matrix for current user role
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of permissions and scopes
 *       401:
 *         description: Unauthorized
 */
router.get('/me/permissions', protect, getMyPermissions);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     summary: Generate TOTP 2FA secret and OTPAuth URI (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA secret generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TwoFASetupResponse'
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.post('/2fa/setup', protect, setup2FA);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify TOTP code and activate 2FA (Super Admin only)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [totp_code]
 *             properties:
 *               totp_code: { type: string, example: '123456' }
 *     responses:
 *       200:
 *         description: 2FA activated successfully
 *       400:
 *         description: Invalid TOTP verification code
 *       403:
 *         description: Access Denied (Super Admin only)
 */
router.post('/2fa/verify', protect, verify2FA);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Exchange refresh token for a new access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200:
 *         description: New access token issued
 *       400:
 *         description: Missing refresh token
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', refreshToken);

module.exports = router;
