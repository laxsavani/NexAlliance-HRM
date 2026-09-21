const mongoose = require('mongoose');
const ApprovalMatrix = require('../models/ApprovalMatrix');
const User = require('../models/User');
const Role = require('../models/Role');

/**
 * Resolves the approver chain snapshot dynamically using the 3-tier precedence algorithm:
 * 1. User-specific row (USER)
 * 2. Department-specific row (DEPARTMENT)
 * 3. Role default row (ROLE - Matrix A defaults)
 * 
 * Requester's own User ID is ALWAYS stripped from candidate approvers to prevent self-approval.
 * 
 * @param {Object|string} userOrId - Populated user document or User ObjectId
 * @param {string} module - 'LEAVE' | 'REGULARIZATION' (default: 'LEAVE')
 * @returns {Promise<{ approverIds: Array<mongoose.Types.ObjectId>, approvalsNeeded: number, rule: string, levelNo: number }>}
 */
const resolveApprovers = async (userOrId, module = 'LEAVE') => {
  let user = userOrId;
  if (!user || !user._id || !user.role_id) {
    user = await User.findById(userOrId).populate('role_id department_id');
  }

  if (!user) {
    return {
      approverIds: [],
      approvalsNeeded: 0,
      rule: 'ALL',
      levelNo: 1
    };
  }

  const userId = user._id;
  const deptId = user.department_id?._id || user.department_id || null;
  const roleId = user.role_id?._id || user.role_id || null;

  const tryExpandApprovers = async (matrixRow) => {
    if (!matrixRow || !Array.isArray(matrixRow.approvers) || matrixRow.approvers.length === 0) {
      return null;
    }

    const rawApproverIds = [];

    for (const appDef of matrixRow.approvers) {
      if (appDef.approver_type === 'USER') {
        const targetUser = await User.findOne({ _id: appDef.approver_ref, status: 'Active' });
        if (targetUser) {
          rawApproverIds.push(targetUser._id);
        }
      } else if (appDef.approver_type === 'ROLE') {
        const roleUsers = await User.find({ role_id: appDef.approver_ref, status: 'Active' });
        for (const ru of roleUsers) {
          rawApproverIds.push(ru._id);
        }
      }
    }

    // Deduplicate and strictly strip requester's own ID (no self-approval)
    const uniqueApproverIds = [];
    const seen = new Set();

    for (const id of rawApproverIds) {
      const idStr = id.toString();
      if (idStr !== userId.toString() && !seen.has(idStr)) {
        seen.add(idStr);
        uniqueApproverIds.push(id);
      }
    }

    if (uniqueApproverIds.length === 0) {
      return null; // Fall through to next tier
    }

    const approvalsNeeded =
      matrixRow.rule === 'ANY'
        ? 1
        : Math.min(matrixRow.approvers.length, uniqueApproverIds.length);

    return {
      approverIds: uniqueApproverIds,
      approvalsNeeded,
      rule: matrixRow.rule,
      levelNo: matrixRow.level_no || 1
    };
  };

  // 1. Tier 1: Look up USER-specific row
  let row = await ApprovalMatrix.findOne({
    requester_type: 'USER',
    requester_ref: userId,
    module,
    is_active: true
  });
  let tierRes = await tryExpandApprovers(row);
  if (tierRes) return tierRes;

  // 2. Tier 2: Look up DEPARTMENT-specific row
  if (deptId) {
    row = await ApprovalMatrix.findOne({
      requester_type: 'DEPARTMENT',
      requester_ref: deptId,
      module,
      is_active: true
    });
    tierRes = await tryExpandApprovers(row);
    if (tierRes) return tierRes;
  }

  // 3. Tier 3: Look up ROLE-specific row (Matrix A Defaults)
  if (roleId) {
    row = await ApprovalMatrix.findOne({
      requester_type: 'ROLE',
      requester_ref: roleId,
      module,
      is_active: true
    });
    tierRes = await tryExpandApprovers(row);
    if (tierRes) return tierRes;
  }

  // 4. Special Fallback for REGULARIZATION (Locked Super Admin row)
  if (module === 'REGULARIZATION') {
    row = await ApprovalMatrix.findOne({
      module: 'REGULARIZATION',
      is_locked: true,
      is_active: true
    });
    tierRes = await tryExpandApprovers(row);
    if (tierRes) return tierRes;
  }

  // Hard fallback to Matrix A defaults if database was not seeded yet
  const roleCode = user.role_id?.code || '';
  const ceoRole = await Role.findOne({ code: 'CEO' });
  const ctoRole = await Role.findOne({ code: 'CTO' });

  const ceos = ceoRole ? await User.find({ role_id: ceoRole._id, status: 'Active' }) : [];
  const ctos = ctoRole ? await User.find({ role_id: ctoRole._id, status: 'Active' }) : [];

  const candidateApprovers = [];

  if (roleCode === 'CTO') {
    if (ceos[0] && ceos[0]._id.toString() !== userId.toString()) {
      candidateApprovers.push(ceos[0]._id);
    }
    return {
      approverIds: candidateApprovers,
      approvalsNeeded: candidateApprovers.length > 0 ? 1 : 0,
      rule: 'ALL',
      levelNo: 1
    };
  }

  if (roleCode === 'CEO') {
    if (ctos[0] && ctos[0]._id.toString() !== userId.toString()) {
      candidateApprovers.push(ctos[0]._id);
    }
    return {
      approverIds: candidateApprovers,
      approvalsNeeded: candidateApprovers.length > 0 ? 1 : 0,
      rule: 'ALL',
      levelNo: 1
    };
  }

  // Default for Employee and all other roles
  if (ceos[0] && ceos[0]._id.toString() !== userId.toString()) {
    candidateApprovers.push(ceos[0]._id);
  }
  if (ctos[0] && ctos[0]._id.toString() !== userId.toString()) {
    candidateApprovers.push(ctos[0]._id);
  }

  return {
    approverIds: candidateApprovers,
    approvalsNeeded: candidateApprovers.length,
    rule: 'ALL',
    levelNo: 1
  };
};

module.exports = {
  resolveApprovers
};
