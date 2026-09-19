const Shift = require('../models/Shift');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all shifts (supports ?status=Active)
 * @route   GET /api/shifts
 * @access  Private (all authenticated users)
 */
const getShifts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const shifts = await Shift.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: shifts.length,
      data: shifts
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get shift by ID
 * @route   GET /api/shifts/:id
 * @access  Private (all authenticated users)
 */
const getShiftById = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    res.status(200).json({
      success: true,
      data: shift
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create shift policy
 * @route   POST /api/shifts
 * @access  Private (SUPER_ADMIN only)
 */
const createShift = async (req, res, next) => {
  try {
    const {
      name,
      start_time,
      end_time,
      grace_in_min,
      monthly_late_allowed,
      late_action,
      late_deduct_days,
      half_day_hrs,
      full_day_hrs,
      status
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Shift name is required'
      });
    }

    const shift = await Shift.create({
      name: name.trim(),
      start_time: start_time || '10:00',
      end_time: end_time || '18:30',
      grace_in_min: grace_in_min !== undefined ? Number(grace_in_min) : 10,
      monthly_late_allowed: monthly_late_allowed !== undefined ? Number(monthly_late_allowed) : 3,
      late_action: late_action || 'DEDUCT',
      late_deduct_days: late_deduct_days !== undefined ? Number(late_deduct_days) : 0.5,
      half_day_hrs: half_day_hrs !== undefined ? Number(half_day_hrs) : 4,
      full_day_hrs: full_day_hrs !== undefined ? Number(full_day_hrs) : 8,
      status: status || 'Active'
    });

    await AuditLog.record(req.user._id, 'MASTERS', 'CREATE_SHIFT', null, shift, req);

    res.status(201).json({
      success: true,
      message: 'Shift policy created successfully',
      data: shift
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update shift policy
 * @route   PUT /api/shifts/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    const oldVal = shift.toObject();
    const {
      name,
      start_time,
      end_time,
      grace_in_min,
      monthly_late_allowed,
      late_action,
      late_deduct_days,
      half_day_hrs,
      full_day_hrs,
      status
    } = req.body;

    if (name) shift.name = name.trim();
    if (start_time) shift.start_time = start_time;
    if (end_time) shift.end_time = end_time;
    if (grace_in_min !== undefined) shift.grace_in_min = Number(grace_in_min);
    if (monthly_late_allowed !== undefined) shift.monthly_late_allowed = Number(monthly_late_allowed);
    if (late_action) shift.late_action = late_action;
    if (late_deduct_days !== undefined) shift.late_deduct_days = Number(late_deduct_days);
    if (half_day_hrs !== undefined) shift.half_day_hrs = Number(half_day_hrs);
    if (full_day_hrs !== undefined) shift.full_day_hrs = Number(full_day_hrs);
    if (status) shift.status = status;

    await shift.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'UPDATE_SHIFT', oldVal, shift, req);

    res.status(200).json({
      success: true,
      message: 'Shift policy updated successfully',
      data: shift
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate shift (soft-delete)
 * @route   DELETE /api/shifts/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteShift = async (req, res, next) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }

    const oldVal = { status: shift.status };
    shift.status = 'Inactive';
    await shift.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'DEACTIVATE_SHIFT', oldVal, shift, req);

    res.status(200).json({
      success: true,
      message: 'Shift deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift
};
