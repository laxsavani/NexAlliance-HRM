const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const AuditLog = require('../models/AuditLog');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'nexalliance_super_secure_jwt_secret_key_2026_hrm_prod',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @desc    Login User & Return Token + User Profile
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .populate('role_id', 'name code is_system is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name timezone status');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact HR or administrator.'
      });
    }

    if (user.role_id && user.role_id.status !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Your assigned role is currently inactive'
      });
    }

    const token = generateToken(user._id);

    // Audit log login
    await AuditLog.record(user._id, 'AUTH', 'LOGIN', null, { email: user.email }, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        employee_code: user.employee_code,
        name: user.name,
        email: user.email,
        role: user.role_id,
        department: user.department_id,
        designation: user.designation_id,
        branch: user.branch_id,
        attendance_exempt: user.attendance_exempt,
        photo_url: user.photo_url
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Logged-in User Profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('role_id', 'name code is_system is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name address timezone status');

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Resolved Permissions for Current User
 * @route   GET /api/auth/me/permissions
 * @access  Private
 */
const getMyPermissions = async (req, res, next) => {
  try {
    const role = req.user.role_id;

    if (role.is_super_admin === true || role.code === 'SUPER_ADMIN') {
      // Super Admin has unrestricted ALL access across all permissions
      const allPermissions = await Permission.find().sort({ module: 1, action: 1 });
      const permissionsList = allPermissions.map(p => ({
        module: p.module,
        action: p.action,
        allowed: true,
        scope: 'ALL'
      }));

      return res.status(200).json({
        success: true,
        role: role.code,
        is_super_admin: true,
        permissions: permissionsList
      });
    }

    // Standard role permissions from RolePermission table
    const rolePermissions = await RolePermission.find({ role_id: role._id })
      .populate('permission_id', 'module action description');

    const permissionsList = rolePermissions.map(rp => ({
      module: rp.permission_id?.module,
      action: rp.permission_id?.action,
      allowed: rp.allowed,
      scope: rp.scope
    }));

    res.status(200).json({
      success: true,
      role: role.code,
      is_super_admin: false,
      permissions: permissionsList
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
  getMyPermissions
};
