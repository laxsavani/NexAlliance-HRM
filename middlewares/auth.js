const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');

/**
 * Protect middleware - verifies JWT and populates req.user
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route, token missing'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nexalliance_super_secure_jwt_secret_key_2026_hrm_prod');

    const user = await User.findById(decoded.id)
      .populate('role_id', 'name code is_system is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name address latitude longitude radius_m timezone status')
      .populate('shift_id');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists'
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    if (user.role_id && user.role_id.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Assigned role is currently deactivated'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route, token invalid or expired'
    });
  }
};

/**
 * checkPermission middleware - resolves Super Admin bypass and Permission Matrix
 * @param {string} moduleName - Module code (e.g. 'EMPLOYEE', 'MASTERS', 'ROLE')
 * @param {string} actionName - Action code (e.g. 'VIEW', 'CREATE', 'EDIT', 'DELETE')
 */
const checkPermission = (moduleName, actionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.role_id) {
        return res.status(401).json({
          success: false,
          message: 'User role not resolved. Authentication required.'
        });
      }

      const role = req.user.role_id;

      // 1. Super Admin bypass (Highest privilege, Level 3, bypasses every check)
      if (role.is_super_admin === true || role.code === 'SUPER_ADMIN') {
        req.permissionScope = 'ALL';
        return next();
      }

      // 2. Lookup Permission in catalog
      const permission = await Permission.findOne({
        module: moduleName.toUpperCase(),
        action: actionName.toUpperCase()
      });

      if (!permission) {
        return res.status(403).json({
          success: false,
          message: `Permission definition [${moduleName}:${actionName}] not found in catalog`
        });
      }

      // 3. Lookup RolePermission Matrix row
      const rolePermission = await RolePermission.findOne({
        role_id: role._id,
        permission_id: permission._id
      });

      if (!rolePermission || !rolePermission.allowed || rolePermission.scope === 'NO' || rolePermission.scope === 'N/A') {
        return res.status(403).json({
          success: false,
          message: `Access Denied: You do not have permission to perform [${actionName}] on [${moduleName}]`
        });
      }

      // 4. Attach resolved permission scope (OWN, DEPT, ALL, MATRIX)
      req.permissionScope = rolePermission.scope;
      next();
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal error checking access permissions'
      });
    }
  };
};

module.exports = {
  protect,
  checkPermission
};
