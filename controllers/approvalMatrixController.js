const ApprovalMatrix = require('../models/ApprovalMatrix');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Role = require('../models/Role');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get Approval Matrix configurations (Super Admin / CEO / CTO: ALL)
 * @route   GET /api/approval-matrix
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getApprovalMatrix = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view the Approval Matrix'
      });
    }

    const { requester_type, requester_ref, module: mod, is_active } = req.query;

    const filter = {};
    if (requester_type) filter.requester_type = requester_type;
    if (requester_ref) filter.requester_ref = requester_ref;
    if (mod) filter.module = mod;
    if (is_active !== undefined) filter.is_active = is_active === 'true';

    const rows = await ApprovalMatrix.find(filter).sort({ module: 1, requester_type: 1, createdAt: -1 });

    // Populate dynamic references
    const populatedRows = await Promise.all(
      rows.map(async (row) => {
        const rowObj = row.toObject();

        // Populate requester_ref
        if (row.requester_type === 'USER') {
          rowObj.requester = await User.findById(row.requester_ref).select('name employee_code email department_id');
        } else if (row.requester_type === 'DEPARTMENT') {
          rowObj.requester = await Department.findById(row.requester_ref).select('name code');
        } else if (row.requester_type === 'ROLE') {
          rowObj.requester = await Role.findById(row.requester_ref).select('name code');
        }

        // Populate approvers
        rowObj.approvers_detail = await Promise.all(
          row.approvers.map(async (app) => {
            if (app.approver_type === 'USER') {
              const u = await User.findById(app.approver_ref).select('name employee_code email');
              return { ...app.toObject(), detail: u };
            } else if (app.approver_type === 'ROLE') {
              const r = await Role.findById(app.approver_ref).select('name code');
              return { ...app.toObject(), detail: r };
            }
            return app;
          })
        );

        return rowObj;
      })
    );

    res.status(200).json({
      success: true,
      count: populatedRows.length,
      data: populatedRows
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create Approval Matrix Row (Super Admin only)
 * @route   POST /api/approval-matrix
 * @access  Private (SUPER_ADMIN only)
 */
const createApprovalMatrixRow = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can configure Approval Matrix'
      });
    }

    const {
      requester_type,
      requester_ref,
      module: mod,
      approvers,
      rule = 'ALL',
      level_no = 1
    } = req.body;

    if (!requester_type || !requester_ref || !mod || !approvers || !Array.isArray(approvers) || approvers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide requester_type, requester_ref, module, and at least one approver'
      });
    }

    // Guard: Regularization is locked to Super Admin only and cannot be configured
    if (mod === 'REGULARIZATION') {
      return res.status(400).json({
        success: false,
        message: 'Regularization approval chain is permanently locked to Super Admin only and cannot be configured'
      });
    }

    // Config-time Self-Approval Guard
    if (requester_type === 'USER') {
      const selfApprover = approvers.some(
        (app) => app.approver_type === 'USER' && app.approver_ref.toString() === requester_ref.toString()
      );
      if (selfApprover) {
        return res.status(400).json({
          success: false,
          message: 'Self-approval is forbidden: An employee cannot be assigned as their own approver'
        });
      }
    }

    // Check for existing duplicate mapping
    const existing = await ApprovalMatrix.findOne({
      requester_type,
      requester_ref,
      module: mod
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An approval matrix configuration already exists for this ${requester_type} and module [${mod}]. Please edit the existing row instead.`
      });
    }

    const matrixRow = await ApprovalMatrix.create({
      requester_type,
      requester_ref,
      module: mod,
      approvers,
      rule,
      level_no,
      is_active: true,
      is_locked: false
    });

    await AuditLog.record(
      req.user._id,
      'APPROVAL_MATRIX',
      'CREATE_APPROVAL_MAPPING',
      null,
      matrixRow,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Approval matrix mapping created successfully',
      data: matrixRow
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update Approval Matrix Row (Super Admin only)
 * @route   PUT /api/approval-matrix/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateApprovalMatrixRow = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can update Approval Matrix'
      });
    }

    const matrixRow = await ApprovalMatrix.findById(req.params.id);
    if (!matrixRow) {
      return res.status(404).json({
        success: false,
        message: 'Approval matrix configuration not found'
      });
    }

    // Guard: Locked row cannot be updated
    if (matrixRow.is_locked) {
      return res.status(400).json({
        success: false,
        message: 'This approval matrix row is locked by the system and cannot be modified'
      });
    }

    // Guard: Module cannot be changed to REGULARIZATION
    if (req.body.module === 'REGULARIZATION') {
      return res.status(400).json({
        success: false,
        message: 'Regularization approval chain is permanently locked to Super Admin only and cannot be configured'
      });
    }

    const oldState = matrixRow.toObject();

    const requesterType = req.body.requester_type || matrixRow.requester_type;
    const requesterRef = req.body.requester_ref || matrixRow.requester_ref;
    const approvers = req.body.approvers || matrixRow.approvers;

    // Config-time Self-Approval Guard
    if (requesterType === 'USER' && Array.isArray(approvers)) {
      const selfApprover = approvers.some(
        (app) => app.approver_type === 'USER' && app.approver_ref.toString() === requesterRef.toString()
      );
      if (selfApprover) {
        return res.status(400).json({
          success: false,
          message: 'Self-approval is forbidden: An employee cannot be assigned as their own approver'
        });
      }
    }

    if (req.body.requester_type) matrixRow.requester_type = req.body.requester_type;
    if (req.body.requester_ref) matrixRow.requester_ref = req.body.requester_ref;
    if (req.body.module) matrixRow.module = req.body.module;
    if (req.body.approvers) matrixRow.approvers = req.body.approvers;
    if (req.body.rule) matrixRow.rule = req.body.rule;
    if (req.body.level_no !== undefined) matrixRow.level_no = req.body.level_no;
    if (req.body.is_active !== undefined) matrixRow.is_active = req.body.is_active;

    await matrixRow.save();

    await AuditLog.record(
      req.user._id,
      'APPROVAL_MATRIX',
      'UPDATE_APPROVAL_MAPPING',
      oldState,
      matrixRow,
      req
    );

    res.status(200).json({
      success: true,
      message: 'Approval matrix mapping updated successfully',
      data: matrixRow
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Soft Delete Approval Matrix Row (Super Admin only)
 * @route   DELETE /api/approval-matrix/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteApprovalMatrixRow = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can delete Approval Matrix rows'
      });
    }

    const matrixRow = await ApprovalMatrix.findById(req.params.id);
    if (!matrixRow) {
      return res.status(404).json({
        success: false,
        message: 'Approval matrix configuration not found'
      });
    }

    // Guard: Locked row cannot be deleted
    if (matrixRow.is_locked) {
      return res.status(400).json({
        success: false,
        message: 'This approval matrix row is locked by the system and cannot be deleted'
      });
    }

    matrixRow.is_active = false;
    await matrixRow.save();

    await AuditLog.record(
      req.user._id,
      'APPROVAL_MATRIX',
      'DEACTIVATE_APPROVAL_MAPPING',
      { is_active: true },
      { is_active: false },
      req
    );

    res.status(200).json({
      success: true,
      message: 'Approval matrix mapping deactivated successfully'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Pending Approvals For Me (Derived for current user)
 * @route   GET /api/approvals/pending-for-me
 * @access  Private (Any authenticated user)
 */
const getPendingApprovalsForMe = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all Pending Leave requests where caller is in approvers list
    const pendingRequests = await LeaveRequest.find({
      status: 'Pending',
      approvers: userId
    })
      .populate({
        path: 'user_id',
        select: 'name employee_code email department_id designation_id branch_id',
        populate: [
          { path: 'department_id', select: 'name code' },
          { path: 'designation_id', select: 'name code' },
          { path: 'branch_id', select: 'name' }
        ]
      })
      .populate('leave_type_id')
      .sort({ createdAt: -1 });

    // Filter out requests where the caller has ALREADY submitted an approval action
    const awaitingDecision = pendingRequests.filter((lr) => {
      const alreadyActed = lr.approvals.some(
        (a) => a.approver_id && a.approver_id.toString() === userId.toString()
      );
      return !alreadyActed;
    });

    res.status(200).json({
      success: true,
      count: awaitingDecision.length,
      data: awaitingDecision
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getApprovalMatrix,
  createApprovalMatrixRow,
  updateApprovalMatrixRow,
  deleteApprovalMatrixRow,
  getPendingApprovalsForMe
};
