const RegularizationReason = require('../models/RegularizationReason');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all regularization reasons
 * @route   GET /api/regularization-reasons
 * @access  Private (All authenticated users)
 */
const getReasons = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const reasons = await RegularizationReason.find(filter).sort({ reason: 1 });

    res.status(200).json({
      success: true,
      count: reasons.length,
      data: reasons
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get regularization reason by ID
 * @route   GET /api/regularization-reasons/:id
 * @access  Private (All authenticated users)
 */
const getReasonById = async (req, res, next) => {
  try {
    const reason = await RegularizationReason.findById(req.params.id);
    if (!reason) {
      return res.status(404).json({
        success: false,
        message: 'Regularization reason not found'
      });
    }

    res.status(200).json({
      success: true,
      data: reason
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create regularization reason
 * @route   POST /api/regularization-reasons
 * @access  Private (SUPER_ADMIN only)
 */
const createReason = async (req, res, next) => {
  try {
    const { reason, status } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason text is required'
      });
    }

    const existing = await RegularizationReason.findOne({ reason: reason.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Regularization reason [${reason.trim()}] already exists`
      });
    }

    const newReason = await RegularizationReason.create({
      reason: reason.trim(),
      status: status || 'Active'
    });

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'CREATE_REGULARIZATION_REASON',
      null,
      newReason,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Regularization reason created successfully',
      data: newReason
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update regularization reason
 * @route   PUT /api/regularization-reasons/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateReason = async (req, res, next) => {
  try {
    const item = await RegularizationReason.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Regularization reason not found'
      });
    }

    const oldVal = item.toObject();
    const { reason, status } = req.body;

    if (reason && reason.trim() !== item.reason) {
      const duplicate = await RegularizationReason.findOne({
        reason: reason.trim(),
        _id: { $ne: item._id }
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Regularization reason [${reason.trim()}] already exists`
        });
      }
      item.reason = reason.trim();
    }

    if (status) item.status = status;

    await item.save();

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'UPDATE_REGULARIZATION_REASON',
      oldVal,
      item,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Regularization reason updated successfully',
      data: item
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate regularization reason (Soft-delete)
 * @route   DELETE /api/regularization-reasons/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteReason = async (req, res, next) => {
  try {
    const item = await RegularizationReason.findById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Regularization reason not found'
      });
    }

    const oldVal = { status: item.status };
    item.status = 'Inactive';
    await item.save();

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'DEACTIVATE_REGULARIZATION_REASON',
      oldVal,
      item,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Regularization reason deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getReasons,
  getReasonById,
  createReason,
  updateReason,
  deleteReason
};
