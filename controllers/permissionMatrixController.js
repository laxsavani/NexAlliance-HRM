const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get Permission Matrix for a specific role
 * @route   GET /api/permission-matrix/:roleId
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getRolePermissionMatrix = async (req, res, next) => {
  try {
    const { roleId } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Get all permissions catalog
    const allPermissions = await Permission.find().sort({ module: 1, action: 1 });

    // Get current role permissions
    const currentRolePerms = await RolePermission.find({ role_id: role._id });
    const permMap = new Map();
    currentRolePerms.forEach(rp => {
      permMap.set(rp.permission_id.toString(), rp);
    });

    // If Super Admin role, all permissions are inherently allowed with ALL scope
    const matrix = allPermissions.map(p => {
      if (role.is_super_admin) {
        return {
          permission_id: p._id,
          module: p.module,
          action: p.action,
          description: p.description,
          allowed: true,
          scope: 'ALL',
          is_locked: true
        };
      }

      const existing = permMap.get(p._id.toString());
      return {
        permission_id: p._id,
        module: p.module,
        action: p.action,
        description: p.description,
        allowed: existing ? existing.allowed : false,
        scope: existing ? existing.scope : 'NO',
        is_locked: false
      };
    });

    res.status(200).json({
      success: true,
      role: {
        id: role._id,
        name: role.name,
        code: role.code,
        is_super_admin: role.is_super_admin,
        is_system: role.is_system
      },
      matrix
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update Permission Matrix for a specific role
 * @route   PUT /api/permission-matrix/:roleId
 * @access  Private (SUPER_ADMIN only)
 */
const updateRolePermissionMatrix = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body; // Array of { permission_id, allowed, scope }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions payload must be an array of { permission_id, allowed, scope }'
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    if (role.is_super_admin) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin permission matrix is system-locked to ALL and cannot be modified'
      });
    }

    const oldPerms = await RolePermission.find({ role_id: role._id });

    // Upsert each permission
    const bulkOps = permissions.map(p => ({
      updateOne: {
        filter: { role_id: role._id, permission_id: p.permission_id },
        update: {
          $set: {
            allowed: Boolean(p.allowed),
            scope: ['OWN', 'DEPT', 'ALL', 'MATRIX', 'N/A', 'NO'].includes(p.scope) ? p.scope : (p.allowed ? 'ALL' : 'NO')
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await RolePermission.bulkWrite(bulkOps);
    }

    await AuditLog.record(
      req.user._id,
      'PERMISSION_MATRIX',
      'UPDATE',
      { role_code: role.code, count: oldPerms.length },
      { role_code: role.code, updated_count: permissions.length },
      req
    );

    res.status(200).json({
      success: true,
      message: `Permission matrix updated successfully for role ${role.name}`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRolePermissionMatrix,
  updateRolePermissionMatrix
};
