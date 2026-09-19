const express = require('express');
const router = express.Router();
const { login, getMe, getMyPermissions } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and token management
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate employee and get JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account or role deactivated
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get currently logged-in employee profile
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

module.exports = router;
