const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const AuditLog = require('../models/AuditLog');
const LoginAttempt = require('../models/LoginAttempt');
const { 
  encrypt, 
  decrypt, 
  generateBase32Secret, 
  verifyTotpToken 
} = require('../utils/cryptoUtils');

// Generate JWT Access Token
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'nexalliance_super_secure_jwt_secret_key_2026_hrm_prod',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

// Generate JWT Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign(
    { id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'nexalliance_super_secure_refresh_secret_2026',
    { expiresIn: '30d' }
  );
};

/**
 * @desc    Login User & Return Token + User Profile (with Rate Limit, Lockout & 2FA)
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password, totp_code } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail })
      .populate('role_id', 'name code is_system is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name timezone status');

    // 1. Check account lockout BEFORE password comparison to prevent timing enumeration
    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      await LoginAttempt.create({ email: cleanEmail, ip, success: false });
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again after ${user.locked_until.toISOString()}`
      });
    }

    // 2. User not found
    if (!user) {
      await LoginAttempt.create({ email: cleanEmail, ip, success: false });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // 3. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failed_login_count = (user.failed_login_count || 0) + 1;
      
      // If 5 or more failed attempts, lock for 15 minutes
      if (user.failed_login_count >= 5) {
        user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        user.failed_login_count = 0;
      }
      await user.save();
      await LoginAttempt.create({ email: cleanEmail, ip, success: false });

      if (user.locked_until) {
        return res.status(423).json({
          success: false,
          message: 'Account locked: 5 failed login attempts exceeded. Account is locked for 15 minutes.'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // 4. Check user & role status
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

    // 5. Check 2FA if enabled on user account
    if (user.two_fa_enabled) {
      if (!totp_code) {
        return res.status(400).json({
          success: false,
          two_fa_required: true,
          message: 'Two-factor authentication code (TOTP) is required'
        });
      }

      const secret = decrypt(user.two_fa_secret_enc);
      const is2FAValid = verifyTotpToken(totp_code, secret);
      if (!is2FAValid) {
        await LoginAttempt.create({ email: cleanEmail, ip, success: false });
        return res.status(401).json({
          success: false,
          message: 'Invalid two-factor authentication code'
        });
      }
    }

    // 6. Reset lockout & failed counter on successful authentication
    user.failed_login_count = 0;
    user.locked_until = null;
    await user.save();

    await LoginAttempt.create({ email: cleanEmail, ip, success: true });

    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Audit log login
    await AuditLog.record(user._id, 'AUTH', 'LOGIN', null, { email: user.email }, req);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      refresh_token: refreshToken,
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
        two_fa_enabled: user.two_fa_enabled,
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

/**
 * @desc    Setup 2FA for Super Admin (Generates TOTP Secret & otpauth URL)
 * @route   POST /api/auth/2fa/setup
 * @access  Private (SUPER_ADMIN only)
 */
const setup2FA = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: 2FA setup is currently restricted to Super Admin only'
      });
    }

    const secret = generateBase32Secret(20);
    const user = await User.findById(req.user._id);
    user.two_fa_secret_enc = encrypt(secret);
    await user.save();

    const otpauthUrl = `otpauth://totp/NexAllianceHRM:${encodeURIComponent(user.email)}?secret=${secret}&issuer=NexAllianceHRM`;

    await AuditLog.record(user._id, 'AUTH', '2FA_SETUP_INITIATED', null, { email: user.email }, req);

    res.status(200).json({
      success: true,
      message: '2FA secret generated successfully. Please verify with a TOTP code to enable.',
      secret,
      otpauth_url: otpauthUrl
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Verify and Enable 2FA for Super Admin
 * @route   POST /api/auth/2fa/verify
 * @access  Private (SUPER_ADMIN only)
 */
const verify2FA = async (req, res, next) => {
  try {
    const { totp_code } = req.body;
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: 2FA verify is restricted to Super Admin only'
      });
    }

    if (!totp_code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide totp_code to verify'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user.two_fa_secret_enc) {
      return res.status(400).json({
        success: false,
        message: '2FA has not been setup yet. Call /api/auth/2fa/setup first.'
      });
    }

    const secret = decrypt(user.two_fa_secret_enc);
    const isValid = verifyTotpToken(totp_code, secret);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 2FA TOTP verification code'
      });
    }

    user.two_fa_enabled = true;
    await user.save();

    await AuditLog.record(user._id, 'AUTH', '2FA_ENABLED', null, { email: user.email }, req);

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication (2FA) successfully enabled.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Refresh Access Token using Refresh Token
 * @route   POST /api/auth/refresh-token
 * @access  Public / Token Holder
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        refresh_token,
        process.env.JWT_REFRESH_SECRET || 'nexalliance_super_secure_refresh_secret_2026'
      );
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'User belonging to refresh token is inactive or no longer exists'
      });
    }

    const newAccessToken = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newAccessToken
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  getMe,
  getMyPermissions,
  setup2FA,
  verify2FA,
  refreshToken
};
