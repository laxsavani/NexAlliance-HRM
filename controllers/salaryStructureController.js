const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { parseDate } = require('../utils/dateUtils');
const { normalizeDate } = require('../services/attendanceService');

/**
 * @desc    Get Employee Salary Structure History
 * @route   GET /api/employees/:userId/salary-structure
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getSalaryStructure = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view employee salary structures'
      });
    }

    const { userId } = req.params;
    const user = await User.findById(userId).select('name employee_code email department_id designation_id');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const structures = await EmployeeSalaryStructure.find({ user_id: userId })
      .sort({ effective_from: -1 })
      .populate('components.component_id');

    res.status(200).json({
      success: true,
      user,
      count: structures.length,
      data: structures
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create / Assign Salary Structure Version for Employee (History-preserving)
 * @route   POST /api/employees/:userId/salary-structure
 * @access  Private (SUPER_ADMIN only)
 */
const createSalaryStructure = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can assign salary structures'
      });
    }

    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const { effective_from, basic, components = [] } = req.body;

    if (!effective_from || basic === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide effective_from date and basic salary'
      });
    }

    const parsedDate = parseDate(effective_from);
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid effective_from date format. Please use DD/MM/YYYY or YYYY-MM-DD'
      });
    }

    const normalizedEffective = normalizeDate(parsedDate);

    // Create a NEW structure document to strictly preserve history
    const structure = await EmployeeSalaryStructure.create({
      user_id: userId,
      effective_from: normalizedEffective,
      basic: Number(basic),
      components,
      status: 'Active'
    });

    // Also update current salary field on user profile for quick reference
    user.salary = Number(basic);
    await user.save();

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'ASSIGN_SALARY_STRUCTURE',
      null,
      structure,
      req
    );

    const populated = await EmployeeSalaryStructure.findById(structure._id).populate('components.component_id');

    res.status(201).json({
      success: true,
      message: 'Employee salary structure version created successfully',
      data: populated
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSalaryStructure,
  createSalaryStructure
};
