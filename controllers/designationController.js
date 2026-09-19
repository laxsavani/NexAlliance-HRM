const Designation = require('../models/Designation');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all designations (supports ?status=Active & ?department_id filters)
 * @route   GET /api/designations
 * @access  Private (all authenticated users)
 */
const getDesignations = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.department_id) {
      filter.department_id = req.query.department_id;
    }

    const designations = await Designation.find(filter)
      .populate('department_id', 'name code')
      .sort({ level: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: designations.length,
      data: designations
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get designation by ID
 * @route   GET /api/designations/:id
 * @access  Private (all authenticated users)
 */
const getDesignationById = async (req, res, next) => {
  try {
    const designation = await Designation.findById(req.params.id)
      .populate('department_id', 'name code');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: designation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create designation
 * @route   POST /api/designations
 * @access  Private (SUPER_ADMIN only)
 */
const createDesignation = async (req, res, next) => {
  try {
    const { name, code, department_id, level, status } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Designation name and code are required'
      });
    }

    const designation = await Designation.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      department_id: department_id || null,
      level: level !== undefined ? Number(level) : 1,
      status: status || 'Active'
    });

    await AuditLog.record(req.user._id, 'MASTERS', 'CREATE_DESIGNATION', null, designation, req);

    res.status(201).json({
      success: true,
      message: 'Designation created successfully',
      data: designation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update designation
 * @route   PUT /api/designations/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateDesignation = async (req, res, next) => {
  try {
    const designation = await Designation.findById(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    const oldVal = designation.toObject();
    const { name, code, department_id, level, status } = req.body;

    if (name) designation.name = name.trim();
    if (code) designation.code = code.trim().toUpperCase();
    if (department_id !== undefined) designation.department_id = department_id || null;
    if (level !== undefined) designation.level = Number(level);
    if (status) designation.status = status;

    await designation.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'UPDATE_DESIGNATION', oldVal, designation, req);

    res.status(200).json({
      success: true,
      message: 'Designation updated successfully',
      data: designation
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate designation (soft-delete)
 * @route   DELETE /api/designations/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteDesignation = async (req, res, next) => {
  try {
    const designation = await Designation.findById(req.params.id);
    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found'
      });
    }

    const oldVal = { status: designation.status };
    designation.status = 'Inactive';
    await designation.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'DEACTIVATE_DESIGNATION', oldVal, designation, req);

    res.status(200).json({
      success: true,
      message: 'Designation deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation
};
