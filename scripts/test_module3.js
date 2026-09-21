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

const runModule3Tests = async () => {
  console.log('🧪 Starting Automated Module 3 (Regularization Engine) Test Suite...\n');

  try {
    // 1. Super Admin Authentication
    console.log('1️⃣ Authenticating Super Admin...');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    console.log('Admin login response:', adminLogin);
    if (adminLogin.status !== 200 || !adminLogin.body.token) throw new Error(`Super Admin login failed with status ${adminLogin.status}`);
    const adminToken = adminLogin.body.token;
    console.log('   ✓ Super Admin authenticated.');

    // 2. Regularization Reason Master CRUD
    console.log('2️⃣ Verifying Regularization Reason Master CRUD...');
    const reasonsRes = await request('GET', '/api/regularization-reasons', null, adminToken);
    console.log(`   Found ${reasonsRes.body.count} active reason(s).`);
    if (!reasonsRes.body.data || reasonsRes.body.data.length === 0) throw new Error('No regularization reasons found');
    const sampleReason = reasonsRes.body.data[0];

    const newReasonRes = await request('POST', '/api/regularization-reasons', {
      reason: `Temporary Test Reason ${Date.now()}`
    }, adminToken);
    console.log(`   Reason Created: ${newReasonRes.body.data.reason} (Status: ${newReasonRes.status})`);
    if (newReasonRes.status !== 201) throw new Error('Failed to create regularization reason');

    // 3. Super Admin Exemption Guard
    console.log('3️⃣ Testing Super Admin Exemption from Applying for Regularization...');
    const now = new Date();
    const targetDateObj = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const targetDateStr = `${targetDateObj.getDate() < 10 ? '0' + targetDateObj.getDate() : targetDateObj.getDate()}/${(targetDateObj.getMonth() + 1) < 10 ? '0' + (targetDateObj.getMonth() + 1) : (targetDateObj.getMonth() + 1)}/${targetDateObj.getFullYear()}`;

    const adminApplyAttempt = await request('POST', '/api/regularizations', {
      date: targetDateStr,
      req_in: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 4, 30, 0)),
      req_out: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 13, 0, 0)),
      reason_id: sampleReason._id
    }, adminToken);

    console.log(`   Admin Apply Status: ${adminApplyAttempt.status} (Expected: 403 Forbidden) - ${adminApplyAttempt.body.message}`);
    if (adminApplyAttempt.status !== 403) throw new Error('Super Admin regularization exemption check failed');

    // 4. Create Test Employee & Test CEO
    console.log('4️⃣ Setting Up Test Employee & CEO...');
    const rolesRes = await request('GET', '/api/roles', null, adminToken);
    const empRole = rolesRes.body.data.find(r => r.code === 'EMPLOYEE');
    const ceoRole = rolesRes.body.data.find(r => r.code === 'CEO');
    const branchesRes = await request('GET', '/api/branches', null, adminToken);
    const branch = branchesRes.body.data[0];
    const shiftsRes = await request('GET', '/api/shifts', null, adminToken);
    const shift = shiftsRes.body.data[0];

    const empEmail = `reg_emp_${Date.now()}@nexalliance.com`;
    const empRes = await request('POST', '/api/employees', {
      employee_code: `REG${Date.now().toString().slice(-4)}`,
      name: 'Rohan Verma',
      email: empEmail,
      password: 'Employee@123',
      role_id: empRole._id,
      branch_id: branch._id,
      shift_id: shift._id,
      phone: '+91 9876500112',
      dob: '12/04/1996',
      salary: 60000
    }, adminToken);
    const empId = empRes.body.data._id;

    const ceoEmail = `ceo_${Date.now()}@nexalliance.com`;
    const ceoRes = await request('POST', '/api/employees', {
      employee_code: `CEO${Date.now().toString().slice(-4)}`,
      name: 'Vikram Malhotra',
      email: ceoEmail,
      password: 'Ceo@12345678',
      role_id: ceoRole._id,
      branch_id: branch._id,
      shift_id: shift._id,
      phone: '+91 9876500999',
      dob: '01/01/1985',
      salary: 250000
    }, adminToken);

    const empLogin = await request('POST', '/api/auth/login', { email: empEmail, password: 'Employee@123' });
    const empToken = empLogin.body.token;

    const ceoLogin = await request('POST', '/api/auth/login', { email: ceoEmail, password: 'Ceo@12345678' });
    const ceoToken = ceoLogin.body.token;
    console.log(`   ✓ Employee (${empEmail}) & CEO (${ceoEmail}) created and authenticated.`);

    // 5. Validation Guards: Future Date & Out of Window Limits
    console.log('5️⃣ Testing Validation Guards (Future Date & Out-of-Window)...');
    const futureDateStr = '25/12/2030';
    const futureApply = await request('POST', '/api/regularizations', {
      date: futureDateStr,
      req_in: new Date('2030-12-25T04:30:00.000Z'),
      req_out: new Date('2030-12-25T13:00:00.000Z'),
      reason_id: sampleReason._id
    }, empToken);
    console.log(`   Future Date Status: ${futureApply.status} (Expected: 400 Bad Request) - ${futureApply.body.message}`);
    if (futureApply.status !== 400) throw new Error('Future date guard failed');

    const oldDateStr = '01/01/2025'; // Beyond 7 days
    const oldApply = await request('POST', '/api/regularizations', {
      date: oldDateStr,
      req_in: new Date('2025-01-01T04:30:00.000Z'),
      req_out: new Date('2025-01-01T13:00:00.000Z'),
      reason_id: sampleReason._id
    }, empToken);
    console.log(`   Old Date Status: ${oldApply.status} (Expected: 400 Bad Request) - ${oldApply.body.message}`);
    if (oldApply.status !== 400) throw new Error('Old date window guard failed');

    // 6. Valid Submission by Employee
    console.log('6️⃣ Testing Valid Regularization Submission by Employee...');
    const validApply = await request('POST', '/api/regularizations', {
      date: targetDateStr,
      req_in: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 4, 30, 0)), // 10:00 AM IST (On-Time)
      req_out: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 13, 0, 0)),  // 6:30 PM IST
      reason_id: sampleReason._id,
      remark: 'Biometric fingerprint reader was unresponsive'
    }, empToken);
    console.log(`   Apply Status: ${validApply.status} (Request ID: ${validApply.body.data?._id})`);
    if (validApply.status !== 201) throw new Error('Valid regularization submission failed');
    const requestId = validApply.body.data._id;

    // 7. Duplicate Pending Request Guard
    console.log('7️⃣ Testing Duplicate Pending Request Guard...');
    const duplicateApply = await request('POST', '/api/regularizations', {
      date: targetDateStr,
      req_in: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 4, 30, 0)),
      req_out: new Date(Date.UTC(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 13, 0, 0)),
      reason_id: sampleReason._id
    }, empToken);
    console.log(`   Duplicate Apply Status: ${duplicateApply.status} (Expected: 400 Bad Request) - ${duplicateApply.body.message}`);
    if (duplicateApply.status !== 400) throw new Error('Duplicate pending request guard failed');

    // 8. Scope-Based Access Verification (OWN vs ALL)
    console.log('8️⃣ Verifying Role Scopes (Employee: OWN, CEO: ALL read-only)...');
    const empList = await request('GET', '/api/regularizations', null, empToken);
    console.log(`   Employee List Count: ${empList.body.total} (All owned by requester: ${empList.body.data.every(r => r.user_id._id === empId)})`);
    if (empList.status !== 200 || empList.body.total < 1) throw new Error('Employee list query failed');

    // Employee attempting to view someone else's user_id -> 403
    const empHackAttempt = await request('GET', `/api/regularizations?user_id=66ebc1234567890abcdef123`, null, empToken);
    console.log(`   Employee Cross-Access Status: ${empHackAttempt.status} (Expected: 403 Forbidden)`);
    if (empHackAttempt.status !== 403) throw new Error('Employee cross-user access breach');

    // CEO viewing all requests -> 200
    const ceoList = await request('GET', '/api/regularizations', null, ceoToken);
    console.log(`   CEO List Count: ${ceoList.body.total} (Status: ${ceoList.status})`);
    if (ceoList.status !== 200) throw new Error('CEO view access failed');

    // 9. CEO Attempting to Approve/Reject -> Must Return 403 (Super Admin ONLY)
    console.log('9️⃣ Verifying CEO/CTO Cannot Approve or Reject Requests (Super Admin ONLY Rule)...');
    const ceoApproveAttempt = await request('PUT', `/api/regularizations/${requestId}/approve`, null, ceoToken);
    console.log(`   CEO Approve Attempt Status: ${ceoApproveAttempt.status} (Expected: 403 Forbidden) - ${ceoApproveAttempt.body.message}`);
    if (ceoApproveAttempt.status !== 403) throw new Error('CEO approval security breach! Only Super Admin can approve');

    const ceoRejectAttempt = await request('PUT', `/api/regularizations/${requestId}/reject`, {
      decision_remark: 'CEO reject attempt'
    }, ceoToken);
    console.log(`   CEO Reject Attempt Status: ${ceoRejectAttempt.status} (Expected: 403 Forbidden) - ${ceoRejectAttempt.body.message}`);
    if (ceoRejectAttempt.status !== 403) throw new Error('CEO rejection security breach! Only Super Admin can reject');

    // 10. Super Admin Rejection Validation & Cancellation Flow
    console.log('🔟 Testing Rejection Validation & Cancellation Flow...');
    // A. Rejection without remark -> 400
    const emptyReject = await request('PUT', `/api/regularizations/${requestId}/reject`, {
      decision_remark: ''
    }, adminToken);
    console.log(`   Empty Reject Status: ${emptyReject.status} (Expected: 400 Bad Request) - ${emptyReject.body.message}`);
    if (emptyReject.status !== 400) throw new Error('Empty reject remark validation failed');

    // B. Create a second request to test cancellation
    const targetDate2Obj = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const targetDate2Str = `${targetDate2Obj.getDate() < 10 ? '0' + targetDate2Obj.getDate() : targetDate2Obj.getDate()}/${(targetDate2Obj.getMonth() + 1) < 10 ? '0' + (targetDate2Obj.getMonth() + 1) : (targetDate2Obj.getMonth() + 1)}/${targetDate2Obj.getFullYear()}`;

    const cancelTargetReq = await request('POST', '/api/regularizations', {
      date: targetDate2Str,
      req_in: new Date(Date.UTC(targetDate2Obj.getFullYear(), targetDate2Obj.getMonth(), targetDate2Obj.getDate(), 4, 30, 0)),
      req_out: new Date(Date.UTC(targetDate2Obj.getFullYear(), targetDate2Obj.getMonth(), targetDate2Obj.getDate(), 13, 0, 0)),
      reason_id: sampleReason._id
    }, empToken);
    const cancelReqId = cancelTargetReq.body.data._id;

    // Requester cancels Pending request
    const cancelRes = await request('PUT', `/api/regularizations/${cancelReqId}/cancel`, null, empToken);
    console.log(`   Cancel Status: ${cancelRes.status} (New Status: ${cancelRes.body.data?.status})`);
    if (cancelRes.status !== 200 || cancelRes.body.data.status !== 'Cancelled') throw new Error('Cancellation failed');

    // 11. Super Admin Approval Flow & Attendance Reconciliation
    console.log('1️⃣1️⃣ Testing Super Admin Approval & Attendance Reconciliation...');
    const approveRes = await request('PUT', `/api/regularizations/${requestId}/approve`, {
      decision_remark: 'Approved by Super Admin after review'
    }, adminToken);

    console.log(`   Approve Status: ${approveRes.status} (Success: ${approveRes.body.success})`);
    console.log(`   Updated AttendanceDaily Status: ${approveRes.body.data?.daily?.status} (is_regularized: ${approveRes.body.data?.daily?.is_regularized})`);
    console.log(`   Late Counter Recomputed: Late Count: ${approveRes.body.data?.late_summary?.late_count}, Deduction Days: ${approveRes.body.data?.late_summary?.deduction_days}`);

    if (
      approveRes.status !== 200 ||
      approveRes.body.data?.daily?.status !== 'Regularized' ||
      approveRes.body.data?.daily?.is_regularized !== true
    ) {
      throw new Error('Approval failed to update AttendanceDaily to Regularized');
    }

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 3 (REGULARIZATION) TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Module 3 Test Failed with error:', err.message);
    process.exit(1);
  }
};

runModule3Tests();
