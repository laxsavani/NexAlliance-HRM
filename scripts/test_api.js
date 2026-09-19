const http = require('http');

// Helper to make HTTP JSON requests
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

const runTests = async () => {
  console.log('🧪 Starting Automated Module 1 Foundation Tests...\n');

  try {
    // 1. Health Check
    console.log('1️⃣ Checking API Health...');
    const health = await request('GET', '/api/health');
    console.log(`   Health Status: ${health.status} (${health.body.status})`);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Super Admin Login
    console.log('2️⃣ Testing Super Admin Login...');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    console.log(`   Login Status: ${loginRes.status} (Success: ${loginRes.body.success})`);
    if (loginRes.status !== 200 || !loginRes.body.token) throw new Error('Super admin login failed');
    const adminToken = loginRes.body.token;
    const adminId = loginRes.body.user.id;

    // 3. Super Admin Permissions check
    console.log('3️⃣ Checking Super Admin Permissions Matrix...');
    const permRes = await request('GET', '/api/auth/me/permissions', null, adminToken);
    console.log(`   Permissions count: ${permRes.body.permissions.length}, Super Admin: ${permRes.body.is_super_admin}`);
    if (!permRes.body.is_super_admin) throw new Error('Super admin flag not set');

    // 4. Create Department, Designation, Branch
    console.log('4️⃣ Testing Master Creation (Department, Designation, Branch)...');
    const deptRes = await request('POST', '/api/departments', {
      name: 'Human Resources',
      code: `HR_${Date.now()}`
    }, adminToken);
    console.log(`   Department Created: ${deptRes.body.data.name} (Code: ${deptRes.body.data.code})`);

    const desigRes = await request('POST', '/api/designations', {
      name: 'HR Executive',
      code: `HRE_${Date.now()}`,
      department_id: deptRes.body.data._id,
      level: 3
    }, adminToken);
    console.log(`   Designation Created: ${desigRes.body.data.name}`);

    const branchRes = await request('POST', '/api/branches', {
      name: `Mumbai Hub ${Date.now()}`,
      address: 'Andheri East, Mumbai, Maharashtra',
      latitude: 19.1136,
      longitude: 72.8697,
      radius_m: 250
    }, adminToken);
    console.log(`   Branch Created: ${branchRes.body.data.name}`);

    // Get Employee role ID
    const rolesRes = await request('GET', '/api/roles', null, adminToken);
    const empRole = rolesRes.body.data.find(r => r.code === 'EMPLOYEE');
    if (!empRole) throw new Error('Employee role not found');

    // 5. Create Employee with Bank Details, KYC & Academic Documents
    console.log('5️⃣ Creating Employee with Bank Details, KYC (Aadhaar, PAN), and Marksheets...');
    const testEmail = `rahul.patel_${Date.now()}@nexalliance.com`;
    const empRes = await request('POST', '/api/employees', {
      employee_code: `EMP${Date.now().toString().slice(-4)}`,
      name: 'Rahul Patel',
      email: testEmail,
      password: 'Employee@123',
      role_id: empRole._id,
      department_id: deptRes.body.data._id,
      designation_id: desigRes.body.data._id,
      branch_id: branchRes.body.data._id,
      dob: '15/08/1998',
      date_of_joining: '19/09/2026',
      salary: 45000,
      phone: '+91 9988776655',
      address: '402, Royal Residency, Surat',
      emergency_contact: '+91 9988776600',
      bank_details: {
        account_holder_name: 'Rahul Patel',
        account_number: '123456789012',
        bank_name: 'HDFC Bank',
        ifsc_code: 'HDFC0001234',
        branch_name: 'Ring Road Branch',
        upi_id: 'rahul@okhdfcbank'
      },
      identity_documents: {
        aadhar_number: '1234 5678 9012',
        aadhar_card_url: '/uploads/documents/sample-aadhar.pdf',
        pan_number: 'ABCDE1234F',
        pan_card_url: '/uploads/documents/sample-pan.pdf'
      },
      education_documents: {
        tenth_marksheet_url: '/uploads/documents/10th-marksheet.pdf',
        twelfth_marksheet_url: '/uploads/documents/12th-marksheet.pdf',
        diploma_marksheet_url: '/uploads/documents/diploma-marksheet.pdf',
        graduation_certificate_url: '/uploads/documents/btech-degree.pdf'
      }
    }, adminToken);

    console.log(`   Employee Created: ${empRes.body.data.name} (${empRes.body.data.employee_code})`);
    console.log(`   DOB (DD/MM/YYYY): ${empRes.body.data.dob_formatted}, DOJ (DD/MM/YYYY): ${empRes.body.data.doj_formatted}`);
    console.log(`   Salary: ₹${empRes.body.data.salary}`);
    console.log(`   Bank Account: ${empRes.body.data.bank_details.account_number} (${empRes.body.data.bank_details.bank_name})`);
    console.log(`   Aadhaar & PAN: ${empRes.body.data.identity_documents.aadhar_number}, ${empRes.body.data.identity_documents.pan_number}`);
    console.log(`   10th & 12th/Diploma: ${empRes.body.data.education_documents.tenth_marksheet_url}, ${empRes.body.data.education_documents.diploma_marksheet_url}`);
    const empId = empRes.body.data._id;

    // 6. Login as the newly created Employee
    console.log('6️⃣ Testing Employee Login & Self-Service Token...');
    const empLogin = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'Employee@123'
    });
    console.log(`   Employee Login Status: ${empLogin.status} (Success: ${empLogin.body.success})`);
    const empToken = empLogin.body.token;

    // 7. Employee viewing own profile
    console.log('7️⃣ Testing Employee Profile Access (OWN Scope)...');
    const empOwnProfile = await request('GET', `/api/employees/${empId}`, null, empToken);
    console.log(`   Employee Own Profile: ${empOwnProfile.status === 200 ? 'SUCCESS (200)' : 'FAILED'}`);

    // 8. Security Test: Employee attempting to view Super Admin profile
    console.log('8️⃣ Testing Scope Security Boundary (Employee viewing Super Admin profile)...');
    const forbiddenProfile = await request('GET', `/api/employees/${adminId}`, null, empToken);
    console.log(`   Access Status: ${forbiddenProfile.status} (Expected: 403 Forbidden)`);
    if (forbiddenProfile.status !== 403) throw new Error('Scope boundary failed! Employee was able to view unauthorized profile');

    // 9. Security Test: Employee attempting to modify own role_id
    console.log('9️⃣ Testing Self-Edit Whitelist Security (Employee trying to escalate role to SUPER_ADMIN)...');
    const roleEscalationAttempt = await request('PUT', `/api/employees/${empId}`, {
      role_id: rolesRes.body.data.find(r => r.code === 'SUPER_ADMIN')._id,
      phone: '+91 9999999999'
    }, empToken);
    
    // Check if role was ignored
    const checkEmp = await request('GET', `/api/employees/${empId}`, null, empToken);
    const roleUnchanged = checkEmp.body.data.role_id.code === 'EMPLOYEE';
    console.log(`   Role Escalation Blocked: ${roleUnchanged ? 'YES (Role preserved as EMPLOYEE)' : 'NO (VULNERABILITY DETECTED)'}`);
    console.log(`   Allowed Field Updated: Phone is ${checkEmp.body.data.phone}`);
    if (!roleUnchanged) throw new Error('Privilege escalation vulnerability in employee self-update');

    // 10. Security Test: Attempt to deactivate last Super Admin
    console.log('🔟 Testing Last Active Super Admin Protection Guard...');
    const demoteAdminAttempt = await request('DELETE', `/api/employees/${adminId}`, null, adminToken);
    console.log(`   Deactivation Guard Status: ${demoteAdminAttempt.status} (Expected: 400 Bad Request) - ${demoteAdminAttempt.body.message}`);
    if (demoteAdminAttempt.status !== 400) throw new Error('Failed to protect last active Super Admin');

    // 11. Super Admin Audit Logs
    console.log('1️⃣1️⃣ Testing Audit Log Recording...');
    const auditRes = await request('GET', '/api/audit-logs', null, adminToken);
    console.log(`   Audit Log Count: ${auditRes.body.total} entries recorded`);
    console.log(`   Recent Action: [${auditRes.body.data[0]?.module}] ${auditRes.body.data[0]?.action}`);

    console.log('\n=============================================================');
    console.log('🎉 ALL INTEGRATION AND SECURITY TESTS PASSED PERFECTLY!');
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
};

runTests();
