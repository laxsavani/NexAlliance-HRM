const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get system audit logs (supports pagination and filtering)
 * @route   GET /api/audit-logs
 * @access  Private (SUPER_ADMIN only)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { user_id, module, action, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (user_id) filter.user_id = user_id;
    if (module) filter.module = module.toUpperCase();
    if (action) filter.action = action.toUpperCase();

    if (from || to) {
      filter.performed_at = {};
      if (from) filter.performed_at.$gte = new Date(from);
      if (to) filter.performed_at.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('user_id', 'name email employee_code')
      .sort({ performed_at: -1 })
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data: logs
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs
};
