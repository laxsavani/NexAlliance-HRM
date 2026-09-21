const SensitiveChangeRequest = require('../models/SensitiveChangeRequest');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { encrypt, decrypt } = require('../utils/cryptoUtils');

/**
 * @desc    Submit a sensitive field change request (Bank Account, PAN, Aadhaar)
 * @route   PUT /api/employees/me/sensitive-field
 * @access  Private (Self-service / Any authenticated user)
 */
const submitSensitiveFieldChange = async (req, res, next) => {
  try {
    const { field, new_value } = req.body;

    if (!field || !new_value) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both field (bank_account, pan, aadhaar) and new_value'
      });
    }

    const allowedFields = ['bank_account', 'pan', 'aadhaar'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: `Invalid field. Must be one of: ${allowedFields.join(', ')}`
      });
    }

    const encryptedValue = encrypt(String(new_value).trim());

    const changeRequest = await SensitiveChangeRequest.create({
      user_id: req.user._id,
      field,
      new_value_enc: encryptedValue,
      status: 'Pending'
    });

    await AuditLog.record(
      req.user._id,
      'EMPLOYEE',
      'SENSITIVE_FIELD_CHANGE_APPLIED',
      null,
      { request_id: changeRequest._id, field },
      req
    );

    res.status(201).json({
      success: true,
      message: `Sensitive change request for ${field} submitted successfully. Awaiting Super Admin approval.`,
      data: {
        id: changeRequest._id,
        field: changeRequest.field,
        status: changeRequest.status,
        createdAt: changeRequest.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all Sensitive Change Requests (Filterable by status)
 * @route   GET /api/sensitive-change-requests
 * @access  Private (SUPER_ADMIN only)
 */
const getSensitiveChangeRequests = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Super Admin permission required'
      });
    }

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const requests = await SensitiveChangeRequest.find(filter)
      .populate('user_id', 'employee_code name email department_id designation_id')
      .populate('decided_by', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Approve Sensitive Change Request & Commit Encrypted Data to User Record
 * @route   PUT /api/sensitive-change-requests/:id/approve
 * @access  Private (SUPER_ADMIN only)
 */
const approveSensitiveChangeRequest = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Super Admin permission required to approve sensitive changes'
      });
    }

    const changeRequest = await SensitiveChangeRequest.findById(req.params.id);
    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sensitive change request not found'
      });
    }

    if (changeRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Request cannot be approved as it is already ${changeRequest.status}`
      });
    }

    const user = await User.findById(changeRequest.user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found'
      });
    }

    // Decrypt to sync plain/masked properties
    const plainVal = decrypt(changeRequest.new_value_enc);

    // Apply encrypted field and structured sub-document fields
    if (changeRequest.field === 'bank_account') {
      user.bank_account_enc = changeRequest.new_value_enc;
      user.bank_details = user.bank_details || {};
      user.bank_details.account_number = plainVal;
    } else if (changeRequest.field === 'pan') {
      user.pan_enc = changeRequest.new_value_enc;
      user.identity_documents = user.identity_documents || {};
      user.identity_documents.pan_number = plainVal;
    } else if (changeRequest.field === 'aadhaar') {
      user.aadhaar_enc = changeRequest.new_value_enc;
      user.identity_documents = user.identity_documents || {};
      user.identity_documents.aadhar_number = plainVal;
    }

    await user.save();

    changeRequest.status = 'Approved';
    changeRequest.decided_by = req.user._id;
    changeRequest.decision_remark = req.body.remark || 'Approved by Super Admin';
    changeRequest.decided_at = new Date();
    await changeRequest.save();

    await AuditLog.record(
      req.user._id,
      'EMPLOYEE',
      'SENSITIVE_FIELD_APPROVE',
      null,
      { request_id: changeRequest._id, user_id: user._id, field: changeRequest.field },
      req
    );

    res.status(200).json({
      success: true,
      message: `Sensitive change request for ${changeRequest.field} approved and applied successfully`,
      data: changeRequest
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reject Sensitive Change Request (Leaves User Record Untouched)
 * @route   PUT /api/sensitive-change-requests/:id/reject
 * @access  Private (SUPER_ADMIN only)
 */
const rejectSensitiveChangeRequest = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Super Admin permission required to reject sensitive changes'
      });
    }

    const { remark } = req.body;
    if (!remark) {
      return res.status(400).json({
        success: false,
        message: 'Rejection remark is required'
      });
    }

    const changeRequest = await SensitiveChangeRequest.findById(req.params.id);
    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        message: 'Sensitive change request not found'
      });
    }

    if (changeRequest.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Request cannot be rejected as it is already ${changeRequest.status}`
      });
    }

    changeRequest.status = 'Rejected';
    changeRequest.decided_by = req.user._id;
    changeRequest.decision_remark = remark;
    changeRequest.decided_at = new Date();
    await changeRequest.save();

    await AuditLog.record(
      req.user._id,
      'EMPLOYEE',
      'SENSITIVE_FIELD_REJECT',
      null,
      { request_id: changeRequest._id, remark },
      req
    );

    res.status(200).json({
      success: true,
      message: `Sensitive change request for ${changeRequest.field} rejected`,
      data: changeRequest
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitSensitiveFieldChange,
  getSensitiveChangeRequests,
  approveSensitiveChangeRequest,
  rejectSensitiveChangeRequest
};
