const { aggregateDashboardCounts } = require('../utils/reportAggregations');

/**
 * @desc    Get Unified Multi-Role Dashboard Overview
 * @route   GET /api/dashboard
 * @access  Private (All Authenticated Users - Payload shaped by role)
 */
const getDashboard = async (req, res, next) => {
  try {
    const dashboardData = await aggregateDashboardCounts(req.user);

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboard
};
