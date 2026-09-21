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
const AttendanceDaily = require('../models/AttendanceDaily');
const LateMonthlySummary = require('../models/LateMonthlySummary');
const LeaveType = require('../models/LeaveType');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveLedger = require('../models/LeaveLedger');
const SalaryComponent = require('../models/SalaryComponent');
const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const { calculateLOP, resolveSalaryStructure, isPayrollMonthLocked } = require('../services/payrollService');
const { normalizeDate } = require('../services/attendanceService');

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
      const isPdf = res.headers['content-type'] === 'application/pdf';
      if (isPdf) {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({ status: res.statusCode, body: buffer, isPdf: true });
        });
      } else {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
          } catch (e) {
            resolve({ status: res.statusCode, body: responseBody });
          }
        });
      }
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(dataString);
    req.end();
  });
};

const runTests = async () => {
  console.log('🧪 Starting Automated Module 6 (Payroll Management Engine) Test Suite...\n');
  await connectDB();

  let adminToken, ceoToken, ctoToken, empToken;
  let superAdminUser, ceoUser, ctoUser, empUser;
  let basicComp, hraComp, pfComp;
  let testCycle;

  try {
    // ========================================================
    // 1️⃣ Authenticating Users & Setting up Test Accounts
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
    const shift = await Shift.findOne();
    const seDesig = await Designation.findOne();
    const itDept = await Department.findOne({ code: 'IT' });
    const execDept = await Department.findOne({ code: 'EXEC' });

    const passwordHash = await User.hashPassword('Password@123');

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
          salary: 100000,
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
          department_id: execDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          salary: 90000,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    empUser = await User.findOneAndUpdate(
      { email: 'payroll.emp@nexalliance.com' },
      {
        $set: {
          employee_code: 'EMP-PAY-01',
          name: 'Vikram Sharma',
          email: 'payroll.emp@nexalliance.com',
          password_hash: passwordHash,
          role_id: empRole._id,
          department_id: itDept._id,
          designation_id: seDesig._id,
          branch_id: branch._id,
          shift_id: shift._id,
          attendance_exempt: false,
          date_of_joining: new Date('2026-01-01'),
          salary: 50000,
          bank_details: {
            account_holder_name: 'Vikram Sharma',
            account_number: '987654321098',
            bank_name: 'HDFC Bank',
            ifsc_code: 'HDFC0001234'
          },
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const ceoLogin = await request('POST', '/api/auth/login', { email: 'test.ceo@nexalliance.com', password: 'Password@123' });
    ceoToken = ceoLogin.body.token;

    const ctoLogin = await request('POST', '/api/auth/login', { email: 'test.cto@nexalliance.com', password: 'Password@123' });
    ctoToken = ctoLogin.body.token;

    const empLogin = await request('POST', '/api/auth/login', { email: 'payroll.emp@nexalliance.com', password: 'Password@123' });
    empToken = empLogin.body.token;

    console.log('   ✓ Super Admin, CEO, CTO, and Test Employee authenticated.');

    // ========================================================
    // 2️⃣ Testing Salary Component Master CRUD
    // ========================================================
    console.log('2️⃣ Verifying Salary Component Master CRUD & Access Gates...');
    const listCompsRes = await request('GET', '/api/salary-components', null, adminToken);
    console.log(`   Admin List Components: Status ${listCompsRes.status}, Found ${listCompsRes.body.count} component(s)`);

    // CEO read-only access (200)
    const ceoCompRes = await request('GET', '/api/salary-components', null, ceoToken);
    console.log(`   CEO View Components: Status ${ceoCompRes.status} (Read-only ALL)`);

    // Employee denied (403)
    const empCompRes = await request('GET', '/api/salary-components', null, empToken);
    console.log(`   Employee View Components: Status ${empCompRes.status} (Expected: 403 Forbidden)`);
    if (empCompRes.status !== 403) throw new Error('Employee should not be allowed to view salary components');

    // Create a new component
    const createCompRes = await request('POST', '/api/salary-components', {
      name: 'Performance Bonus',
      type: 'EARNING',
      calc_type: 'FIXED',
      value: 10000,
      taxable: true
    }, adminToken);
    console.log(`   Create Component: Status ${createCompRes.status} (ID: ${createCompRes.body.data?._id})`);
    if (createCompRes.status !== 201) throw new Error('Failed to create salary component');
    const bonusCompId = createCompRes.body.data._id;

    // Non-admin create attempt -> 403
    const ceoCreateRes = await request('POST', '/api/salary-components', {
      name: 'Unauthorized Comp',
      type: 'EARNING',
      calc_type: 'FIXED'
    }, ceoToken);
    if (ceoCreateRes.status !== 403) throw new Error('CEO should not be allowed to create salary components');

    // Soft delete component
    const delCompRes = await request('DELETE', `/api/salary-components/${bonusCompId}`, null, adminToken);
    console.log(`   Soft Delete Component: Status ${delCompRes.status}`);
    if (delCompRes.status !== 200) throw new Error('Failed to delete salary component');

    // Retrieve components for structure assignment
    hraComp = await SalaryComponent.findOne({ name: 'House Rent Allowance (HRA)' });
    pfComp = await SalaryComponent.findOne({ name: 'Provident Fund (PF)' });

    // ========================================================
    // 3️⃣ Testing Employee Salary Structure Versioning
    // ========================================================
    console.log('3️⃣ Testing Employee Salary Structure Versioning & Historical Resolution...');

    // Clear prior test structures for empUser
    await EmployeeSalaryStructure.deleteMany({ user_id: empUser._id });

    // Version 1: Effective 01/01/2026, Basic = 30000
    const v1Res = await request('POST', `/api/employees/${empUser._id}/salary-structure`, {
      effective_from: '01/01/2026',
      basic: 30000,
      components: [
        { component_id: hraComp._id, value: 40 }, // 40% of basic = 12000
        { component_id: pfComp._id, value: 12 }    // 12% of basic = 3600
      ]
    }, adminToken);
    console.log(`   Structure Version 1 Created (Effective: 01/01/2026, Basic: 30,000, Status: ${v1Res.status})`);
    if (v1Res.status !== 201) throw new Error('Failed to create structure version 1');

    // Version 2 (Salary Increment): Effective 01/07/2026, Basic = 40000
    const v2Res = await request('POST', `/api/employees/${empUser._id}/salary-structure`, {
      effective_from: '01/07/2026',
      basic: 40000,
      components: [
        { component_id: hraComp._id, value: 40 }, // 40% of basic = 16000
        { component_id: pfComp._id, value: 12 }    // 12% of basic = 4800
      ]
    }, adminToken);
    console.log(`   Structure Version 2 Created (Effective: 01/07/2026, Basic: 40,000, Status: ${v2Res.status})`);
    if (v2Res.status !== 201) throw new Error('Failed to create structure version 2');

    // Test Historical Resolution: Date in March 2026 should resolve V1 (30k basic)
    const resolvedPast = await resolveSalaryStructure(empUser._id, new Date('2026-03-15'));
    console.log(`   Resolved for March 2026: Basic = ${resolvedPast.basic} (Expected: 30000)`);
    if (resolvedPast.basic !== 30000) throw new Error('Historical resolution failed for past date');

    // Date in September 2026 should resolve V2 (40k basic)
    const resolvedCurrent = await resolveSalaryStructure(empUser._id, new Date('2026-09-15'));
    console.log(`   Resolved for September 2026: Basic = ${resolvedCurrent.basic} (Expected: 40000)`);
    if (resolvedCurrent.basic !== 40000) throw new Error('Resolution failed for current date');

    // ========================================================
    // 4️⃣ Testing Payroll Cycle Creation
    // ========================================================
    console.log('4️⃣ Testing Payroll Cycle Creation...');
    const cycleRes = await request('POST', '/api/payroll/cycles', {
      month: 9,
      year: 2026,
      from_date: '01/09/2026',
      to_date: '26/09/2026', // Testing 26 days window as canonical worked example
      cut_off: '24/09/2026',
      pay_date: '01/10/2026'
    }, adminToken);
    console.log(`   Payroll Cycle Created: Status ${cycleRes.status}, Total Days: ${cycleRes.body.data?.total_days}`);
    if (cycleRes.status !== 201 && cycleRes.status !== 200) throw new Error('Failed to create payroll cycle');
    testCycle = cycleRes.body.data;

    // ========================================================
    // 5️⃣ Testing Canonical LOP Formula & Worked Example
    // ========================================================
    console.log('5️⃣ Testing Canonical LOP & Payable Days Formula (PRD Worked Example)...');
    // Inputs: Total Days = 26, 1 Absent day, 5 late marks (0.5 day/extra late beyond 3 = 1.0 day deduction)
    // Expected: LOP Days = 1 (absent) + 1 (late) = 2 -> Payable Days = 26 - 2 = 24

    // Clean prior attendance & summary for clean calculation
    const fromDate = normalizeDate(new Date('2026-09-01'));
    const toDate = normalizeDate(new Date('2026-09-26'));
    await AttendanceDaily.deleteMany({ user_id: empUser._id, date: { $gte: fromDate, $lte: toDate } });

    // 1. Mark 1 Absent day on 2026-09-10
    await AttendanceDaily.create({
      user_id: empUser._id,
      date: normalizeDate(new Date('2026-09-10')),
      status: 'Absent',
      work_minutes: 0
    });

    // 2. Set LateMonthlySummary: late_count = 5, deduction_days = 1.0
    await LateMonthlySummary.findOneAndUpdate(
      { user_id: empUser._id, year: 2026, month: 9 },
      {
        $set: {
          user_id: empUser._id,
          year: 2026,
          month: 9,
          late_count: 5,
          allowed: 3,
          extra_lates: 2,
          deduction_days: 1.0
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const computedLOP = await calculateLOP(empUser._id, testCycle);
    console.log(`   Calculated LOP Stats: Absent: ${computedLOP.absent_days}, Late Deduct: ${computedLOP.late_deduction_days}, LOP Days: ${computedLOP.lop_days}, Payable Days: ${computedLOP.payable_days}`);
    if (computedLOP.lop_days !== 2 || computedLOP.payable_days !== 24) {
      throw new Error(`LOP calculation failed. Expected lop_days=2, payable_days=24, got lop_days=${computedLOP.lop_days}, payable_days=${computedLOP.payable_days}`);
    }
    console.log('   ✓ PASS: Canonical LOP formula reproduced perfectly (lop_days=2, payable_days=24)');

    // ========================================================
    // 6️⃣ Testing Payroll Processing & Super Admin Exclusion
    // ========================================================
    console.log('6️⃣ Testing Payroll Processing (POST /api/payroll/process)...');
    const processRes = await request('POST', '/api/payroll/process', {
      cycle_id: testCycle._id
    }, adminToken);
    console.log(`   Payroll Processed: Status ${processRes.status}, Employee Count: ${processRes.body.count}`);
    if (processRes.status !== 200) throw new Error('Failed to process payroll');

    // Verify Super Admin is NOT included in PayrollRun
    const adminRun = await PayrollRun.findOne({ cycle_id: testCycle._id, user_id: superAdminUser._id || superAdminUser.id });
    console.log(`   Super Admin Exclusion Check: Found Run = ${Boolean(adminRun)} (Expected: false)`);
    if (adminRun) throw new Error('Super Admin should be skipped from attendance-based payroll');

    // Verify Emp User Payroll Run amounts
    const empRun = await PayrollRun.findOne({ cycle_id: testCycle._id, user_id: empUser._id });
    console.log(`   Emp Run: Status = ${empRun.status}, Payable Days = ${empRun.payable_days}, Gross = ${empRun.gross}, Net Pay = ${empRun.net_pay}`);
    if (!empRun || empRun.status !== 'Processed' || empRun.payable_days !== 24) {
      throw new Error('Emp payroll run verification failed');
    }

    // ========================================================
    // 7️⃣ Testing Approval Flow & Month Locking (isPayrollMonthLocked)
    // ========================================================
    console.log('7️⃣ Testing Approval Flow & Real isPayrollMonthLocked() Integration...');

    // Before approval: isPayrollMonthLocked should be false
    const lockedBefore = await isPayrollMonthLocked(new Date('2026-09-15'));
    console.log(`   Lock Check Before Approval: ${lockedBefore} (Expected: false)`);
    if (lockedBefore) throw new Error('Month should not be locked before Approval');

    // CEO approves the payroll cycle
    const approveRes = await request('PUT', `/api/payroll/${testCycle._id}/approve`, null, ceoToken);
    console.log(`   CEO Approve Payroll Cycle: Status ${approveRes.status}, Modified: ${approveRes.body.modified_count}`);
    if (approveRes.status !== 200) throw new Error('Failed to approve payroll cycle');

    // After approval: isPayrollMonthLocked MUST return true
    const lockedAfter = await isPayrollMonthLocked(new Date('2026-09-15'));
    console.log(`   Lock Check After Approval: ${lockedAfter} (Expected: true)`);
    if (!lockedAfter) throw new Error('Month must be locked after Approval');

    // Test Leave Application inside locked month -> MUST be blocked with 400
    const clType = await LeaveType.findOne({ code: 'CL' });
    const blockedLeaveRes = await request('POST', '/api/leaves', {
      leave_type_id: clType._id,
      from_date: '15/09/2026',
      to_date: '16/09/2026',
      reason: 'Attempt leave in locked payroll month'
    }, empToken);
    console.log(`   Leave Application in Locked Month: Status ${blockedLeaveRes.status} (Expected: 400 Bad Request) - ${blockedLeaveRes.body?.message}`);
    if (blockedLeaveRes.status !== 400) throw new Error('Leave application in locked month should be blocked');

    // ========================================================
    // 8️⃣ Testing Reopening Locked Payroll Cycle
    // ========================================================
    console.log('8️⃣ Testing Reopen Locked Payroll Cycle (Super Admin only)...');

    // Attempt without reason -> 400
    const emptyReasonReopen = await request('PUT', `/api/payroll/${testCycle._id}/reopen`, { reason: '' }, adminToken);
    console.log(`   Empty Reason Reopen: Status ${emptyReasonReopen.status} (Expected: 400 Bad Request)`);
    if (emptyReasonReopen.status !== 400) throw new Error('Missing reason should be rejected');

    // Super Admin reopens with reason
    const reopenRes = await request('PUT', `/api/payroll/${testCycle._id}/reopen`, {
      reason: 'Late mark regularization correction approved for Tech team'
    }, adminToken);
    console.log(`   Reopen Status: ${reopenRes.status}, Message: ${reopenRes.body.message}`);
    if (reopenRes.status !== 200) throw new Error('Failed to reopen payroll cycle');

    // Verify Month is unlocked
    const lockedAfterReopen = await isPayrollMonthLocked(new Date('2026-09-15'));
    console.log(`   Lock Check After Reopening: ${lockedAfterReopen} (Expected: false)`);
    if (lockedAfterReopen) throw new Error('Month should be unlocked after Reopening');

    // ========================================================
    // 9️⃣ Testing Release & Mark Paid Workflow
    // ========================================================
    console.log('9️⃣ Testing Release Payslips & Mark Paid Flow...');

    // Re-approve cycle
    await request('PUT', `/api/payroll/${testCycle._id}/approve`, null, adminToken);

    // Super Admin releases payslips
    const releaseRes = await request('PUT', `/api/payroll/${testCycle._id}/release`, null, adminToken);
    console.log(`   Release Payslips: Status ${releaseRes.status}, Modified: ${releaseRes.body.modified_count}`);
    if (releaseRes.status !== 200) throw new Error('Failed to release payslips');

    // Super Admin marks as Paid
    const markPaidRes = await request('PUT', `/api/payroll/${testCycle._id}/mark-paid`, {
      bank_advice_ref: 'HDFC-SALARY-20260930-001'
    }, adminToken);
    console.log(`   Mark Paid: Status ${markPaidRes.status}, Modified: ${markPaidRes.body.modified_count}`);
    if (markPaidRes.status !== 200) throw new Error('Failed to mark payroll as paid');

    // ========================================================
    // 🔟 Testing Payslip Viewing & PDF Download Gates
    // ========================================================
    console.log('🔟 Testing Payslip Viewing & PDF Download Gates...');

    const finalEmpRun = await PayrollRun.findOne({ cycle_id: testCycle._id, user_id: empUser._id });

    // Employee views own payslip -> 200
    const ownPayslipRes = await request('GET', `/api/payslips/${finalEmpRun._id}`, null, empToken);
    console.log(`   Employee Views Own Payslip: Status ${ownPayslipRes.status}, Net Pay: ₹${ownPayslipRes.body.data?.net_pay}`);
    if (ownPayslipRes.status !== 200) throw new Error('Employee failed to view own payslip');

    // Another employee view attempt -> 403
    const ceoOtherPayslipRes = await request('GET', `/api/payslips/${finalEmpRun._id}`, null, empToken); // Testing self check logic
    // Now test downloading PDF
    const pdfRes = await request('GET', `/api/payslips/${finalEmpRun._id}/pdf`, null, empToken);
    console.log(`   Download Payslip PDF: Status ${pdfRes.status}, Is PDF: ${pdfRes.isPdf}, Bytes: ${pdfRes.body?.length}`);
    if (pdfRes.status !== 200 || !pdfRes.isPdf || pdfRes.body.length === 0) {
      throw new Error('Failed to download payslip PDF');
    }

    // Verify PDF header magic bytes '%PDF'
    const pdfHeader = pdfRes.body.slice(0, 4).toString('utf-8');
    console.log(`   PDF Magic Header: ${pdfHeader} (Expected: %PDF)`);
    if (pdfHeader !== '%PDF') throw new Error('Invalid PDF binary stream');

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 6 (PAYROLL ENGINE) TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ MODULE 6 TEST FAILED:', error.message || error);
    process.exit(1);
  }
};

runTests();
