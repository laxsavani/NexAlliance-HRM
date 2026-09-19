const Branch = require('../models/Branch');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all branches (supports ?status=Active)
 * @route   GET /api/branches
 * @access  Private (all authenticated users)
 */
const getBranches = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const branches = await Branch.find(filter).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get branch by ID
 * @route   GET /api/branches/:id
 * @access  Private (all authenticated users)
 */
const getBranchById = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    res.status(200).json({
      success: true,
      data: branch
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create branch
 * @route   POST /api/branches
 * @access  Private (SUPER_ADMIN only)
 */
const createBranch = async (req, res, next) => {
  try {
    const { name, address, latitude, longitude, radius_m, timezone, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Branch name is required'
      });
    }

    const branch = await Branch.create({
      name: name.trim(),
      address: address ? address.trim() : '',
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      radius_m: radius_m !== undefined ? Number(radius_m) : 200,
      timezone: timezone || 'Asia/Kolkata',
      status: status || 'Active'
    });

    await AuditLog.record(req.user._id, 'MASTERS', 'CREATE_BRANCH', null, branch, req);

    res.status(201).json({
      success: true,
      message: 'Branch created successfully',
      data: branch
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update branch
 * @route   PUT /api/branches/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const oldVal = branch.toObject();
    const { name, address, latitude, longitude, radius_m, timezone, status } = req.body;

    if (name) branch.name = name.trim();
    if (address !== undefined) branch.address = address.trim();
    if (latitude !== undefined) branch.latitude = Number(latitude);
    if (longitude !== undefined) branch.longitude = Number(longitude);
    if (radius_m !== undefined) branch.radius_m = Number(radius_m);
    if (timezone) branch.timezone = timezone;
    if (status) branch.status = status;

    await branch.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'UPDATE_BRANCH', oldVal, branch, req);

    res.status(200).json({
      success: true,
      message: 'Branch updated successfully',
      data: branch
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate branch (soft-delete)
 * @route   DELETE /api/branches/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteBranch = async (req, res, next) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }

    const oldVal = { status: branch.status };
    branch.status = 'Inactive';
    await branch.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'DEACTIVATE_BRANCH', oldVal, branch, req);

    res.status(200).json({
      success: true,
      message: 'Branch deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch
};
