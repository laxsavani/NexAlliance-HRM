const LoginAttempt = require('../models/LoginAttempt');

/**
 * @desc    Get Login Attempt History (Super Admin only for security audit)
 * @route   GET /api/login-attempts
 * @access  Private (SUPER_ADMIN only)
 */
const getLoginAttempts = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Super Admin permission required to view login attempts'
      });
    }

    const { user_email, from, to } = req.query;
    const filter = {};

    if (user_email) {
      filter.email = user_email.toLowerCase().trim();
    }

    if (from || to) {
      filter.attempted_at = {};
      if (from) filter.attempted_at.$gte = new Date(from);
      if (to) filter.attempted_at.$lte = new Date(to);
    }

    const attempts = await LoginAttempt.find(filter)
      .sort({ attempted_at: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: attempts.length,
      data: attempts
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLoginAttempts
};
