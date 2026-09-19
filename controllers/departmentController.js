const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all departments (supports ?status=Active filter)
 * @route   GET /api/departments
 * @access  Private (all authenticated users)
 */
const getDepartments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const departments = await Department.find(filter)
      .populate('head', 'name employee_code email')
      .populate('parent_id', 'name code')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get department by ID
 * @route   GET /api/departments/:id
 * @access  Private (all authenticated users)
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('head', 'name employee_code email')
      .populate('parent_id', 'name code');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.status(200).json({
      success: true,
      data: department
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create department
 * @route   POST /api/departments
 * @access  Private (SUPER_ADMIN only)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { name, code, head, parent_id, status } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and code are required'
      });
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      head: head || null,
      parent_id: parent_id || null,
      status: status || 'Active'
    });

    await AuditLog.record(req.user._id, 'MASTERS', 'CREATE_DEPARTMENT', null, department, req);

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: department
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update department
 * @route   PUT /api/departments/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const oldVal = department.toObject();
    const { name, code, head, parent_id, status } = req.body;

    if (name) department.name = name.trim();
    if (code) department.code = code.trim().toUpperCase();
    if (head !== undefined) department.head = head || null;
    if (parent_id !== undefined) department.parent_id = parent_id || null;
    if (status) department.status = status;

    await department.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'UPDATE_DEPARTMENT', oldVal, department, req);

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate department (soft-delete)
 * @route   DELETE /api/departments/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    const oldVal = { status: department.status };
    department.status = 'Inactive';
    await department.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'DEACTIVATE_DEPARTMENT', oldVal, department, req);

    res.status(200).json({
      success: true,
      message: 'Department deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
