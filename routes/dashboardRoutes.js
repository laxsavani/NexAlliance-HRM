const express = require('express');
const router = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Role-tailored dashboard summaries (Super Admin / Executive CEO & CTO / Employee Self-Service)
 */

router.use(protect);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get role-tailored dashboard summary (Universal single endpoint)
 *     tags: [Dashboard]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Role-tailored dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized, token missing or invalid
 */
router.get('/', getDashboard);

module.exports = router;
