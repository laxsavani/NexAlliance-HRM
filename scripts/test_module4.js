const http = require('http');

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

const runModule4Tests = async () => {
  console.log('🧪 Starting Automated Module 4 (Leave Management Engine) Test Suite...\n');

  try {
    // 1. Authenticate Super Admin
    console.log('1️⃣ Authenticating Super Admin...');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    console.log('Admin login response:', adminLogin);
    if (adminLogin.status !== 200 || !adminLogin.body.token) throw new Error(`Super Admin login failed with status ${adminLogin.status}`);
    const adminToken = adminLogin.body.token;
    console.log('   ✓ Super Admin authenticated.');

    // 2. Leave Type Master Verification
    console.log('2️⃣ Verifying Leave Type Master...');
    const typesRes = await request('GET', '/api/leave-types', null, adminToken);
    console.log(`   Found ${typesRes.body.count} leave type(s).`);
    const shortLeaveType = typesRes.body.data.find(t => t.code === 'SHORT_LEAVE');
    const lwpType = typesRes.body.data.find(t => t.code === 'LWP');
    const clType = typesRes.body.data.find(t => t.code === 'CL');

    if (!shortLeaveType || !lwpType) throw new Error('Default seeded leave types missing');
    console.log(`   Short Leave Type: Quota ${shortLeaveType.quota}/${shortLeaveType.quota_period}, Max ${shortLeaveType.max_duration_minutes}m`);

    // 3. Super Admin Exemption Guard
    console.log('3️⃣ Testing Super Admin Exemption from Applying for Leave...');
    const adminApplyAttempt = await request('POST', '/api/leaves', {
      leave_type_id: shortLeaveType._id,
      from_date: '25/09/2026',
      to_date: '25/09/2026',
      day_part: 'SHORT',
      from_time: '10:00',
      to_time: '11:30',
      reason: 'Admin doctor appointment'
    }, adminToken);
    console.log(`   Admin Apply Status: ${adminApplyAttempt.status} (Expected: 403 Forbidden) - ${adminApplyAttempt.body.message}`);
    if (adminApplyAttempt.status !== 403) throw new Error('Super Admin leave exemption check failed');

    // 4. Setup Test Employee, CEO, and CTO
    console.log('4️⃣ Setting Up Test Employee, CEO, and CTO...');
    const rolesRes = await request('GET', '/api/roles', null, adminToken);
    const empRole = rolesRes.body.data.find(r => r.code === 'EMPLOYEE');
    const ceoRole = rolesRes.body.data.find(r => r.code === 'CEO');
    const ctoRole = rolesRes.body.data.find(r => r.code === 'CTO');
    const branchesRes = await request('GET', '/api/branches', null, adminToken);
    const branch = branchesRes.body.data[0];
    const shiftsRes = await request('GET', '/api/shifts', null, adminToken);
    const shift = shiftsRes.body.data[0];

    const empEmail = `leave_emp_${Date.now()}@nexalliance.com`;
    const empRes = await request('POST', '/api/employees', {
      employee_code: `LEV${Date.now().toString().slice(-4)}`,
      name: 'Pooja Leave',
      email: empEmail,
      password: 'Employee@123',
      role_id: empRole._id,
      branch_id: branch._id,
      shift_id: shift._id,
      phone: '+91 9988776655',
      dob: '15/08/1997',
      salary: 65000
    }, adminToken);
    const empId = empRes.body.data._id;

    const ceoEmail = `ceo_leave_${Date.now()}@nexalliance.com`;
    const ceoRes = await request('POST', '/api/employees', {
      employee_code: `CEO${Date.now().toString().slice(-4)}`,
      name: 'Vikram CEO',
      email: ceoEmail,
      password: 'Ceo@12345678',
      role_id: ceoRole._id,
      branch_id: branch._id,
      shift_id: shift._id,
      phone: '+91 9988771122',
      dob: '01/01/1982',
      salary: 300000
    }, adminToken);
    const ceoId = ceoRes.body.data._id;

    const ctoEmail = `cto_leave_${Date.now()}@nexalliance.com`;
    const ctoRes = await request('POST', '/api/employees', {
      employee_code: `CTO${Date.now().toString().slice(-4)}`,
      name: 'Sneha CTO',
      email: ctoEmail,
      password: 'Cto@12345678',
      role_id: ctoRole._id,
      branch_id: branch._id,
      shift_id: shift._id,
      phone: '+91 9988773344',
      dob: '05/05/1984',
      salary: 280000
    }, adminToken);
    const ctoId = ctoRes.body.data._id;

    const empLogin = await request('POST', '/api/auth/login', { email: empEmail, password: 'Employee@123' });
    const empToken = empLogin.body.token;

    const ceoLogin = await request('POST', '/api/auth/login', { email: ceoEmail, password: 'Ceo@12345678' });
    const ceoToken = ceoLogin.body.token;

    const ctoLogin = await request('POST', '/api/auth/login', { email: ctoEmail, password: 'Cto@12345678' });
    const ctoToken = ctoLogin.body.token;
    console.log(`   ✓ Employee, CEO, and CTO authenticated.`);

    // 5. Short Leave Quota & Hold-Then-Deduct Verification
    console.log('5️⃣ Testing Short Leave Quota (Max 2/Month) & Hold-Then-Deduct Balance Engine...');
    // Apply 1st Short Leave
    const req1 = await request('POST', '/api/leaves', {
      leave_type_id: shortLeaveType._id,
      from_date: '24/09/2026',
      to_date: '24/09/2026',
      day_part: 'SHORT',
      from_time: '10:00',
      to_time: '11:30',
      reason: 'Morning dental checkup'
    }, empToken);
    console.log(`   1st Short Leave: Status ${req1.status} (ID: ${req1.body.data?._id})`);
    if (req1.status !== 201) throw new Error('1st Short Leave application failed');

    // Apply 2nd Short Leave
    const req2 = await request('POST', '/api/leaves', {
      leave_type_id: shortLeaveType._id,
      from_date: '28/09/2026',
      to_date: '28/09/2026',
      day_part: 'SHORT',
      from_time: '17:00',
      to_time: '18:30',
      reason: 'Evening passport renewal appointment'
    }, empToken);
    console.log(`   2nd Short Leave: Status ${req2.status} (ID: ${req2.body.data?._id})`);
    if (req2.status !== 201) throw new Error('2nd Short Leave application failed');

    // Check Balance (opening: 2, pending: 2, used: 0, available: 0)
    const balRes = await request('GET', `/api/leaves/balance?year=2026&month=9`, null, empToken);
    const shortBal = balRes.body.data.find(b => b.leave_type.code === 'SHORT_LEAVE');
    console.log(`   Balance Check: Opening: ${shortBal.opening}, Pending: ${shortBal.pending}, Used: ${shortBal.used}, Available: ${shortBal.available}`);
    if (shortBal.pending !== 2 || shortBal.used !== 0 || shortBal.available !== 0) {
      throw new Error(`Hold-then-deduct failed! Expected pending=2, used=0, available=0, got: ${JSON.stringify(shortBal)}`);
    }

    // Apply 3rd Short Leave in same month -> Must be rejected with 400
    const req3 = await request('POST', '/api/leaves', {
      leave_type_id: shortLeaveType._id,
      from_date: '29/09/2026',
      to_date: '29/09/2026',
      day_part: 'SHORT',
      from_time: '10:00',
      to_time: '11:30',
      reason: '3rd Short Leave attempt'
    }, empToken);
    console.log(`   3rd Short Leave Status: ${req3.status} (Expected: 400 Bad Request) - ${req3.body.message}`);
    if (req3.status !== 400) throw new Error('Short Leave 2/month quota enforcement failed');

    // 6. Dual CEO+CTO Approval Flow (Employee Leave)
    console.log('6️⃣ Testing Dual CEO+CTO Approval Workflow (Employee Leave)...');
    const req1Id = req1.body.data._id;

    // Step 6A: CEO Approves -> Status remains Pending (1 of 2)
    const ceoApprove1 = await request('PUT', `/api/leaves/${req1Id}/approve`, {
      remark: 'Approved by CEO'
    }, ceoToken);
    console.log(`   CEO Approval: Status ${ceoApprove1.status}, Request Status: ${ceoApprove1.body.data?.status} (${ceoApprove1.body.data?.approvals_done} of ${ceoApprove1.body.data?.approvals_needed})`);
    if (ceoApprove1.status !== 200 || ceoApprove1.body.data?.status !== 'Pending' || ceoApprove1.body.data?.approvals_done !== 1) {
      throw new Error('Partial approval failed');
    }

    // Step 6B: CTO Approves -> Final Approval (Status -> Approved, used += 1, pending -= 1)
    const ctoApprove1 = await request('PUT', `/api/leaves/${req1Id}/approve`, {
      remark: 'Approved by CTO'
    }, ctoToken);
    console.log(`   CTO Approval: Status ${ctoApprove1.status}, Request Status: ${ctoApprove1.body.data?.status} (Fully Approved: ${ctoApprove1.body.fully_approved})`);
    if (ctoApprove1.status !== 200 || ctoApprove1.body.data?.status !== 'Approved') {
      throw new Error('Final approval failed');
    }

    // Verify balance after final approval (used: 1, pending: 1)
    const balResAfter = await request('GET', `/api/leaves/balance?year=2026&month=9`, null, empToken);
    const shortBalAfter = balResAfter.body.data.find(b => b.leave_type.code === 'SHORT_LEAVE');
    console.log(`   Balance After Approval: Pending: ${shortBalAfter.pending}, Used: ${shortBalAfter.used}`);
    if (shortBalAfter.used !== 1 || shortBalAfter.pending !== 1) {
      throw new Error(`Balance deduction failed! Expected used=1, pending=1, got: ${JSON.stringify(shortBalAfter)}`);
    }

    // 7. Rejection Circuit Breaker
    console.log('7️⃣ Testing Rejection Circuit Breaker (CTO Rejects Request 2)...');
    const req2Id = req2.body.data._id;
    const ctoReject2 = await request('PUT', `/api/leaves/${req2Id}/reject`, {
      decision_remark: 'Department meeting scheduled during this window'
    }, ctoToken);
    console.log(`   Rejection: Status ${ctoReject2.status}, Request Status: ${ctoReject2.body.data?.status}`);
    if (ctoReject2.status !== 200 || ctoReject2.body.data?.status !== 'Rejected') {
      throw new Error('Rejection failed');
    }

    // Verify pending balance was released (pending drops to 0, available increases to 1)
    const balResAfterReject = await request('GET', `/api/leaves/balance?year=2026&month=9`, null, empToken);
    const shortBalReject = balResAfterReject.body.data.find(b => b.leave_type.code === 'SHORT_LEAVE');
    console.log(`   Balance After Rejection: Pending: ${shortBalReject.pending}, Used: ${shortBalReject.used}, Available: ${shortBalReject.available}`);
    if (shortBalReject.pending !== 0 || shortBalReject.used !== 1 || shortBalReject.available !== 1) {
      throw new Error('Pending balance release on rejection failed');
    }

    // 8. CEO / CTO Cross-Approval Workflow
    console.log('8️⃣ Testing CEO / CTO Cross-Approval Workflow...');
    // CTO applies for leave -> Approver is CEO only (approvals_needed: 1)
    const ctoApply = await request('POST', '/api/leaves', {
      leave_type_id: lwpType._id,
      from_date: '30/09/2026',
      to_date: '30/09/2026',
      day_part: 'FULL',
      reason: 'Personal tech conference'
    }, ctoToken);
    console.log(`   CTO Apply: Status ${ctoApply.status}, Approvals Needed: ${ctoApply.body.data?.approvals_needed}, Approvers: ${ctoApply.body.data?.approvers?.length}`);
    if (ctoApply.status !== 201 || ctoApply.body.data?.approvals_needed !== 1) {
      throw new Error('CTO cross-approval chain resolution failed');
    }

    // CEO approves CTO's leave -> Immediately finalized as Approved
    const ceoApproveCto = await request('PUT', `/api/leaves/${ctoApply.body.data._id}/approve`, {
      remark: 'Approved by CEO for conference'
    }, ceoToken);
    console.log(`   CEO Approves CTO: Status ${ceoApproveCto.status}, New Request Status: ${ceoApproveCto.body.data?.status}`);
    if (ceoApproveCto.status !== 200 || ceoApproveCto.body.data?.status !== 'Approved') {
      throw new Error('Single-approver cross approval failed');
    }

    // 9. Full Day Leave & Attendance Daily Status Hook Verification
    console.log('9️⃣ Testing Full Day Casual Leave & AttendanceDaily Hook Integration...');
    const clApply = await request('POST', '/api/leaves', {
      leave_type_id: clType._id,
      from_date: '25/09/2026',
      to_date: '26/09/2026',
      day_part: 'FULL',
      reason: 'Family out of station travel'
    }, empToken);
    const clId = clApply.body.data._id;

    // Both CEO and CTO approve CL
    await request('PUT', `/api/leaves/${clId}/approve`, { remark: 'OK CEO' }, ceoToken);
    const clFinal = await request('PUT', `/api/leaves/${clId}/approve`, { remark: 'OK CTO' }, ctoToken);
    console.log(`   Casual Leave Finalized: ${clFinal.body.data?.status}, Days: ${clFinal.body.data?.days}`);
    if (clFinal.status !== 200 || clFinal.body.data?.status !== 'Approved') {
      throw new Error('Casual leave dual approval failed');
    }

    // Run Daily Status Job for 25/09/2026 and verify status == 'Leave'
    const dailyJobRes = await request('POST', '/api/attendance/run-daily-job', {
      date: '25/09/2026'
    }, adminToken);
    console.log(`   Daily Job Executed for 25/09/2026: Status ${dailyJobRes.status}`);

    const attRes = await request('GET', `/api/attendance?user_id=${empId}&from=25/09/2026&to=25/09/2026`, null, adminToken);
    const record = attRes.body.data[0];
    console.log(`   AttendanceDaily Record on Leave Date: Status = [${record?.status}] (Expected: Leave)`);
    if (record?.status !== 'Leave') {
      throw new Error(`Daily status reconciliation hook failed! Expected status='Leave', got: ${record?.status}`);
    }

    // 10. Cancellation & Super Admin Balance Adjustment Flow
    console.log('🔟 Testing Cancellation & Super Admin Manual Balance Adjustment...');
    // Requester cancels future approved Short Leave 1
    const cancelRes = await request('PUT', `/api/leaves/${req1Id}/cancel`, null, empToken);
    console.log(`   Short Leave Cancellation: Status ${cancelRes.status}, Request Status: ${cancelRes.body.data?.status}`);
    if (cancelRes.status !== 200 || cancelRes.body.data?.status !== 'Cancelled') {
      throw new Error('Cancellation failed');
    }

    // Super Admin adjusts employee Casual Leave balance (+3 days compensatory off)
    const adjustRes = await request('POST', '/api/leaves/adjust-balance', {
      user_id: empId,
      leave_type_id: clType._id,
      year: 2026,
      qty: 3,
      reason: 'Compensatory off for weekend deployment support'
    }, adminToken);
    console.log(`   Balance Adjustment: Status ${adjustRes.status}, Adjusted: +${adjustRes.body.data?.adjusted}`);
    if (adjustRes.status !== 200 || adjustRes.body.data?.adjusted !== 3) {
      throw new Error('Balance adjustment failed');
    }

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 4 (LEAVE MANAGEMENT) TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Module 4 Test Failed with error:', err.message);
    process.exit(1);
  }
};

runModule4Tests();
