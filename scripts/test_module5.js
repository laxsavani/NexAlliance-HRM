const http = require('http');
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Shift = require('../models/Shift');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveLedger = require('../models/LeaveLedger');
const ApprovalMatrix = require('../models/ApprovalMatrix');
const { resolveApprovers } = require('../services/approvalMatrixService');

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (body) headers['Content-Length'] = Buffer.byteLength(dataString);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(dataString);
    req.end();
  });
};

const runTests = async () => {
  console.log('🧪 Starting Automated Module 5 (Approval & Reporting Matrix) Test Suite...\n');
  await connectDB();

  let adminToken, ceoToken, ctoToken, empAToken, empBToken, empCToken;
  let superAdminUser, ceoUser, ctoUser, empAUser, empBUser, empCUser;
  let itDept, execDept, casualLeaveType;

  try {
    // ========================================================
    // 1️⃣ Authenticating Super Admin & Setting up Users
    // ========================================================
    console.log('1️⃣ Setting up Test Organization, Roles, and Users...');
    const adminRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    if (adminRes.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(adminRes.body));
    adminToken = adminRes.body.token;
    superAdminUser = adminRes.body.user;

    const empRole = await Role.findOne({ code: 'EMPLOYEE' });
    const ceoRole = await Role.findOne({ code: 'CEO' });
    const ctoRole = await Role.findOne({ code: 'CTO' });
    const branch = await Branch.findOne();
    const shift = await Shift.findOne();
    const seDesig = await Designation.findOne();
    itDept = await Department.findOne({ code: 'IT' });
    execDept = await Department.findOne({ code: 'EXEC' });
    casualLeaveType = await LeaveType.findOne({ code: 'CL' });

    const passwordHash = await User.hashPassword('Password@123');

    // Create/Ensure CEO and CTO users
    ceoUser = await User.findOneAndUpdate(
      { email: 'test.ceo@nexalliance.com' },
      {
        $set: {
          employee_code: 'CEO-0001',
          name: 'Executive CEO',
          email: 'test.ceo@nexalliance.com',
          password_hash: passwordHash,
          role_id: ceoRole._id,
          department_id: execDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    ctoUser = await User.findOneAndUpdate(
      { email: 'test.cto@nexalliance.com' },
      {
        $set: {
          employee_code: 'CTO-0001',
          name: 'Executive CTO',
          email: 'test.cto@nexalliance.com',
          password_hash: passwordHash,
          role_id: ctoRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Create Emp A (IT Dept), Emp B (IT Dept), Emp C (EXEC Dept)
    empAUser = await User.findOneAndUpdate(
      { email: 'empa.it@nexalliance.com' },
      {
        $set: {
          employee_code: 'EMP-IT-01',
          name: 'Employee A (IT)',
          email: 'empa.it@nexalliance.com',
          password_hash: passwordHash,
          role_id: empRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    empBUser = await User.findOneAndUpdate(
      { email: 'empb.it@nexalliance.com' },
      {
        $set: {
          employee_code: 'EMP-IT-02',
          name: 'Employee B (IT)',
          email: 'empb.it@nexalliance.com',
          password_hash: passwordHash,
          role_id: empRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    empCUser = await User.findOneAndUpdate(
      { email: 'empc.exec@nexalliance.com' },
      {
        $set: {
          employee_code: 'EMP-EX-01',
          name: 'Employee C (EXEC)',
          email: 'empc.exec@nexalliance.com',
          password_hash: passwordHash,
          role_id: empRole._id,
          department_id: execDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Logins
    const ceoLogin = await request('POST', '/api/auth/login', { email: 'test.ceo@nexalliance.com', password: 'Password@123' });
    ceoToken = ceoLogin.body.token;

    const ctoLogin = await request('POST', '/api/auth/login', { email: 'test.cto@nexalliance.com', password: 'Password@123' });
    ctoToken = ctoLogin.body.token;

    const empALogin = await request('POST', '/api/auth/login', { email: 'empa.it@nexalliance.com', password: 'Password@123' });
    empAToken = empALogin.body.token;

    const empBLogin = await request('POST', '/api/auth/login', { email: 'empb.it@nexalliance.com', password: 'Password@123' });
    empBToken = empBLogin.body.token;

    const empCLogin = await request('POST', '/api/auth/login', { email: 'empc.exec@nexalliance.com', password: 'Password@123' });
    empCToken = empCLogin.body.token;

    console.log('   ✓ Super Admin, CEO, CTO, and 3 test employees authenticated.');

    // ========================================================
    // 2️⃣ Testing Approval Matrix Access Control
    // ========================================================
    console.log('2️⃣ Verifying Approval Matrix Access Control...');
    const adminMatrixRes = await request('GET', '/api/approval-matrix', null, adminToken);
    console.log(`   Admin View: Status ${adminMatrixRes.status}, Found ${adminMatrixRes.body.count} configured rows`);

    const ceoMatrixRes = await request('GET', '/api/approval-matrix', null, ceoToken);
    console.log(`   CEO View: Status ${ceoMatrixRes.status}, Found ${ceoMatrixRes.body.count} rows (Read-only ALL)`);

    const empMatrixRes = await request('GET', '/api/approval-matrix', null, empAToken);
    console.log(`   Employee View: Status ${empMatrixRes.status} (Expected: 403 Forbidden) - ${empMatrixRes.body?.message}`);
    if (empMatrixRes.status !== 403) throw new Error('Employee should not be allowed to view approval matrix');

    // ========================================================
    // 3️⃣ Testing Regularization Lock Guard
    // ========================================================
    console.log('3️⃣ Verifying Regularization Lock Guard...');
    const createRegRes = await request('POST', '/api/approval-matrix', {
      requester_type: 'DEPARTMENT',
      requester_ref: itDept._id,
      module: 'REGULARIZATION',
      approvers: [{ approver_type: 'USER', approver_ref: ceoUser._id }]
    }, adminToken);
    console.log(`   Create REGULARIZATION mapping: Status ${createRegRes.status} (Expected: 400 Bad Request) - ${createRegRes.body?.message}`);
    if (createRegRes.status !== 400) throw new Error('Should block configuring REGULARIZATION module');

    // Attempt to edit or delete locked Regularization row
    const lockedRow = await ApprovalMatrix.findOne({ module: 'REGULARIZATION', is_locked: true });
    if (lockedRow) {
      const editLockedRes = await request('PUT', `/api/approval-matrix/${lockedRow._id}`, { rule: 'ANY' }, adminToken);
      console.log(`   Edit Locked Row: Status ${editLockedRes.status} (Expected: 400 Bad Request) - ${editLockedRes.body?.message}`);
      if (editLockedRes.status !== 400) throw new Error('Should block editing locked row');

      const deleteLockedRes = await request('DELETE', `/api/approval-matrix/${lockedRow._id}`, null, adminToken);
      console.log(`   Delete Locked Row: Status ${deleteLockedRes.status} (Expected: 400 Bad Request) - ${deleteLockedRes.body?.message}`);
      if (deleteLockedRes.status !== 400) throw new Error('Should block deleting locked row');
    }

    // ========================================================
    // 4️⃣ Testing Config-time Self-Approval Guard
    // ========================================================
    console.log('4️⃣ Testing Config-time Self-Approval Prevention...');
    const selfAppRes = await request('POST', '/api/approval-matrix', {
      requester_type: 'USER',
      requester_ref: empAUser._id,
      module: 'LEAVE',
      approvers: [{ approver_type: 'USER', approver_ref: empAUser._id }]
    }, adminToken);
    console.log(`   Self-Approver Config: Status ${selfAppRes.status} (Expected: 400 Bad Request) - ${selfAppRes.body?.message}`);
    if (selfAppRes.status !== 400) throw new Error('Should block assigning employee as their own approver');

    // ========================================================
    // 5️⃣ Testing Precedence Engine (USER > DEPARTMENT > ROLE)
    // ========================================================
    console.log('5️⃣ Testing 3-Tier Precedence Engine (USER > DEPARTMENT > ROLE)...');

    // Clean any prior test mappings for our test entities
    await ApprovalMatrix.deleteMany({
      $or: [
        { requester_type: 'DEPARTMENT', requester_ref: itDept._id },
        { requester_type: 'USER', requester_ref: empAUser._id }
      ]
    });

    // 1. Create Department-tier mapping for IT Department -> CTO is the single approver
    const deptMatrixRes = await request('POST', '/api/approval-matrix', {
      requester_type: 'DEPARTMENT',
      requester_ref: itDept._id,
      module: 'LEAVE',
      rule: 'ALL',
      level_no: 1,
      approvers: [{ approver_type: 'USER', approver_ref: ctoUser._id }]
    }, adminToken);
    console.log(`   ✓ Created Department-tier mapping for IT Dept (Approver: CTO, Status: ${deptMatrixRes.status})`);
    if (deptMatrixRes.status !== 201) throw new Error('Failed to create department-tier mapping');

    // 2. Create User-tier mapping for Emp A -> CEO is the single approver
    const userMatrixRes = await request('POST', '/api/approval-matrix', {
      requester_type: 'USER',
      requester_ref: empAUser._id,
      module: 'LEAVE',
      rule: 'ALL',
      level_no: 1,
      approvers: [{ approver_type: 'USER', approver_ref: ceoUser._id }]
    }, adminToken);
    const userMatrixId = userMatrixRes.body.data._id;
    console.log(`   ✓ Created User-tier mapping for Emp A (Approver: CEO, Status: ${userMatrixRes.status})`);
    if (userMatrixRes.status !== 201) throw new Error('Failed to create user-tier mapping');

    // Test Resolution for Emp A (Has USER row, DEPARTMENT row, and ROLE row)
    const empAResolution = await resolveApprovers(empAUser, 'LEAVE');
    console.log(`   Emp A (IT) Resolution: Approvers: [${empAResolution.approverIds}], Needed: ${empAResolution.approvalsNeeded}`);
    if (
      empAResolution.approverIds.length === 1 &&
      empAResolution.approverIds[0].toString() === ceoUser._id.toString()
    ) {
      console.log('   ✓ PASS: Emp A resolved to CEO via USER-tier row (Tier 1 won over Department and Role)');
    } else {
      throw new Error('Precedence failed for Emp A (USER tier)');
    }

    // Test Resolution for Emp B (Has DEPARTMENT row and ROLE row, NO USER row)
    const empBResolution = await resolveApprovers(empBUser, 'LEAVE');
    console.log(`   Emp B (IT) Resolution: Approvers: [${empBResolution.approverIds}], Needed: ${empBResolution.approvalsNeeded}`);
    if (
      empBResolution.approverIds.length === 1 &&
      empBResolution.approverIds[0].toString() === ctoUser._id.toString()
    ) {
      console.log('   ✓ PASS: Emp B resolved to CTO via DEPARTMENT-tier row (Tier 2 won over Role)');
    } else {
      throw new Error('Precedence failed for Emp B (DEPARTMENT tier)');
    }

    const empCResolution = await resolveApprovers(empCUser, 'LEAVE');
    console.log(`   Emp C (EXEC) Resolution: Approvers: [${empCResolution.approverIds.length} candidate approvers], Needed: ${empCResolution.approvalsNeeded}`);
    if (empCResolution.approvalsNeeded === 2 && empCResolution.approverIds.length >= 2) {
      console.log('   ✓ PASS: Emp C resolved to CEO+CTO via ROLE-tier row (Tier 3 fallback, Approvals Needed: 2)');
    } else {
      throw new Error('Precedence failed for Emp C (ROLE tier default)');
    }

    // ========================================================
    // 6️⃣ Testing Runtime Self-Approval Stripping
    // ========================================================
    console.log('6️⃣ Testing Runtime Self-Approval Stripping...');
    const ctoResolution = await resolveApprovers(ctoUser, 'LEAVE');
    console.log(`   CTO Resolution: Approvers: [${ctoResolution.approverIds}], Approvals Needed: ${ctoResolution.approvalsNeeded}`);
    const hasSelf = ctoResolution.approverIds.some(id => id.toString() === ctoUser._id.toString());
    const resolvedApproverUser = await User.findById(ctoResolution.approverIds[0]);
    if (
      ctoResolution.approvalsNeeded === 1 &&
      !hasSelf &&
      ctoResolution.approverIds.length > 0 &&
      resolvedApproverUser &&
      resolvedApproverUser.role_id.toString() === ceoRole._id.toString()
    ) {
      console.log('   ✓ PASS: CTO requester successfully excluded themselves and resolved solely to CEO role holders (Approvals Needed: 1)');
    } else {
      throw new Error('Self-approval stripping failed for CTO');
    }

    // ========================================================
    // 7️⃣ Testing Emergency Override Decision (Super Admin)
    // ========================================================
    console.log('7️⃣ Testing Super Admin Emergency Override Decision...');

    // Clean up test leave requests and balances for clean run
    await LeaveRequest.deleteMany({ user_id: { $in: [empAUser._id, empBUser._id, empCUser._id] } });
    await LeaveBalance.deleteMany({ user_id: { $in: [empAUser._id, empBUser._id, empCUser._id] } });
    await LeaveLedger.deleteMany({ user_id: { $in: [empAUser._id, empBUser._id, empCUser._id] } });

    // Credit leave balance for Emp A
    await request('POST', '/api/leaves/adjust-balance', {
      user_id: empAUser._id,
      leave_type_id: casualLeaveType._id,
      year: 2026,
      qty: 5,
      reason: 'Initial test balance'
    }, adminToken);

    // Emp A applies for leave (dates 10/11/2026 to 11/11/2026 = 2 days)
    const leaveAppRes = await request('POST', '/api/leaves', {
      leave_type_id: casualLeaveType._id,
      from_date: '10/11/2026',
      to_date: '11/11/2026',
      day_part: 'FULL',
      reason: 'Personal family emergency'
    }, empAToken);
    const leaveReqId = leaveAppRes.body.data._id;
    console.log(`   Emp A Applied Leave: Request ID ${leaveReqId}, Status: ${leaveAppRes.body.data.status}`);

    // Non-admin attempt to override -> 403
    const nonAdminOverrideRes = await request('PUT', `/api/leaves/${leaveReqId}/override-decision`, {
      decision: 'APPROVED',
      reason: 'Attempted non-admin override'
    }, ceoToken);
    console.log(`   Non-Admin Override Attempt: Status ${nonAdminOverrideRes.status} (Expected: 403 Forbidden) - ${nonAdminOverrideRes.body?.message}`);
    if (nonAdminOverrideRes.status !== 403) throw new Error('Non-admin should not be allowed to execute override');

    // Admin attempt without reason -> 400
    const emptyReasonRes = await request('PUT', `/api/leaves/${leaveReqId}/override-decision`, {
      decision: 'APPROVED',
      reason: ''
    }, adminToken);
    console.log(`   Empty Reason Override: Status ${emptyReasonRes.status} (Expected: 400 Bad Request) - ${emptyReasonRes.body?.message}`);
    if (emptyReasonRes.status !== 400) throw new Error('Missing reason should be blocked');

    // Super Admin executes Emergency Override Approval
    const overrideApproveRes = await request('PUT', `/api/leaves/${leaveReqId}/override-decision`, {
      decision: 'APPROVED',
      reason: 'Super Admin executive emergency override for critical project delivery'
    }, adminToken);
    console.log(`   Override Approve Status: ${overrideApproveRes.status}, New Status: ${overrideApproveRes.body.data.status}, is_override: ${overrideApproveRes.body.data.is_override}`);
    if (overrideApproveRes.status !== 200 || overrideApproveRes.body.data.status !== 'Approved') {
      throw new Error('Super Admin emergency override approval failed');
    }

    // Verify Balance effect: used += 2, pending -= 2
    const balanceAfterOverride = await LeaveBalance.findOne({
      user_id: empAUser._id,
      leave_type_id: casualLeaveType._id,
      year: 2026
    });
    console.log(`   Balance Verified: Used: ${balanceAfterOverride.used}, Pending: ${balanceAfterOverride.pending}, Available: ${balanceAfterOverride.available}`);
    if (balanceAfterOverride.used === 2 && balanceAfterOverride.pending === 0) {
      console.log('   ✓ PASS: Leave balance accurately debited on emergency override');
    } else {
      throw new Error('Balance deduction failed on override');
    }

    // ========================================================
    // 8️⃣ Testing Pending-For-Me Endpoint
    // ========================================================
    console.log('8️⃣ Testing GET /api/approvals/pending-for-me Endpoint...');

    // Emp B applies for 1 day leave -> Resolves to CTO
    await request('POST', '/api/leaves/adjust-balance', {
      user_id: empBUser._id,
      leave_type_id: casualLeaveType._id,
      year: 2026,
      qty: 5,
      reason: 'Emp B test balance'
    }, adminToken);

    const empBLeaveRes = await request('POST', '/api/leaves', {
      leave_type_id: casualLeaveType._id,
      from_date: '15/11/2026',
      to_date: '15/11/2026',
      day_part: 'FULL',
      reason: 'Annual doctor checkup'
    }, empBToken);
    console.log(`   Emp B Applied Leave: Request ID ${empBLeaveRes.body.data._id}, Assigned Approvers: [${empBLeaveRes.body.data.approvers}]`);

    // Check Employee A's pending queue -> Should be 0 (Employees are never approvers)
    const empAPendingRes = await request('GET', '/api/approvals/pending-for-me', null, empAToken);
    console.log(`   Emp A Pending Queue: Count ${empAPendingRes.body.count} (Status: ${empAPendingRes.status})`);
    if (empAPendingRes.body.count !== 0) throw new Error('Employee should have 0 pending approvals');

    // Check CTO's pending queue -> Should include Emp B's request
    const ctoPendingRes = await request('GET', '/api/approvals/pending-for-me', null, ctoToken);
    console.log(`   CTO Pending Queue: Count ${ctoPendingRes.body.count} (Includes Emp B request: ${ctoPendingRes.body.data.some(r => r._id.toString() === empBLeaveRes.body.data._id.toString())})`);
    if (!ctoPendingRes.body.data.some(r => r._id.toString() === empBLeaveRes.body.data._id.toString())) {
      throw new Error('Emp B request missing from CTO pending queue');
    }

    // ========================================================
    // 9️⃣ Testing Deactivation / Soft Delete of Matrix Row
    // ========================================================
    console.log('9️⃣ Testing Soft Delete of User-Tier Matrix Row & Fallback...');
    const deleteRes = await request('DELETE', `/api/approval-matrix/${userMatrixId}`, null, adminToken);
    console.log(`   Deactivated User-tier mapping for Emp A (Status: ${deleteRes.status})`);
    if (deleteRes.status !== 200) throw new Error('Failed to delete user-tier mapping');

    // Now Emp A should fall back to IT Department row (Approver: CTO) instead of User row (CEO)
    const empAFallbackRes = await resolveApprovers(empAUser, 'LEAVE');
    console.log(`   Emp A Fallback Resolution: Approver: [${empAFallbackRes.approverIds}] (Expected CTO: ${ctoUser._id})`);
    if (
      empAFallbackRes.approverIds.length === 1 &&
      empAFallbackRes.approverIds[0].toString() === ctoUser._id.toString()
    ) {
      console.log('   ✓ PASS: Emp A seamlessly fell back to DEPARTMENT tier after USER-tier row was deactivated');
    } else {
      throw new Error('Fallback failed after deactivating USER-tier row');
    }

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 5 (APPROVAL & REPORTING MATRIX) TESTS PASSED!');
    console.log('=============================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ MODULE 5 TEST FAILED:', error.message || error);
    process.exit(1);
  }
};

runTests();
