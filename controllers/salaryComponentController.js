const SalaryComponent = require('../models/SalaryComponent');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all Salary Components
 * @route   GET /api/salary-components
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getSalaryComponents = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view salary components'
      });
    }

    const { type, status } = req.query;
    const filter = {};
    if (type) filter.type = type.toUpperCase();
    if (status) filter.status = status;

    const components = await SalaryComponent.find(filter).sort({ type: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: components.length,
      data: components
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create Salary Component
 * @route   POST /api/salary-components
 * @access  Private (SUPER_ADMIN only)
 */
const createSalaryComponent = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can create salary components'
      });
    }

    const { name, type, calc_type, value = 0, taxable = false } = req.body;

    if (!name || !type || !calc_type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, type (EARNING | DEDUCTION), and calc_type (FIXED | PERCENT_OF_BASIC | FORMULA)'
      });
    }

    const component = await SalaryComponent.create({
      name: name.trim(),
      type: type.toUpperCase(),
      calc_type: calc_type.toUpperCase(),
      value,
      taxable,
      status: 'Active'
    });

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'CREATE_SALARY_COMPONENT',
      null,
      component,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Salary component created successfully',
      data: component
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update Salary Component
 * @route   PUT /api/salary-components/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateSalaryComponent = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can update salary components'
      });
    }

    const component = await SalaryComponent.findById(req.params.id);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Salary component not found'
      });
    }

    const oldState = component.toObject();

    if (req.body.name) component.name = req.body.name.trim();
    if (req.body.type) component.type = req.body.type.toUpperCase();
    if (req.body.calc_type) component.calc_type = req.body.calc_type.toUpperCase();
    if (req.body.value !== undefined) component.value = req.body.value;
    if (req.body.taxable !== undefined) component.taxable = req.body.taxable;
    if (req.body.status) component.status = req.body.status;

    await component.save();

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'UPDATE_SALARY_COMPONENT',
      oldState,
      component,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Salary component updated successfully',
      data: component
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Soft Delete Salary Component
 * @route   DELETE /api/salary-components/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteSalaryComponent = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can deactivate salary components'
      });
    }

    const component = await SalaryComponent.findById(req.params.id);
    if (!component) {
      return res.status(404).json({
        success: false,
        message: 'Salary component not found'
      });
    }

    component.status = 'Inactive';
    await component.save();

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'DEACTIVATE_SALARY_COMPONENT',
      { status: 'Active' },
      { status: 'Inactive' },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Salary component deactivated successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSalaryComponents,
  createSalaryComponent,
  updateSalaryComponent,
  deleteSalaryComponent
};
