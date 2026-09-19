const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate } = require('../utils/dateUtils');
const { uploadToCloudinary } = require('../config/cloudinary');

/**
 * @desc    Get employees list (Scope aware: ALL / DEPT / OWN)
 * @route   GET /api/employees
 * @access  Private (SUPER_ADMIN/CEO/CTO: ALL, Employee: OWN)
 */
const getEmployees = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    const filter = {};

    // Apply Scope
    if (scope === 'OWN') {
      filter._id = req.user._id;
    } else if (scope === 'DEPT') {
      filter.department_id = req.user.department_id;
    }
    // If scope === 'ALL', no user filter applied

    // Apply query filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.department_id && scope === 'ALL') {
      filter.department_id = req.query.department_id;
    }
    if (req.query.designation_id) {
      filter.designation_id = req.query.designation_id;
    }
    if (req.query.branch_id) {
      filter.branch_id = req.query.branch_id;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { employee_code: searchRegex }
      ];
    }

    const employees = await User.find(filter)
      .select('-password_hash')
      .populate('role_id', 'name code is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name timezone status')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: employees.length,
      data: employees
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get employee by ID (Scope aware)
 * @route   GET /api/employees/:id
 * @access  Private
 */
const getEmployeeById = async (req, res, next) => {
  try {
    const scope = req.permissionScope || 'OWN';
    const targetId = req.params.id;

    // Scope validation
    if (scope === 'OWN' && targetId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You can only view your own profile'
      });
    }

    const employee = await User.findById(targetId)
      .select('-password_hash')
      .populate('role_id', 'name code is_super_admin status')
      .populate('department_id', 'name code status')
      .populate('designation_id', 'name code level status')
      .populate('branch_id', 'name address timezone status');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    if (scope === 'DEPT' && employee.department_id?._id.toString() !== req.user.department_id?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Employee does not belong to your department'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create employee
 * @route   POST /api/employees
 * @access  Private (SUPER_ADMIN only)
 */
const createEmployee = async (req, res, next) => {
  try {
    const {
      employee_code,
      name,
      email,
      password,
      role_id,
      department_id,
      designation_id,
      branch_id,
      shift_id,
      dob,
      date_of_joining,
      salary,
      phone,
      address,
      emergency_contact,
      photo_url,
      attendance_exempt,
      bank_details,
      identity_documents,
      education_documents,
      status
    } = req.body;

    if (!employee_code || !name || !email || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee code, name, email, password, and role are required'
      });
    }

    // Verify role exists and is active
    const role = await Role.findById(role_id);
    if (!role || role.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive role selected'
      });
    }

    const password_hash = await User.hashPassword(password);

    const employee = await User.create({
      employee_code: employee_code.trim().toUpperCase(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      role_id,
      department_id: department_id || null,
      designation_id: designation_id || null,
      branch_id: branch_id || null,
      shift_id: shift_id || null,
      dob: dob ? parseDate(dob) : null,
      date_of_joining: date_of_joining ? parseDate(date_of_joining) : new Date(),
      salary: salary !== undefined ? Number(salary) : 0,
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      emergency_contact: emergency_contact ? emergency_contact.trim() : '',
      photo_url: photo_url || null,
      attendance_exempt: role.is_super_admin ? true : Boolean(attendance_exempt),
      bank_details: bank_details || {},
      identity_documents: identity_documents || {},
      education_documents: education_documents || {},
      status: status || 'Active'
    });

    const sanitized = employee.toObject();
    delete sanitized.password_hash;

    await AuditLog.record(req.user._id, 'EMPLOYEE', 'CREATE', null, sanitized, req);

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update employee (Super Admin: full, Employee: own limited fields whitelist)
 * @route   PUT /api/employees/:id
 * @access  Private
 */
const updateEmployee = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const isSuperAdmin = req.user.role_id?.is_super_admin || req.user.role_id?.code === 'SUPER_ADMIN';
    const isSelf = targetId === req.user._id.toString();

    const employee = await User.findById(targetId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Permission check
    if (!isSuperAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not authorized to edit this employee'
      });
    }

    const oldVal = employee.toObject();
    delete oldVal.password_hash;

    if (isSuperAdmin) {
      // Super Admin full edit capability
      const {
        name,
        email,
        password,
        role_id,
        department_id,
        designation_id,
        branch_id,
        shift_id,
        dob,
        date_of_joining,
        salary,
        phone,
        address,
        emergency_contact,
        photo_url,
        attendance_exempt,
        bank_details,
        identity_documents,
        education_documents,
        status
      } = req.body;

      // Guard: Prevent demoting or deactivating the last active Super Admin
      const currentRole = await Role.findById(employee.role_id);
      if (currentRole && currentRole.is_super_admin) {
        const isChangingRole = role_id && role_id.toString() !== employee.role_id.toString();
        const isDeactivating = status && status === 'Inactive';

        if (isChangingRole || isDeactivating) {
          const superAdminRole = await Role.findOne({ is_super_admin: true });
          const activeSuperAdminCount = await User.countDocuments({
            role_id: superAdminRole._id,
            status: 'Active'
          });

          if (activeSuperAdminCount <= 1) {
            return res.status(400).json({
              success: false,
              message: 'Cannot demote or deactivate the last active Super Admin in the system'
            });
          }
        }
      }

      if (name) employee.name = name.trim();
      if (email) employee.email = email.trim().toLowerCase();
      if (password) employee.password_hash = await User.hashPassword(password);
      if (role_id) employee.role_id = role_id;
      if (department_id !== undefined) employee.department_id = department_id || null;
      if (designation_id !== undefined) employee.designation_id = designation_id || null;
      if (branch_id !== undefined) employee.branch_id = branch_id || null;
      if (shift_id !== undefined) employee.shift_id = shift_id || null;
      if (dob !== undefined) employee.dob = parseDate(dob);
      if (date_of_joining !== undefined) employee.date_of_joining = parseDate(date_of_joining);
      if (salary !== undefined) employee.salary = Number(salary);
      if (phone !== undefined) employee.phone = phone.trim();
      if (address !== undefined) employee.address = address.trim();
      if (emergency_contact !== undefined) employee.emergency_contact = emergency_contact.trim();
      if (photo_url !== undefined) employee.photo_url = photo_url;
      if (attendance_exempt !== undefined) employee.attendance_exempt = Boolean(attendance_exempt);
      if (bank_details) employee.bank_details = { ...employee.bank_details, ...bank_details };
      if (identity_documents) employee.identity_documents = { ...employee.identity_documents, ...identity_documents };
      if (education_documents) employee.education_documents = { ...employee.education_documents, ...education_documents };
      if (status) employee.status = status;

    } else {
      // Employee self-service edit: strictly whitelist personal fields
      const {
        dob,
        phone,
        address,
        emergency_contact,
        photo_url,
        bank_details,
        identity_documents,
        education_documents
      } = req.body;

      if (dob !== undefined) employee.dob = parseDate(dob);
      if (phone !== undefined) employee.phone = phone.trim();
      if (address !== undefined) employee.address = address.trim();
      if (emergency_contact !== undefined) employee.emergency_contact = emergency_contact.trim();
      if (photo_url !== undefined) employee.photo_url = photo_url;
      if (bank_details) employee.bank_details = { ...employee.bank_details, ...bank_details };
      if (identity_documents) employee.identity_documents = { ...employee.identity_documents, ...identity_documents };
      if (education_documents) employee.education_documents = { ...employee.education_documents, ...education_documents };
      // All other restricted fields (role_id, salary, employee_code, department_id, etc.) are stripped
    }

    await employee.save();

    const sanitized = employee.toObject();
    delete sanitized.password_hash;

    await AuditLog.record(req.user._id, 'EMPLOYEE', 'UPDATE', oldVal, sanitized, req);

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully',
      data: sanitized
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Upload documents & KYC files for employee
 * @route   POST /api/employees/:id/upload-documents
 * @access  Private (Super Admin or Self)
 */
const uploadEmployeeDocuments = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const isSuperAdmin = req.user.role_id?.is_super_admin || req.user.role_id?.code === 'SUPER_ADMIN';
    const isSelf = targetId === req.user._id.toString();

    if (!isSuperAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You cannot upload documents for another employee'
      });
    }

    const employee = await User.findById(targetId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const files = req.files || {};
    const oldDocs = {
      photo_url: employee.photo_url,
      identity_documents: employee.identity_documents,
      education_documents: employee.education_documents
    };

    if (files.photo && files.photo[0]) {
      const uploadRes = await uploadToCloudinary(files.photo[0].buffer, 'nexalliance_hrm/photos');
      employee.photo_url = uploadRes.secure_url;
    }
    if (files.aadhar_card && files.aadhar_card[0]) {
      employee.identity_documents = employee.identity_documents || {};
      const uploadRes = await uploadToCloudinary(files.aadhar_card[0].buffer, 'nexalliance_hrm/documents');
      employee.identity_documents.aadhar_card_url = uploadRes.secure_url;
    }
    if (files.pan_card && files.pan_card[0]) {
      employee.identity_documents = employee.identity_documents || {};
      const uploadRes = await uploadToCloudinary(files.pan_card[0].buffer, 'nexalliance_hrm/documents');
      employee.identity_documents.pan_card_url = uploadRes.secure_url;
    }
    if (files.tenth_marksheet && files.tenth_marksheet[0]) {
      employee.education_documents = employee.education_documents || {};
      const uploadRes = await uploadToCloudinary(files.tenth_marksheet[0].buffer, 'nexalliance_hrm/documents');
      employee.education_documents.tenth_marksheet_url = uploadRes.secure_url;
    }
    if (files.twelfth_marksheet && files.twelfth_marksheet[0]) {
      employee.education_documents = employee.education_documents || {};
      const uploadRes = await uploadToCloudinary(files.twelfth_marksheet[0].buffer, 'nexalliance_hrm/documents');
      employee.education_documents.twelfth_marksheet_url = uploadRes.secure_url;
    }
    if (files.diploma_marksheet && files.diploma_marksheet[0]) {
      employee.education_documents = employee.education_documents || {};
      const uploadRes = await uploadToCloudinary(files.diploma_marksheet[0].buffer, 'nexalliance_hrm/documents');
      employee.education_documents.diploma_marksheet_url = uploadRes.secure_url;
    }
    if (files.graduation_certificate && files.graduation_certificate[0]) {
      employee.education_documents = employee.education_documents || {};
      const uploadRes = await uploadToCloudinary(files.graduation_certificate[0].buffer, 'nexalliance_hrm/documents');
      employee.education_documents.graduation_certificate_url = uploadRes.secure_url;
    }

    await employee.save();

    await AuditLog.record(
      req.user._id,
      'EMPLOYEE',
      'UPLOAD_DOCUMENTS',
      oldDocs,
      {
        photo_url: employee.photo_url,
        identity_documents: employee.identity_documents,
        education_documents: employee.education_documents
      },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        photo_url: employee.photo_url,
        identity_documents: employee.identity_documents,
        education_documents: employee.education_documents
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate employee (soft-delete)
 * @route   DELETE /api/employees/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteEmployee = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const employee = await User.findById(targetId).populate('role_id');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Guard: Prevent deactivating the last active Super Admin
    if (employee.role_id?.is_super_admin) {
      const activeSuperAdminCount = await User.countDocuments({
        role_id: employee.role_id._id,
        status: 'Active'
      });

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last active Super Admin user in the system'
        });
      }
    }

    const oldVal = { status: employee.status };
    employee.status = 'Inactive';
    await employee.save();

    await AuditLog.record(req.user._id, 'EMPLOYEE', 'DEACTIVATE', oldVal, employee, req);

    res.status(200).json({
      success: true,
      message: 'Employee deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  uploadEmployeeDocuments,
  deleteEmployee
};
