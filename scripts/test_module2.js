const http = require('http');

const request = (method, path, body = null, token = null) => {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };

    if (body) {
      headers['Content-Length'] = Buffer.byteLength(dataString);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(dataString);
    }
    req.end();
  });
};

const runModule2Tests = async () => {
  console.log('🧪 Starting Automated Module 2 (Attendance Engine) Test Suite...\n');

  try {
    // 1. Super Admin Login
    console.log('1️⃣ Authenticating Super Admin...');
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    if (adminLogin.status !== 200 || !adminLogin.body.token) throw new Error('Super admin login failed');
    const adminToken = adminLogin.body.token;
    console.log('   ✓ Super Admin authenticated.');

    // 2. Shift Master CRUD
    console.log('2️⃣ Verifying Shift & Late Policy Master...');
    const shiftsRes = await request('GET', '/api/shifts', null, adminToken);
    console.log(`   Found ${shiftsRes.body.count} active shift(s).`);
    const defaultShift = shiftsRes.body.data[0];
    console.log(`   Default Shift: ${defaultShift.name} (${defaultShift.start_time} - ${defaultShift.end_time}, Grace: ${defaultShift.grace_in_min}m, Free Lates: ${defaultShift.monthly_late_allowed}, Deduct: ${defaultShift.late_deduct_days} days/late)`);

    // 3. Holiday Calendar Master
    console.log('3️⃣ Verifying Holiday Calendar Master...');
    const holidaysRes = await request('GET', '/api/holidays?year=2026', null, adminToken);
    console.log(`   Found ${holidaysRes.body.count} 2026 Holiday(s).`);

    // 4. Test Super Admin Exemption from Clock-In
    console.log('4️⃣ Testing Super Admin Exemption from Clock-In...');
    const adminClockIn = await request('POST', '/api/attendance/clock-in', {
      lat: 21.1702,
      lng: 72.8311
    }, adminToken);
    console.log(`   Admin Clock-In Status: ${adminClockIn.status} (Expected: 403 Forbidden) - ${adminClockIn.body.message}`);
    if (adminClockIn.status !== 403) throw new Error('Super Admin attendance exemption guard failed');

    // 5. Create a Test Employee for Attendance Testing
    console.log('5️⃣ Creating Test Employee for Attendance Clock-In & Punch tracking...');
    const rolesRes = await request('GET', '/api/roles', null, adminToken);
    const empRole = rolesRes.body.data.find(r => r.code === 'EMPLOYEE');
    const branchesRes = await request('GET', '/api/branches', null, adminToken);
    let branch = branchesRes.body.data.find(b => b.latitude != null && b.longitude != null);
    if (!branch && branchesRes.body.data.length > 0) {
      const firstBranch = branchesRes.body.data[0];
      const updateRes = await request('PUT', `/api/branches/${firstBranch._id}`, {
        latitude: 21.1702,
        longitude: 72.8311,
        radius_m: 200
      }, adminToken);
      branch = updateRes.body.data;
    } else if (!branch) {
      const createRes = await request('POST', '/api/branches', {
        name: `Surat HQ ${Date.now()}`,
        latitude: 21.1702,
        longitude: 72.8311,
        radius_m: 200,
        timezone: 'Asia/Kolkata'
      }, adminToken);
      branch = createRes.body.data;
    }

    const testEmail = `attendee_${Date.now()}@nexalliance.com`;
    const empRes = await request('POST', '/api/employees', {
      employee_code: `ATT${Date.now().toString().slice(-4)}`,
      name: 'Pooja Sharma',
      email: testEmail,
      password: 'Employee@123',
      role_id: empRole._id,
      branch_id: branch._id,
      shift_id: defaultShift._id,
      phone: '+91 9123456780',
      dob: '20/05/1995',
      salary: 55000
    }, adminToken);

    const empId = empRes.body.data._id;
    console.log(`   Employee Created: ${empRes.body.data.name} (ID: ${empId})`);

    // Login as the Employee
    const empLogin = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'Employee@123'
    });
    const empToken = empLogin.body.token;

    // 6. Test Geofence Validation (Far away coords -> 400 Bad Request)
    console.log('6️⃣ Testing Geofence Validation (Far away coordinates)...');
    const geoFailPunch = await request('POST', '/api/attendance/clock-in', {
      lat: 0.0, // Equator
      lng: 0.0
    }, empToken);
    console.log(`   Geofence Rejection Status: ${geoFailPunch.status} (Expected: 400 Bad Request) - ${geoFailPunch.body.message}`);
    if (geoFailPunch.status !== 400) throw new Error('Geofence validation failed to block out-of-bounds punch');

    // 7. Test Valid Clock-In
    console.log('7️⃣ Testing Valid Clock-In within Branch Coordinates...');
    const validClockIn = await request('POST', '/api/attendance/clock-in', {
      lat: branch.latitude,
      lng: branch.longitude,
      source: 'WEB'
    }, empToken);
    console.log(`   Clock-In Status: ${validClockIn.status} (Success: ${validClockIn.body.success})`);
    console.log(`   Late Mark: ${validClockIn.body.is_late}, Message: ${validClockIn.body.message}`);
    if (validClockIn.status !== 200) throw new Error('Valid clock-in failed');

    // 8. Test Valid Clock-Out
    console.log('8️⃣ Testing Valid Clock-Out...');
    const validClockOut = await request('POST', '/api/attendance/clock-out', {
      lat: branch.latitude,
      lng: branch.longitude,
      source: 'WEB'
    }, empToken);
    console.log(`   Clock-Out Status: ${validClockOut.status} (Work Minutes: ${validClockOut.body.daily?.work_minutes}m)`);
    if (validClockOut.status !== 200) throw new Error('Valid clock-out failed');

    // 9. Test Late Counter Escalation Simulation
    console.log('9️⃣ Testing Late Counter Escalation & LOP Deduction Calculations...');
    const simYear = 2026;
    const simMonth = 8; // August 2026 (Isolated clean month)

    // Simulate 5 late records for this employee across consecutive dates
    for (let day = 1; day <= 5; day++) {
      const simDate = `${day < 10 ? '0' + day : day}/08/2026`;
      await request('PUT', `/api/attendance/${empId}/${encodeURIComponent(simDate)}`, {
        first_in: new Date(Date.UTC(simYear, simMonth - 1, day, 4, 45, 0)), // 10:15 AM IST (Late)
        last_out: new Date(Date.UTC(simYear, simMonth - 1, day, 13, 0, 0)),  // 6:30 PM IST
        status: 'Late',
        is_late: true
      }, adminToken);
    }

    const lateSummaryRes = await request('GET', `/api/attendance/late-summary?user_id=${empId}&year=${simYear}&month=${simMonth}`, null, adminToken);
    const summary = lateSummaryRes.body.data;
    console.log(`   Monthly Summary Result: Late Count: ${summary.late_count}, Allowed: ${summary.allowed}, Extra Lates: ${summary.extra_lates}, LOP Deduction Days: ${summary.deduction_days}`);
    
    // Assert 5 lates -> allowed 3 -> 2 extra lates -> 2 * 0.5 = 1.0 day deduction
    if (summary.late_count !== 5 || summary.extra_lates !== 2 || summary.deduction_days !== 1.0) {
      throw new Error(`Late counter mismatch! Expected 5 lates, 2 extra, 1.0 deduction day, but got ${JSON.stringify(summary)}`);
    }
    console.log('   ✓ Late counter and LOP deduction days calculated perfectly (1.0 LOP day for 5 late marks).');

    // 10. Test Manual Admin Correction (Recalculate Late Status)
    console.log('🔟 Testing Manual Admin Correction (Waiving 2 Late Marks)...');
    const fixDate1 = '01/08/2026';
    const fixDate2 = '02/08/2026';

    await request('PUT', `/api/attendance/${empId}/${encodeURIComponent(fixDate1)}`, {
      is_late: false,
      status: 'Present',
      remarks: 'Manager Approved Bus Delay Waiver'
    }, adminToken);

    const updatedSummaryRes = await request('PUT', `/api/attendance/${empId}/${encodeURIComponent(fixDate2)}`, {
      is_late: false,
      status: 'Present',
      remarks: 'Manager Approved Train Delay Waiver'
    }, adminToken);

    const updatedSummary = updatedSummaryRes.body.late_summary;
    console.log(`   Updated Summary Result: Late Count: ${updatedSummary.late_count}, Extra Lates: ${updatedSummary.extra_lates}, LOP Deduction Days: ${updatedSummary.deduction_days}`);
    
    // Assert 3 lates -> allowed 3 -> 0 extra lates -> 0.0 deduction days
    if (updatedSummary.late_count !== 3 || updatedSummary.extra_lates !== 0 || updatedSummary.deduction_days !== 0) {
      throw new Error(`Recalculation after manual fix failed! Got: ${JSON.stringify(updatedSummary)}`);
    }
    console.log('   ✓ Late counter automatically decreased to 3 and LOP deduction days dropped to 0.0!');

    // 11. Test Daily Status Reconciliation Job
    console.log('1️⃣1️⃣ Testing End-of-Day Daily Status Reconciliation Job...');
    const jobRes = await request('POST', '/api/attendance/run-daily-job', {
      date: '19/09/2026'
    }, adminToken);
    console.log(`   Daily Job Execution: ${jobRes.status} (Processed ${jobRes.body.result?.processedCount} employees)`);
    if (jobRes.status !== 200) throw new Error('Daily status job failed');

    // 12. Test Report Export & Scope Permissions
    console.log('1️⃣2️⃣ Testing Report Export & Security Permissions...');
    const empExportAttempt = await request('GET', '/api/attendance/export', null, empToken);
    console.log(`   Employee Export Attempt: ${empExportAttempt.status} (Expected: 403 Forbidden)`);
    if (empExportAttempt.status !== 403) throw new Error('Employee export boundary failed');

    const adminExport = await request('GET', '/api/attendance/export?format=csv', null, adminToken);
    console.log(`   Admin Export CSV Status: ${adminExport.status} (Length: ${adminExport.body.length} chars)`);
    if (adminExport.status !== 200) throw new Error('Admin export failed');

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 2 (ATTENDANCE) TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Module 2 Test Failed with error:', err.message);
    process.exit(1);
  }
};

runModule2Tests();
