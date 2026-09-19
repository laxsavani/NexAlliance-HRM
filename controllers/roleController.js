const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get all roles
 * @route   GET /api/roles
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ is_super_admin: -1, is_system: -1, createdAt: 1 });
    res.status(200).json({
      success: true,
      count: roles.length,
      data: roles
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get role by ID
 * @route   GET /api/roles/:id
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    res.status(200).json({
      success: true,
      data: role
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create custom role
 * @route   POST /api/roles
 * @access  Private (SUPER_ADMIN only)
 */
const createRole = async (req, res, next) => {
  try {
    const { name, code, status } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Role name and code are required'
      });
    }

    // Custom roles cannot be marked as system or super admin
    const role = await Role.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      is_system: false,
      is_super_admin: false,
      status: status || 'Active'
    });

    // Populate default empty permissions for this new role
    const permissions = await Permission.find();
    if (permissions.length > 0) {
      const rolePerms = permissions.map(p => ({
        role_id: role._id,
        permission_id: p._id,
        allowed: false,
        scope: 'NO'
      }));
      await RolePermission.insertMany(rolePerms);
    }

    await AuditLog.record(req.user._id, 'ROLE', 'CREATE', null, role, req);

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: role
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update role
 * @route   PUT /api/roles/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    const { name, status } = req.body;
    const oldVal = { name: role.name, status: role.status };

    // Guard: Prevent deactivating the Super Admin role if it is the only one or active
    if (role.is_super_admin && status === 'Inactive') {
      const activeSuperAdminCount = await User.countDocuments({
        role_id: role._id,
        status: 'Active'
      });
      if (activeSuperAdminCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate Super Admin role while active Super Admin users exist'
        });
      }
    }

    if (name) role.name = name.trim();
    if (status) role.status = status;

    await role.save();

    await AuditLog.record(req.user._id, 'ROLE', 'UPDATE', oldVal, role, req);

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: role
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate/Soft Delete role
 * @route   DELETE /api/roles/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // System roles (SUPER_ADMIN, CEO, CTO, EMPLOYEE) cannot be deleted
    if (role.is_system) {
      return res.status(400).json({
        success: false,
        message: 'System roles cannot be deleted. They can only be deactivated if unused.'
      });
    }

    // Check if any users are currently assigned this role
    const assignedUserCount = await User.countDocuments({ role_id: role._id, status: 'Active' });
    if (assignedUserCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate or remove role. It is currently assigned to ${assignedUserCount} active user(s).`
      });
    }

    const oldVal = { status: role.status };
    role.status = 'Inactive';
    await role.save();

    await AuditLog.record(req.user._id, 'ROLE', 'DEACTIVATE', oldVal, role, req);

    res.status(200).json({
      success: true,
      message: 'Role deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole
};
