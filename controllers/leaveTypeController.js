const LeaveType = require('../models/LeaveType');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all leave types
 * @route   GET /api/leave-types
 * @access  Private (All authenticated users)
 */
const getLeaveTypes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const leaveTypes = await LeaveType.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: leaveTypes.length,
      data: leaveTypes
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get leave type by ID
 * @route   GET /api/leave-types/:id
 * @access  Private (All authenticated users)
 */
const getLeaveTypeById = async (req, res, next) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }

    res.status(200).json({
      success: true,
      data: leaveType
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create leave type
 * @route   POST /api/leave-types
 * @access  Private (SUPER_ADMIN only)
 */
const createLeaveType = async (req, res, next) => {
  try {
    const {
      code,
      name,
      is_paid,
      quota,
      quota_period,
      carry_forward,
      deduct_salary,
      max_duration_minutes,
      half_day_allowed,
      needs_attachment,
      notice_days,
      status
    } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Leave type code and name are required'
      });
    }

    const existing = await LeaveType.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Leave type with code [${code.toUpperCase().trim()}] already exists`
      });
    }

    const leaveType = await LeaveType.create({
      code: code.toUpperCase().trim(),
      name: name.trim(),
      is_paid: is_paid !== undefined ? Boolean(is_paid) : true,
      quota: quota !== undefined ? Number(quota) : 0,
      quota_period: quota_period || 'YEAR',
      carry_forward: carry_forward !== undefined ? Boolean(carry_forward) : false,
      deduct_salary: deduct_salary !== undefined ? Boolean(deduct_salary) : false,
      max_duration_minutes: max_duration_minutes ? Number(max_duration_minutes) : null,
      half_day_allowed: half_day_allowed !== undefined ? Boolean(half_day_allowed) : true,
      needs_attachment: needs_attachment !== undefined ? Boolean(needs_attachment) : false,
      notice_days: notice_days !== undefined ? Number(notice_days) : 0,
      status: status || 'Active'
    });

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'CREATE_LEAVE_TYPE',
      null,
      leaveType,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Leave type created successfully',
      data: leaveType
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update leave type
 * @route   PUT /api/leave-types/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateLeaveType = async (req, res, next) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }

    const oldVal = leaveType.toObject();
    const {
      name,
      is_paid,
      quota,
      quota_period,
      carry_forward,
      deduct_salary,
      max_duration_minutes,
      half_day_allowed,
      needs_attachment,
      notice_days,
      status
    } = req.body;

    if (name) leaveType.name = name.trim();
    if (is_paid !== undefined) leaveType.is_paid = Boolean(is_paid);
    if (quota !== undefined) leaveType.quota = Number(quota);
    if (quota_period) leaveType.quota_period = quota_period;
    if (carry_forward !== undefined) leaveType.carry_forward = Boolean(carry_forward);
    if (deduct_salary !== undefined) leaveType.deduct_salary = Boolean(deduct_salary);
    if (max_duration_minutes !== undefined) leaveType.max_duration_minutes = max_duration_minutes ? Number(max_duration_minutes) : null;
    if (half_day_allowed !== undefined) leaveType.half_day_allowed = Boolean(half_day_allowed);
    if (needs_attachment !== undefined) leaveType.needs_attachment = Boolean(needs_attachment);
    if (notice_days !== undefined) leaveType.notice_days = Number(notice_days);
    if (status) leaveType.status = status;

    await leaveType.save();

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'UPDATE_LEAVE_TYPE',
      oldVal,
      leaveType,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Leave type updated successfully',
      data: leaveType
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate leave type (Soft-delete)
 * @route   DELETE /api/leave-types/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteLeaveType = async (req, res, next) => {
  try {
    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) {
      return res.status(404).json({
        success: false,
        message: 'Leave type not found'
      });
    }

    const oldVal = { status: leaveType.status };
    leaveType.status = 'Inactive';
    await leaveType.save();

    await AuditLog.record(
      req.user._id,
      'MASTERS',
      'DEACTIVATE_LEAVE_TYPE',
      oldVal,
      leaveType,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Leave type deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType
};
