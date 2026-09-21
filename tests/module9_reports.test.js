const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const app = require('../server');
const User = require('../models/User');
const Role = require('../models/Role');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Shift = require('../models/Shift');
const AttendanceDaily = require('../models/AttendanceDaily');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveLedger = require('../models/LeaveLedger');
const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const AuditLog = require('../models/AuditLog');

let server;
let baseUrl;

// Helper to make HTTP requests
const request = (method, path, body = null, token = null, extraHeaders = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      'x-bypass-rate-limit': 'true',
      ...extraHeaders
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const reqOptions = {
      method: method.toUpperCase(),
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, raw: data, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

async function runModule9Tests() {
  console.log('🧪 Starting Automated Module 9 (Reports & Dashboard APIs) Test Suite...');

  // 1. Wait for DB connection
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
    });
  }
  console.log('✅ Connected to MongoDB for Module 9 test suite');

  // Start test server
  const testPort = 5099;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(testPort, resolve));
  baseUrl = `http://localhost:${testPort}`;

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate Super Admin, CEO, CTO, and Employee
    // -------------------------------------------------------------
    console.log('\n1️⃣ Setting up roles & authenticating all four actors (Admin, CEO, CTO, Employee)...');

    // Super Admin
    let superAdminRole = await Role.findOne({ is_super_admin: true });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        name: 'Super Admin',
        code: 'SUPER_ADMIN',
        is_super_admin: true,
        status: 'Active'
      });
    }

    let adminUser = await User.findOne({ email: 'admin@nexalliance.com' });
    if (!adminUser) {
      adminUser = await User.create({
        employee_code: 'ADM-001',
        name: 'Super Admin',
        email: 'admin@nexalliance.com',
        password_hash: await User.hashPassword('Admin@12345'),
        role_id: superAdminRole._id,
        status: 'Active'
      });
    } else {
      adminUser.password_hash = await User.hashPassword('Admin@12345');
      adminUser.failed_login_count = 0;
      adminUser.locked_until = null;
      adminUser.two_fa_enabled = false;
      await adminUser.save();
    }

    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    const adminToken = adminLoginRes.body.token;

    // CEO
    let ceoRole = await Role.findOne({ code: 'CEO' });
    if (!ceoRole) {
      ceoRole = await Role.create({ name: 'Chief Executive Officer', code: 'CEO', status: 'Active' });
    }
    let ceoUser = await User.findOne({ email: 'ceo@nexalliance.com' });
    if (!ceoUser) {
      ceoUser = await User.create({
        employee_code: 'CEO-001',
        name: 'Executive CEO',
        email: 'ceo@nexalliance.com',
        password_hash: await User.hashPassword('Ceo@12345'),
        role_id: ceoRole._id,
        status: 'Active'
      });
    } else {
      ceoUser.password_hash = await User.hashPassword('Ceo@12345');
      await ceoUser.save();
    }

    const ceoLoginRes = await request('POST', '/api/auth/login', {
      email: 'ceo@nexalliance.com',
      password: 'Ceo@12345'
    });
    const ceoToken = ceoLoginRes.body.token;

    // CTO
    let ctoRole = await Role.findOne({ code: 'CTO' });
    if (!ctoRole) {
      ctoRole = await Role.create({ name: 'Chief Technology Officer', code: 'CTO', status: 'Active' });
    }
    let ctoUser = await User.findOne({ email: 'cto@nexalliance.com' });
    if (!ctoUser) {
      ctoUser = await User.create({
        employee_code: 'CTO-001',
        name: 'Executive CTO',
        email: 'cto@nexalliance.com',
        password_hash: await User.hashPassword('Cto@12345'),
        role_id: ctoRole._id,
        status: 'Active'
      });
    } else {
      ctoUser.password_hash = await User.hashPassword('Cto@12345');
      await ctoUser.save();
    }

    const ctoLoginRes = await request('POST', '/api/auth/login', {
      email: 'cto@nexalliance.com',
      password: 'Cto@12345'
    });
    const ctoToken = ctoLoginRes.body.token;

    // Employee
    let empRole = await Role.findOne({ code: 'EMPLOYEE' });
    if (!empRole) {
      empRole = await Role.create({ name: 'Employee', code: 'EMPLOYEE', status: 'Active' });
    }
    let empUser = await User.findOne({ email: 'report_emp@nexalliance.com' });
    if (!empUser) {
      empUser = await User.create({
        employee_code: 'RPT-001',
        name: 'Report Test Employee',
        email: 'report_emp@nexalliance.com',
        password_hash: await User.hashPassword('Emp@12345'),
        role_id: empRole._id,
        status: 'Active'
      });
    } else {
      empUser.password_hash = await User.hashPassword('Emp@12345');
      await empUser.save();
    }

    const empLoginRes = await request('POST', '/api/auth/login', {
      email: 'report_emp@nexalliance.com',
      password: 'Emp@12345'
    });
    const empToken = empLoginRes.body.token;

    console.log(`   ✓ All actors authenticated successfully.`);

    // -------------------------------------------------------------
    // STAGE 2: Multi-Role Dashboard Aggregation (`GET /api/dashboard`)
    // -------------------------------------------------------------
    console.log('\n2️⃣ Testing Universal `GET /api/dashboard` Role-Shaped Payloads...');

    // 2.1 Super Admin Dashboard
    const adminDashRes = await request('GET', '/api/dashboard', null, adminToken);
    if (adminDashRes.status !== 200) throw new Error(`Super Admin dashboard failed: ${JSON.stringify(adminDashRes.body)}`);
    const adminData = adminDashRes.body.data;

    if (adminData.role !== 'SUPER_ADMIN') throw new Error(`Expected role SUPER_ADMIN, got ${adminData.role}`);
    if (typeof adminData.total_active_employees !== 'number') throw new Error('Super Admin dashboard missing total_active_employees');
    if (!adminData.pending_approvals || typeof adminData.pending_approvals.regularizations_count !== 'number') {
      throw new Error('Super Admin dashboard missing pending_approvals metrics');
    }
    if (!Array.isArray(adminData.recent_system_activity)) {
      throw new Error('Super Admin dashboard missing recent_system_activity array');
    }

    // 2.2 CEO Dashboard
    const ceoDashRes = await request('GET', '/api/dashboard', null, ceoToken);
    if (ceoDashRes.status !== 200) throw new Error(`CEO dashboard failed: ${JSON.stringify(ceoDashRes.body)}`);
    const ceoData = ceoDashRes.body.data;

    if (ceoData.role !== 'CEO') throw new Error(`Expected role CEO, got ${ceoData.role}`);
    if (!ceoData.pending_approvals_for_me || typeof ceoData.pending_approvals_for_me.total_count !== 'number') {
      throw new Error('CEO dashboard missing pending_approvals_for_me');
    }
    if (!ceoData.team_attendance_today || typeof ceoData.team_attendance_today.breakdown !== 'object') {
      throw new Error('CEO dashboard missing team_attendance_today');
    }

    // 2.3 Employee Dashboard
    const empDashRes = await request('GET', '/api/dashboard', null, empToken);
    if (empDashRes.status !== 200) throw new Error(`Employee dashboard failed: ${JSON.stringify(empDashRes.body)}`);
    const empData = empDashRes.body.data;

    if (empData.role !== 'EMPLOYEE') throw new Error(`Expected role EMPLOYEE, got ${empData.role}`);
    if (!Array.isArray(empData.leave_balance_summary)) throw new Error('Employee dashboard missing leave_balance_summary');
    if (!empData.late_status_this_month || typeof empData.late_status_this_month.late_count !== 'number') {
      throw new Error('Employee dashboard missing late_status_this_month');
    }
    if (!empData.my_pending_requests || typeof empData.my_pending_requests.leaves_count !== 'number') {
      throw new Error('Employee dashboard missing my_pending_requests');
    }
    // Security check: Employee dashboard must NOT expose admin/executive fields
    if (empData.recent_system_activity || empData.payroll_runs_by_status || empData.total_active_employees) {
      throw new Error('Employee dashboard leaked Super Admin/Executive metrics!');
    }

    console.log(`   ✓ Super Admin, CEO, and Employee received exact role-tailored dashboard shapes from the single endpoint.`);

    // -------------------------------------------------------------
    // STAGE 3: Employee Access Gate (403 on all /api/reports/*)
    // -------------------------------------------------------------
    console.log('\n3️⃣ Testing Strict 403 Forbidden Enforcement for Employee on Reports...');

    const reportEndpoints = [
      '/api/reports/attendance',
      '/api/reports/attendance/export',
      '/api/reports/leave-balance',
      '/api/reports/leave-ledger',
      '/api/reports/leave-utilization',
      '/api/reports/short-leave-usage',
      '/api/reports/lop',
      '/api/reports/payroll-register',
      '/api/reports/payroll-register/export',
      '/api/reports/audit-summary'
    ];

    for (let endpoint of reportEndpoints) {
      const res = await request('GET', endpoint, null, empToken);
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden for Employee on ${endpoint}, got ${res.status}`);
      }
    }

    console.log(`   ✓ All 10 report endpoints strictly returned 403 Forbidden for Employee role.`);

    // -------------------------------------------------------------
    // STAGE 4: Attendance Summary Report & CSV Export
    // -------------------------------------------------------------
    console.log('\n4️⃣ Testing Attendance Summary Report (JSON & CSV)...');

    // Create a sample attendance daily record for testing
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await AttendanceDaily.deleteMany({ user_id: empUser._id });
    await AttendanceDaily.create({
      user_id: empUser._id,
      date: today,
      status: 'Present',
      first_in: new Date(),
      last_out: new Date(),
      work_minutes: 480,
      is_late: false,
      is_regularized: true
    });

    const attRes = await request('GET', `/api/reports/attendance?user_id=${empUser._id}`, null, ceoToken);
    if (attRes.status !== 200 || !Array.isArray(attRes.body.data)) {
      throw new Error(`Attendance report query failed: ${JSON.stringify(attRes.body)}`);
    }
    const empAtt = attRes.body.data.find(d => d.user_id.toString() === empUser._id.toString());
    if (!empAtt || empAtt.present_days < 1) {
      throw new Error('Attendance summary did not aggregate present days correctly');
    }

    // Test CSV export
    const attCsvRes = await request('GET', `/api/reports/attendance/export?user_id=${empUser._id}`, null, ceoToken);
    if (attCsvRes.status !== 200) throw new Error('Attendance CSV export failed');
    if (!attCsvRes.headers['content-type'].includes('text/csv')) {
      throw new Error(`Expected text/csv content-type, got: ${attCsvRes.headers['content-type']}`);
    }
    if (!attCsvRes.raw.includes('Employee Code') || !attCsvRes.raw.includes(empUser.employee_code)) {
      throw new Error('Attendance CSV missing expected headers or employee record');
    }

    console.log(`   ✓ Attendance summary JSON and CSV export verified.`);

    // -------------------------------------------------------------
    // STAGE 5: Leave Reports (Balance, Ledger, Utilization, Short Leave)
    // -------------------------------------------------------------
    console.log('\n5️⃣ Testing Leave Management Reports...');

    // 5.1 Leave Balance Report
    const balRes = await request('GET', '/api/reports/leave-balance?year=2026', null, ctoToken);
    if (balRes.status !== 200 || !Array.isArray(balRes.body.data)) {
      throw new Error(`Leave balance report failed: ${JSON.stringify(balRes.body)}`);
    }

    // 5.2 Leave Ledger Report
    const ledgerRes = await request('GET', '/api/reports/leave-ledger', null, ctoToken);
    if (ledgerRes.status !== 200 || !Array.isArray(ledgerRes.body.data)) {
      throw new Error(`Leave ledger report failed: ${JSON.stringify(ledgerRes.body)}`);
    }

    // 5.3 Leave Utilization Report
    const utilRes = await request('GET', '/api/reports/leave-utilization?year=2026', null, ctoToken);
    if (utilRes.status !== 200 || !Array.isArray(utilRes.body.data)) {
      throw new Error(`Leave utilization report failed: ${JSON.stringify(utilRes.body)}`);
    }

    // 5.4 Short Leave Usage Report
    const shortLeaveRes = await request('GET', '/api/reports/short-leave-usage?year=2026&month=9', null, ctoToken);
    if (shortLeaveRes.status !== 200 || !Array.isArray(shortLeaveRes.body.data)) {
      throw new Error(`Short leave usage report failed: ${JSON.stringify(shortLeaveRes.body)}`);
    }

    console.log(`   ✓ Leave balance, ledger, utilization, and short leave reports verified.`);

    // -------------------------------------------------------------
    // STAGE 6: Payroll Reports (LOP & Payroll Register + CSV)
    // -------------------------------------------------------------
    console.log('\n6️⃣ Testing Payroll Reports (LOP, Register & CSV)...');

    // 6.1 LOP Report
    const lopRes = await request('GET', '/api/reports/lop', null, ceoToken);
    if (lopRes.status !== 200 || !Array.isArray(lopRes.body.data)) {
      throw new Error(`LOP report failed: ${JSON.stringify(lopRes.body)}`);
    }

    // 6.2 Payroll Register Report (JSON)
    const payRegRes = await request('GET', '/api/reports/payroll-register', null, ceoToken);
    if (payRegRes.status !== 200 || !Array.isArray(payRegRes.body.data)) {
      throw new Error(`Payroll register failed: ${JSON.stringify(payRegRes.body)}`);
    }

    // 6.3 Payroll Register CSV Export
    const payCsvRes = await request('GET', '/api/reports/payroll-register/export', null, ceoToken);
    if (payCsvRes.status !== 200) throw new Error('Payroll register CSV export failed');
    if (!payCsvRes.headers['content-type'].includes('text/csv')) {
      throw new Error(`Expected text/csv content-type, got: ${payCsvRes.headers['content-type']}`);
    }
    if (!payCsvRes.raw.includes('Employee Code') || !payCsvRes.raw.includes('Net Pay')) {
      throw new Error('Payroll register CSV missing expected column headers');
    }

    console.log(`   ✓ LOP and Payroll Register reports + CSV export verified.`);

    // -------------------------------------------------------------
    // STAGE 7: Audit Summary Report (Super Admin Only)
    // -------------------------------------------------------------
    console.log('\n7️⃣ Testing Audit Summary Report (SUPER_ADMIN ONLY)...');

    const adminAuditRes = await request('GET', '/api/reports/audit-summary?module=AUTH', null, adminToken);
    if (adminAuditRes.status !== 200 || typeof adminAuditRes.body.data.total_logs !== 'number') {
      throw new Error(`Audit summary report failed: ${JSON.stringify(adminAuditRes.body)}`);
    }

    // CEO attempt on Audit Summary must be rejected with 403
    const ceoAuditRes = await request('GET', '/api/reports/audit-summary', null, ceoToken);
    if (ceoAuditRes.status !== 403) {
      throw new Error(`Expected 403 for CEO on audit summary report, got ${ceoAuditRes.status}`);
    }

    console.log(`   ✓ Audit summary accessible to Super Admin only; CEO correctly blocked.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 9 (REPORTS & DASHBOARD) TESTS PASSED PERFECTLY!');
    console.log('=============================================================');

  } catch (err) {
    console.error('\n❌ Module 9 Test Suite Failed:', err.message);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runModule9Tests();
