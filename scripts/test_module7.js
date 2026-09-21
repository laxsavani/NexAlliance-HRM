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
const LeaveRequest = require('../models/LeaveRequest');
const ApprovalMatrix = require('../models/ApprovalMatrix');
const RegularizationReason = require('../models/RegularizationReason');
const RegularizationRequest = require('../models/RegularizationRequest');
const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const SalaryComponent = require('../models/SalaryComponent');
const NotificationTemplate = require('../models/NotificationTemplate');
const Notification = require('../models/Notification');
const {
  resolvePlaceholders,
  sendNotification,
  runLeavePendingReminderJob
} = require('../services/notificationService');

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
  console.log('🧪 Starting Automated Module 7 (Notification Engine) Test Suite...\n');
  await connectDB();

  let adminToken, ceoToken, ctoToken, empToken;
  let superAdminUser, ceoUser, ctoUser, empUser;
  let clLeaveType, testReason, defaultShift, itDept, execDept;

  try {
    // ========================================================
    // 1️⃣ Authenticating Users & Setting up Accounts
    // ========================================================
    console.log('1️⃣ Authenticating Super Admin, CEO, CTO, and Test Employee...');
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
    defaultShift = await Shift.findOne();
    const seDesig = await Designation.findOne();
    itDept = await Department.findOne({ code: 'IT' });
    execDept = await Department.findOne({ code: 'EXEC' });
    clLeaveType = await LeaveType.findOne({ code: 'CL' });
    testReason = await RegularizationReason.findOne({ status: 'Active' });

    const passwordHash = await User.hashPassword('Password@123');

    ceoUser = await User.findOneAndUpdate(
      { email: 'test.ceo.notif@nexalliance.com' },
      {
        $set: {
          employee_code: 'CEO-NOTIF-01',
          name: 'Executive CEO Notif',
          email: 'test.ceo.notif@nexalliance.com',
          password_hash: passwordHash,
          role_id: ceoRole._id,
          department_id: execDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: defaultShift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    ctoUser = await User.findOneAndUpdate(
      { email: 'test.cto.notif@nexalliance.com' },
      {
        $set: {
          employee_code: 'CTO-NOTIF-01',
          name: 'Executive CTO Notif',
          email: 'test.cto.notif@nexalliance.com',
          password_hash: passwordHash,
          role_id: ctoRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: defaultShift._id,
          attendance_exempt: false,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    empUser = await User.findOneAndUpdate(
      { email: 'test.emp.notif@nexalliance.com' },
      {
        $set: {
          employee_code: 'EMP-NOTIF-01',
          name: 'Regular Employee Notif',
          email: 'test.emp.notif@nexalliance.com',
          password_hash: passwordHash,
          role_id: empRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: defaultShift._id,
          attendance_exempt: false,
          date_of_joining: new Date('2025-01-01'),
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Delete old leftover test CEO/CTO users to guarantee unique 1-to-1 approver mapping
    await User.deleteMany({
      email: { $in: ['test.ceo@nexalliance.com', 'test.cto@nexalliance.com', 'emp.a@nexalliance.com', 'emp.b@nexalliance.com', 'emp.c@nexalliance.com'] }
    });

    // Reset approval matrix to clean Matrix A role mappings
    await ApprovalMatrix.deleteMany({ requester_type: { $in: ['USER', 'DEPARTMENT'] } });
    await ApprovalMatrix.findOneAndUpdate(
      { requester_type: 'ROLE', requester_ref: empRole._id, module: 'LEAVE' },
      {
        $set: {
          level_no: 1,
          rule: 'ALL',
          approvers: [
            { approver_type: 'ROLE', approver_ref: ceoRole._id },
            { approver_type: 'ROLE', approver_ref: ctoRole._id }
          ],
          is_active: true,
          is_locked: false
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const ceoRes = await request('POST', '/api/auth/login', { email: 'test.ceo.notif@nexalliance.com', password: 'Password@123' });
    ceoToken = ceoRes.body.token;
    const ctoRes = await request('POST', '/api/auth/login', { email: 'test.cto.notif@nexalliance.com', password: 'Password@123' });
    ctoToken = ctoRes.body.token;
    const empRes = await request('POST', '/api/auth/login', { email: 'test.emp.notif@nexalliance.com', password: 'Password@123' });
    empToken = empRes.body.token;

    console.log('   ✓ Super Admin, CEO, CTO, and Test Employee authenticated successfully.\n');

    // ========================================================
    // 2️⃣ Testing Notification Template Master CRUD & Access Gates
    // ========================================================
    console.log('2️⃣ Testing Notification Template Master CRUD & Access Gates...');
    const listTemplatesRes = await request('GET', '/api/notification-templates', null, adminToken);
    console.log(`   Admin List Templates: Status ${listTemplatesRes.status}, Found ${listTemplatesRes.body.count} templates`);
    if (listTemplatesRes.status !== 200 || listTemplatesRes.body.count < 18) {
      throw new Error('Failed to list default notification templates');
    }

    const empListTmplRes = await request('GET', '/api/notification-templates', null, empToken);
    console.log(`   Employee List Templates Attempt: Status ${empListTmplRes.status} (Expected: 403 Forbidden)`);
    if (empListTmplRes.status !== 403) throw new Error('Employee should not be able to list notification templates');

    // Create a custom template
    const testCustomEvent = `CUSTOM_ANNOUNCEMENT_${Date.now()}`;
    const createTmplRes = await request('POST', '/api/notification-templates', {
      event: testCustomEvent,
      channel: 'IN_APP',
      body: 'Important announcement for {{employee_name}}: {{message}}',
      status: 'Active'
    }, adminToken);
    console.log(`   Admin Create Custom Template: Status ${createTmplRes.status}`);
    if (createTmplRes.status !== 201) throw new Error('Failed to create custom template');
    const customTmplId = createTmplRes.body.template._id;

    // Duplicate creation check
    const dupTmplRes = await request('POST', '/api/notification-templates', {
      event: testCustomEvent,
      channel: 'IN_APP',
      body: 'Duplicate test',
      status: 'Active'
    }, adminToken);
    console.log(`   Duplicate Template Creation: Status ${dupTmplRes.status} (Expected: 400 Bad Request)`);
    if (dupTmplRes.status !== 400) throw new Error('Duplicate template creation should fail with 400');

    // Update template
    const updateTmplRes = await request('PUT', `/api/notification-templates/${customTmplId}`, {
      body: 'Updated announcement for {{employee_name}}: {{message}}'
    }, adminToken);
    console.log(`   Admin Update Template: Status ${updateTmplRes.status}`);
    if (updateTmplRes.status !== 200) throw new Error('Failed to update template');

    // Soft delete template
    const deleteTmplRes = await request('DELETE', `/api/notification-templates/${customTmplId}`, null, adminToken);
    console.log(`   Admin Soft Delete Template: Status ${deleteTmplRes.status}, Status = ${deleteTmplRes.body.template.status}`);
    if (deleteTmplRes.status !== 200 || deleteTmplRes.body.template.status !== 'Inactive') {
      throw new Error('Failed to deactivate template');
    }
    console.log('   ✓ Notification Template CRUD verified.\n');

    // ========================================================
    // 3️⃣ Testing Core Dispatcher Placeholder Resolution & Fallbacks
    // ========================================================
    console.log('3️⃣ Testing Core Dispatcher Placeholder Resolution & Fallbacks...');
    const resolvedText = resolvePlaceholders(
      'Hello {{employee_name}}, your {{leave_type}} from {{from_date}} to {{to_date}} (missing: {{missing_field}}) is ready.',
      { employee_name: 'John Doe', leave_type: 'Casual Leave', from_date: '01/04/2026', to_date: '03/04/2026' }
    );
    console.log(`   Placeholder Resolution Output: "${resolvedText}"`);
    if (resolvedText.includes('{{missing_field}}') || !resolvedText.includes('John Doe')) {
      throw new Error('Placeholder resolution failed or did not default missing tokens to empty string');
    }

    // Direct call with unknown event
    const unknownRes = await sendNotification(empUser._id, 'NON_EXISTENT_EVENT_XYZ', { test: '123' });
    console.log(`   Unknown Event Dispatch Count: ${unknownRes.length} (Expected: 0)`);
    if (unknownRes.length !== 0) throw new Error('Unknown event should silently produce 0 rows');
    console.log('   ✓ Dispatcher placeholder resolution and graceful bypass verified.\n');

    // ========================================================
    // 4️⃣ Testing Module 3 Regularization Notification Integration
    // ========================================================
    console.log('4️⃣ Testing Module 3 Regularization Trigger Integration...');
    // Create test regularization request
    const regDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const reqIn = new Date(regDate);
    reqIn.setHours(10, 5, 0, 0);
    const reqOut = new Date(regDate);
    reqOut.setHours(18, 40, 0, 0);

    const regReq = await RegularizationRequest.create({
      user_id: empUser._id,
      date: regDate,
      reason_id: testReason._id,
      req_in: reqIn,
      req_out: reqOut,
      remark: 'Biometric fingerprint sensor timeout',
      status: 'Pending'
    });

    // Clear previous notifications for empUser
    await Notification.deleteMany({ user_id: empUser._id });

    // Approve regularization
    const approveRegRes = await request('PUT', `/api/regularizations/${regReq._id}/approve`, {
      remarks: 'Verified with security logs'
    }, adminToken);
    console.log(`   Approve Regularization Status: ${approveRegRes.status}`);
    if (approveRegRes.status !== 200) throw new Error('Failed to approve regularization request');

    // Check notifications for empUser
    const empRegNotifs = await Notification.find({ user_id: empUser._id, event: 'REGULARIZATION_APPROVED' });
    console.log(`   Created Regularization Approved Notifications: ${empRegNotifs.length} (Expected: 2 -> IN_APP + EMAIL)`);
    if (empRegNotifs.length !== 2) throw new Error(`Expected 2 notifications, got ${empRegNotifs.length}`);
    const inAppReg = empRegNotifs.find(n => n.channel === 'IN_APP');
    const emailReg = empRegNotifs.find(n => n.channel === 'EMAIL');
    if (!inAppReg || !emailReg || emailReg.delivery_status !== 'QUEUED') {
      throw new Error('Regularization notifications channels or delivery_status invalid');
    }
    console.log('   ✓ Regularization approval notification dispatch verified.\n');

    // ========================================================
    // 5️⃣ Testing Module 4 Leave 4-Point Notification Flow
    // ========================================================
    console.log('5️⃣ Testing Module 4 Leave 4-Point Notification Flow...');
    // Clean inbox and leave requests for CEO, CTO, and Emp
    await Notification.deleteMany({ user_id: { $in: [ceoUser._id, ctoUser._id, empUser._id] } });
    await LeaveRequest.deleteMany({ user_id: empUser._id });

    // Ensure leave balance for empUser
    const LeaveBalance = require('../models/LeaveBalance');
    await LeaveBalance.findOneAndUpdate(
      { user_id: empUser._id, leave_type_id: clLeaveType._id, year: 2026 },
      { $set: { opening: 12, accrued: 0, used: 0, pending: 0, adjusted: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5.1 Apply Leave (Both approvers notified via LEAVE_APPLIED, Requester NOT notified)
    const futureFrom = new Date(Date.UTC(2026, 11, 15));
    const futureTo = new Date(Date.UTC(2026, 11, 16));
    const applyRes = await request('POST', '/api/leaves', {
      leave_type_id: clLeaveType._id.toString(),
      from_date: '15/12/2026',
      to_date: '16/12/2026',
      reason: 'Family wedding event'
    }, empToken);

    console.log(`   Emp Apply Leave Status: ${applyRes.status}`);
    if (applyRes.status !== 201) throw new Error('Apply leave failed: ' + JSON.stringify(applyRes.body));
    const leaveId = applyRes.body.data._id;

    // Check CEO and CTO received LEAVE_APPLIED notifications
    const ceoAppliedNotifs = await Notification.find({ user_id: ceoUser._id, event: 'LEAVE_APPLIED' });
    const ctoAppliedNotifs = await Notification.find({ user_id: ctoUser._id, event: 'LEAVE_APPLIED' });
    const empAppliedNotifs = await Notification.find({ user_id: empUser._id, event: 'LEAVE_APPLIED' });

    console.log(`   CEO LEAVE_APPLIED Notifs: ${ceoAppliedNotifs.length}, CTO: ${ctoAppliedNotifs.length}, Requester: ${empAppliedNotifs.length}`);
    if (ceoAppliedNotifs.length === 0 || ctoAppliedNotifs.length === 0 || empAppliedNotifs.length !== 0) {
      throw new Error('LEAVE_APPLIED must notify both approvers and NOT the requester');
    }

    // 5.2 First Approval (CEO approves -> LEAVE_FIRST_APPROVAL fired to requester)
    const ceoApproveRes = await request('PUT', `/api/leaves/${leaveId}/approve`, { remarks: 'Approved by CEO' }, ceoToken);
    console.log(`   CEO 1st Approval Status: ${ceoApproveRes.status}, Status = ${ceoApproveRes.body.data?.status || 'Pending'}`);
    
    const empFirstApprNotifs = await Notification.find({ user_id: empUser._id, event: 'LEAVE_FIRST_APPROVAL' });
    console.log(`   Emp LEAVE_FIRST_APPROVAL Notifs: ${empFirstApprNotifs.length} (Expected: 2 -> IN_APP + EMAIL)`);
    if (empFirstApprNotifs.length !== 2) throw new Error('LEAVE_FIRST_APPROVAL not dispatched to employee');

    // 5.3 Final Approval (CTO approves -> LEAVE_APPROVED fired to requester)
    const ctoApproveRes = await request('PUT', `/api/leaves/${leaveId}/approve`, { remarks: 'Approved by CTO' }, ctoToken);
    console.log(`   CTO 2nd Approval Status: ${ctoApproveRes.status}, Status = ${ctoApproveRes.body.data?.status || 'Approved'}`);

    const empFinalApprNotifs = await Notification.find({ user_id: empUser._id, event: 'LEAVE_APPROVED' });
    console.log(`   Emp LEAVE_APPROVED Notifs: ${empFinalApprNotifs.length} (Expected: 2 -> IN_APP + EMAIL)`);
    if (empFinalApprNotifs.length !== 2) throw new Error('LEAVE_APPROVED not dispatched to employee');

    // 5.4 Cancel Approved Leave (Approvers notified via LEAVE_CANCELLED_NOTICE)
    const cancelRes = await request('PUT', `/api/leaves/${leaveId}/cancel`, { remarks: 'Event cancelled' }, empToken);
    console.log(`   Emp Cancel Approved Leave Status: ${cancelRes.status}`);
    if (cancelRes.status !== 200) throw new Error('Cancel leave failed: ' + JSON.stringify(cancelRes.body));

    const ceoCancelNotifs = await Notification.find({ user_id: ceoUser._id, event: 'LEAVE_CANCELLED_NOTICE' });
    const ctoCancelNotifs = await Notification.find({ user_id: ctoUser._id, event: 'LEAVE_CANCELLED_NOTICE' });
    console.log(`   CEO LEAVE_CANCELLED_NOTICE Notifs: ${ceoCancelNotifs.length}, CTO: ${ctoCancelNotifs.length}`);
    if (ceoCancelNotifs.length === 0 || ctoCancelNotifs.length === 0) {
      throw new Error('LEAVE_CANCELLED_NOTICE must notify assigned approvers');
    }
    console.log('   ✓ Leave 4-point notification flow passed perfectly.\n');

    // ========================================================
    // 6️⃣ Testing Module 6 Payroll Release Trigger Integration
    // ========================================================
    console.log('6️⃣ Testing Module 6 Payroll Release Trigger Integration...');
    await Notification.deleteMany({ user_id: empUser._id });
    await PayrollCycle.deleteMany({ month: 6, year: 2026 });
    await PayrollRun.deleteMany({ user_id: empUser._id });

    // Create test payroll cycle & run
    const testCycle = await PayrollCycle.create({
      name: 'Notification Test Cycle',
      month: 6,
      year: 2026,
      from_date: new Date(Date.UTC(2026, 5, 1)),
      to_date: new Date(Date.UTC(2026, 5, 30)),
      cut_off: new Date(Date.UTC(2026, 5, 25)),
      pay_date: new Date(Date.UTC(2026, 6, 1)),
      total_days: 30,
      status: 'Approved'
    });

    const testSalaryStruct = await EmployeeSalaryStructure.create({
      user_id: empUser._id,
      effective_from: new Date(Date.UTC(2026, 0, 1)),
      basic: 50000,
      components: [],
      status: 'Active'
    });

    const testRun = await PayrollRun.create({
      cycle_id: testCycle._id,
      user_id: empUser._id,
      structure_id: testSalaryStruct._id,
      total_cycle_days: 30,
      payable_days: 30,
      gross: 50000,
      net_pay: 50000,
      status: 'Approved'
    });

    // Release payslips
    const releaseRes = await request('PUT', `/api/payroll/${testCycle._id}/release`, {}, adminToken);
    console.log(`   Release Payslips Status: ${releaseRes.status}`);
    if (releaseRes.status !== 200) throw new Error('Release payslips failed: ' + JSON.stringify(releaseRes.body));

    const empPayslipNotifs = await Notification.find({ user_id: empUser._id, event: 'PAYSLIP_RELEASED' });
    console.log(`   Emp PAYSLIP_RELEASED Notifs: ${empPayslipNotifs.length} (Expected: 2 -> IN_APP + EMAIL)`);
    if (empPayslipNotifs.length !== 2) throw new Error('PAYSLIP_RELEASED notifications not created');
    console.log('   ✓ Payroll release notification integration verified.\n');

    // ========================================================
    // 7️⃣ Testing In-App Inbox Self-Scoping & Read States
    // ========================================================
    console.log('7️⃣ Testing In-App Inbox Self-Scoping & Read States...');
    // Emp fetches own notifications
    const myInboxRes = await request('GET', '/api/notifications', null, empToken);
    console.log(`   Emp Inbox Status: ${myInboxRes.status}, Total In-App Notifications: ${myInboxRes.body.count}`);
    if (myInboxRes.status !== 200 || myInboxRes.body.count === 0) throw new Error('Failed to get emp inbox');

    // Unread count
    const unreadCountRes = await request('GET', '/api/notifications/unread-count', null, empToken);
    console.log(`   Emp Initial Unread Count: ${unreadCountRes.body.unread_count}`);
    const initialUnread = unreadCountRes.body.unread_count;
    if (initialUnread === 0) throw new Error('Expected positive unread count');

    // Mark single notification as read
    const targetNotifId = myInboxRes.body.notifications[0]._id;
    const markSingleRes = await request('PUT', `/api/notifications/${targetNotifId}/mark-read`, {}, empToken);
    console.log(`   Mark Single Read Status: ${markSingleRes.status}, Is Read: ${markSingleRes.body.notification.is_read}`);
    if (markSingleRes.status !== 200 || markSingleRes.body.notification.is_read !== true) {
      throw new Error('Failed to mark notification as read');
    }

    // Verify unread count decremented by 1
    const unreadCountAfterSingle = await request('GET', '/api/notifications/unread-count', null, empToken);
    console.log(`   Unread Count After 1 Read: ${unreadCountAfterSingle.body.unread_count} (Expected: ${initialUnread - 1})`);
    if (unreadCountAfterSingle.body.unread_count !== initialUnread - 1) {
      throw new Error('Unread count did not decrement accurately');
    }

    // Cross-user access attempt: CEO tries to mark Emp's notification read
    const crossMarkRes = await request('PUT', `/api/notifications/${targetNotifId}/mark-read`, {}, ceoToken);
    console.log(`   Cross-User Mark Read Attempt: Status ${crossMarkRes.status} (Expected: 404 Not Found)`);
    if (crossMarkRes.status !== 404) throw new Error('Cross-user mark-read should return 404 due to self-scoping');

    // Mark all read
    const markAllRes = await request('PUT', '/api/notifications/mark-all-read', {}, empToken);
    console.log(`   Mark All Read Status: ${markAllRes.status}, Modified Count: ${markAllRes.body.modified_count}`);
    
    const unreadCountFinal = await request('GET', '/api/notifications/unread-count', null, empToken);
    console.log(`   Final Unread Count: ${unreadCountFinal.body.unread_count} (Expected: 0)`);
    if (unreadCountFinal.body.unread_count !== 0) throw new Error('Final unread count must be 0 after mark-all-read');
    console.log('   ✓ In-App inbox self-scoping and read state transitions passed.\n');

    // ========================================================
    // 8️⃣ Testing Template Mute / Deactivation Handling
    // ========================================================
    console.log('8️⃣ Testing Template Mute / Deactivation Handling...');
    // Deactivate both PAYSLIP_RELEASED templates
    await NotificationTemplate.updateMany(
      { event: 'PAYSLIP_RELEASED' },
      { $set: { status: 'Inactive' } }
    );

    // Dispatch again
    const mutedRes = await sendNotification(empUser._id, 'PAYSLIP_RELEASED', { employee_name: 'Test' });
    console.log(`   Muted Event Dispatch Count: ${mutedRes.length} (Expected: 0)`);
    if (mutedRes.length !== 0) throw new Error('Muted event should produce 0 notifications');

    // Reactivate templates
    await NotificationTemplate.updateMany(
      { event: 'PAYSLIP_RELEASED' },
      { $set: { status: 'Active' } }
    );
    console.log('   ✓ Graceful mute behavior verified.\n');

    // ========================================================
    // 9️⃣ Testing Threshold-Based Pending Leave Reminder Job
    // ========================================================
    console.log('9️⃣ Testing Threshold-Based Pending Leave Reminder Job...');
    // Create an old pending request (3 days old)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const oldPendingReq = await LeaveRequest.create({
      user_id: empUser._id,
      leave_type_id: clLeaveType._id,
      from_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      to_date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
      days: 2,
      reason: 'Old pending leave for reminder test',
      status: 'Pending',
      approvers: [ceoUser._id, ctoUser._id],
      approvals_needed: 2,
      approvals_done: 0,
      approvals: [],
      createdAt: threeDaysAgo
    });

    await Notification.deleteMany({ event: 'LEAVE_PENDING_REMINDER' });

    // Run reminder job with threshold = 2 days
    const jobResult = await runLeavePendingReminderJob(2);
    console.log(`   Reminder Job Result: Processed Requests = ${jobResult.processed_requests}, Reminders Sent = ${jobResult.reminders_sent}`);
    if (jobResult.reminders_sent < 2) throw new Error('Reminder job did not dispatch reminders to both unresolved approvers');

    const ceoReminders = await Notification.find({ user_id: ceoUser._id, event: 'LEAVE_PENDING_REMINDER' });
    console.log(`   CEO Received Reminders: ${ceoReminders.length}`);
    if (ceoReminders.length === 0) throw new Error('CEO should have received pending leave reminder');
    console.log('   ✓ Threshold-based pending request reminder job passed.\n');

    // ========================================================
    // 🔟 Testing Super Admin Support Troubleshooting Route
    // ========================================================
    console.log('🔟 Testing Super Admin Support Troubleshooting Route...');
    const adminViewUserNotifs = await request('GET', `/api/notifications/user/${empUser._id}`, null, adminToken);
    console.log(`   Admin View Emp Notifs Status: ${adminViewUserNotifs.status}, Total: ${adminViewUserNotifs.body.total}`);
    if (adminViewUserNotifs.status !== 200 || adminViewUserNotifs.body.total === 0) {
      throw new Error('Super Admin should be able to view user notification log');
    }

    const empViewUserNotifs = await request('GET', `/api/notifications/user/${ceoUser._id}`, null, empToken);
    console.log(`   Employee View Admin Route Status: ${empViewUserNotifs.status} (Expected: 403 Forbidden)`);
    if (empViewUserNotifs.status !== 403) {
      throw new Error('Non-admin user should not be able to access support notification viewer');
    }
    console.log('   ✓ Super Admin support inspection route verified.\n');

    console.log('=============================================================');
    console.log('🎉 ALL MODULE 7 (NOTIFICATION ENGINE) TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ MODULE 7 TEST FAILED:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
};

runTests();
