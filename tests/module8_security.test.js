const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const app = require('../server');
const User = require('../models/User');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const LoginAttempt = require('../models/LoginAttempt');
const SensitiveChangeRequest = require('../models/SensitiveChangeRequest');
const { 
  encrypt, 
  decrypt, 
  maskBankAccount, 
  maskPan, 
  maskAadhaar, 
  generateTotpToken 
} = require('../utils/cryptoUtils');

let server;
let baseUrl;

// Helper to make HTTP requests
const request = (method, path, body = null, token = null, extraHeaders = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = {
      'Content-Type': 'application/json',
      'x-bypass-rate-limit': 'true', // Allow test suite to run rapidly
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
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: data });
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

async function runModule8Tests() {
  console.log('🧪 Starting Automated Module 8 (Security & Hardening) Test Suite...');

  // 1. Wait for DB connection
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
    });
  }
  console.log('✅ Connected to MongoDB for Module 8 test suite');

  // Start temporary test server
  const testPort = 5098;
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(testPort, resolve));
  baseUrl = `http://localhost:${testPort}`;

  try {
    // -------------------------------------------------------------
    // STAGE 1: AES-256-GCM Encryption, Decryption & Masking Tests
    // -------------------------------------------------------------
    console.log('\n1️⃣ Testing AES-256-GCM Encryption, Decryption & Masking...');
    
    const samplePan = 'ABCDE1234F';
    const sampleAcc = '123456789012';
    const sampleAadhaar = '1234 5678 9012';

    const encPan = encrypt(samplePan);
    const encAcc = encrypt(sampleAcc);
    const encAadhaar = encrypt(sampleAadhaar);

    if (!encPan || !encPan.includes(':') || encPan.split(':').length !== 3) {
      throw new Error(`Encryption failed to produce iv:authTag:ciphertext format: ${encPan}`);
    }

    const decPan = decrypt(encPan);
    const decAcc = decrypt(encAcc);
    const decAadhaar = decrypt(encAadhaar);

    if (decPan !== samplePan || decAcc !== sampleAcc || decAadhaar !== sampleAadhaar) {
      throw new Error(`Decryption round-trip mismatch: got ${decPan}, expected ${samplePan}`);
    }

    const maskedAcc = maskBankAccount(sampleAcc);
    const maskedPan = maskPan(samplePan);
    const maskedAadhaar = maskAadhaar(sampleAadhaar);

    if (maskedAcc !== 'XXXXXXXX9012') throw new Error(`Unexpected masked bank account: ${maskedAcc}`);
    if (maskedPan !== 'XXXXX1234X') throw new Error(`Unexpected masked PAN: ${maskedPan}`);
    if (maskedAadhaar !== 'XXXXXXXX9012') throw new Error(`Unexpected masked Aadhaar: ${maskedAadhaar}`);

    console.log(`   ✓ AES-256-GCM round-trip & masking algorithms verified.`);

    // -------------------------------------------------------------
    // STAGE 2: Authentication & Token Acquisition
    // -------------------------------------------------------------
    console.log('\n2️⃣ Authenticating Super Admin & Test Employee...');

    // Fetch existing Super Admin
    const superAdminUser = await User.findOne({ email: 'admin@nexalliance.com' }).populate('role_id');
    if (!superAdminUser) throw new Error('Super Admin user (admin@nexalliance.com) not found');

    // Reset lockout, password and 2FA states for fresh test
    superAdminUser.password_hash = await User.hashPassword('Admin@12345');
    superAdminUser.failed_login_count = 0;
    superAdminUser.locked_until = null;
    superAdminUser.two_fa_enabled = false;
    await superAdminUser.save();

    const adminLoginRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error(`Super Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminToken = adminLoginRes.body.token;
    const adminRefreshToken = adminLoginRes.body.refresh_token;

    // Create or find a test employee
    let employeeRole = await Role.findOne({ code: 'EMPLOYEE' });
    if (!employeeRole) {
      employeeRole = await Role.create({
        name: 'Employee',
        code: 'EMPLOYEE',
        description: 'Standard Employee Role',
        is_super_admin: false,
        status: 'Active'
      });
    }

    let testEmp = await User.findOne({ email: 'sec_test_emp@nexalliance.com' });
    if (!testEmp) {
      testEmp = await User.create({
        employee_code: 'SEC-001',
        name: 'Security Test Employee',
        email: 'sec_test_emp@nexalliance.com',
        password_hash: await User.hashPassword('Emp@12345'),
        role_id: employeeRole._id,
        status: 'Active',
        bank_details: { account_number: '112233445566', bank_name: 'HDFC Bank', ifsc_code: 'HDFC0001' },
        identity_documents: { pan_number: 'ABCDE5678G', aadhar_number: '987654321098' }
      });
    } else {
      testEmp.failed_login_count = 0;
      testEmp.locked_until = null;
      testEmp.two_fa_enabled = false;
      await testEmp.save();
    }

    const empLoginRes = await request('POST', '/api/auth/login', {
      email: 'sec_test_emp@nexalliance.com',
      password: 'Emp@12345'
    });

    if (empLoginRes.status !== 200) {
      throw new Error(`Test Employee login failed: ${JSON.stringify(empLoginRes.body)}`);
    }
    const empToken = empLoginRes.body.token;

    console.log(`   ✓ Authenticated Super Admin and Test Employee.`);

    // -------------------------------------------------------------
    // STAGE 3: Serialization-level Masking Verification
    // -------------------------------------------------------------
    console.log('\n3️⃣ Testing Serialization-level Masking on Profile Endpoints...');

    // Employee viewing own profile
    const empMeRes = await request('GET', '/api/auth/me', null, empToken);
    if (empMeRes.status !== 200) throw new Error('GET /api/auth/me failed');

    const returnedEmpData = empMeRes.body.data;
    if (returnedEmpData.bank_details?.account_number !== 'XXXXXXXX5566') {
      throw new Error(`Expected masked account number 'XXXXXXXX5566', got: ${returnedEmpData.bank_details?.account_number}`);
    }
    if (returnedEmpData.identity_documents?.pan_number !== 'XXXXX5678X') {
      throw new Error(`Expected masked PAN 'XXXXX5678X', got: ${returnedEmpData.identity_documents?.pan_number}`);
    }

    // Super Admin viewing employee via standard GET /api/employees/:id
    const adminViewEmpRes = await request('GET', `/api/employees/${testEmp._id}`, null, adminToken);
    if (adminViewEmpRes.status !== 200) throw new Error('GET /api/employees/:id failed');
    if (adminViewEmpRes.body.data.bank_details?.account_number !== 'XXXXXXXX5566') {
      throw new Error(`Expected masked account for Admin standard view, got: ${adminViewEmpRes.body.data.bank_details?.account_number}`);
    }

    console.log(`   ✓ Employee self-view & Admin standard-view both return masked sensitive data.`);

    // -------------------------------------------------------------
    // STAGE 4: Non-Super Admin Sensitive Field Change Flow
    // -------------------------------------------------------------
    console.log('\n4️⃣ Testing Sensitive Field Change Request (Pending Flow)...');

    const changeReqRes = await request('PUT', '/api/employees/me/sensitive-field', {
      field: 'bank_account',
      new_value: '998877665544'
    }, empToken);

    if (changeReqRes.status !== 201 || changeReqRes.body.data.status !== 'Pending') {
      throw new Error(`Sensitive field change submission failed: ${JSON.stringify(changeReqRes.body)}`);
    }
    const requestId = changeReqRes.body.data.id;

    // Verify User record is UNTOUCHED before approval
    const freshEmp = await User.findById(testEmp._id);
    if (freshEmp.bank_account_enc) {
      const currentDec = decrypt(freshEmp.bank_account_enc);
      if (currentDec === '998877665544') {
        throw new Error('User record was mutated directly before Super Admin approval!');
      }
    }

    console.log(`   ✓ Sensitive change submitted as Pending; User record remains untouched.`);

    // -------------------------------------------------------------
    // STAGE 5: Super Admin Approves Sensitive Change Request
    // -------------------------------------------------------------
    console.log('\n5️⃣ Testing Super Admin Sensitive Change Approval...');

    const listReqsRes = await request('GET', '/api/sensitive-change-requests?status=Pending', null, adminToken);
    if (listReqsRes.status !== 200 || listReqsRes.body.count === 0) {
      throw new Error(`Failed to list pending requests: ${JSON.stringify(listReqsRes.body)}`);
    }

    const approveRes = await request('PUT', `/api/sensitive-change-requests/${requestId}/approve`, {
      remark: 'Verified with bank statement'
    }, adminToken);

    if (approveRes.status !== 200 || approveRes.body.data.status !== 'Approved') {
      throw new Error(`Approval failed: ${JSON.stringify(approveRes.body)}`);
    }

    // Verify User record is now updated with ciphertext
    const updatedEmp = await User.findById(testEmp._id);
    const decryptedAccount = decrypt(updatedEmp.bank_account_enc);
    if (decryptedAccount !== '998877665544') {
      throw new Error(`Expected encrypted bank account to decrypt to 998877665544, got ${decryptedAccount}`);
    }

    console.log(`   ✓ Super Admin approval committed AES-256 encrypted bank account to User record.`);

    // -------------------------------------------------------------
    // STAGE 6: Super Admin Dedicated Unmask Route & Audit Log
    // -------------------------------------------------------------
    console.log('\n6️⃣ Testing Dedicated Super Admin Unmask Route & Audit Log...');

    const unmaskRes = await request('GET', `/api/employees/${testEmp._id}/sensitive-fields/unmask`, null, adminToken);
    if (unmaskRes.status !== 200) {
      throw new Error(`Unmask route failed: ${JSON.stringify(unmaskRes.body)}`);
    }

    if (unmaskRes.body.data.bank_details.account_number !== '998877665544') {
      throw new Error(`Expected unmasked bank account 998877665544, got: ${unmaskRes.body.data.bank_details.account_number}`);
    }

    // Verify SENSITIVE_VIEW AuditLog record was created
    const auditLogs = await AuditLog.find({
      module: 'EMPLOYEE',
      action: 'SENSITIVE_VIEW',
      'new_value.target_employee_id': testEmp._id
    });
    if (auditLogs.length === 0) {
      throw new Error('Mandatory SENSITIVE_VIEW AuditLog entry was NOT created!');
    }

    // Verify Employee cannot access unmask route (403)
    const empUnmaskAttempt = await request('GET', `/api/employees/${testEmp._id}/sensitive-fields/unmask`, null, empToken);
    if (empUnmaskAttempt.status !== 403) {
      throw new Error(`Expected 403 for employee calling unmask, got ${empUnmaskAttempt.status}`);
    }

    console.log(`   ✓ Unmasked view returns plaintext data and logged mandatory SENSITIVE_VIEW audit record.`);

    // -------------------------------------------------------------
    // STAGE 7: Login Lockout (5 Failed Attempts -> 423 Locked)
    // -------------------------------------------------------------
    console.log('\n7️⃣ Testing Account Lockout on 5 Failed Login Attempts...');

    const victimEmail = 'victim_lockout_test@nexalliance.com';
    let victimUser = await User.findOne({ email: victimEmail });
    if (!victimUser) {
      victimUser = await User.create({
        employee_code: 'VIC-001',
        name: 'Victim User',
        email: victimEmail,
        password_hash: await User.hashPassword('CorrectPass@123'),
        role_id: employeeRole._id,
        status: 'Active'
      });
    } else {
      victimUser.failed_login_count = 0;
      victimUser.locked_until = null;
      await victimUser.save();
    }

    // 5 rapid failed attempts
    for (let i = 1; i <= 5; i++) {
      const failRes = await request('POST', '/api/auth/login', {
        email: victimEmail,
        password: 'WrongPassword'
      });
      if (i < 5) {
        if (failRes.status !== 401) throw new Error(`Attempt ${i} expected 401, got ${failRes.status}`);
      } else {
        // 5th attempt locks account
        if (failRes.status !== 423 && failRes.status !== 401) {
          throw new Error(`5th attempt expected lockout (423/401), got ${failRes.status}`);
        }
      }
    }

    // 6th attempt WITH THE CORRECT PASSWORD must be blocked with 423 Locked
    const lockedRes = await request('POST', '/api/auth/login', {
      email: victimEmail,
      password: 'CorrectPass@123'
    });

    if (lockedRes.status !== 423) {
      throw new Error(`Expected 423 Locked on 6th attempt with correct password, got ${lockedRes.status}: ${JSON.stringify(lockedRes.body)}`);
    }

    console.log(`   ✓ 5 failed attempts triggered 15-min lockout (HTTP 423 even with correct password).`);

    // -------------------------------------------------------------
    // STAGE 8: 2FA Setup, Verify & TOTP Login Flow
    // -------------------------------------------------------------
    console.log('\n8️⃣ Testing Super Admin 2FA TOTP Setup & Verification...');

    // Non-super admin cannot setup 2FA (policy default)
    const emp2FASetup = await request('POST', '/api/auth/2fa/setup', null, empToken);
    if (emp2FASetup.status !== 403) {
      throw new Error(`Expected 403 for employee setting up 2FA, got ${emp2FASetup.status}`);
    }

    // Super Admin sets up 2FA
    const setup2FARes = await request('POST', '/api/auth/2fa/setup', null, adminToken);
    if (setup2FARes.status !== 200 || !setup2FARes.body.secret) {
      throw new Error(`2FA setup failed: ${JSON.stringify(setup2FARes.body)}`);
    }
    const totpSecret = setup2FARes.body.secret;

    // Generate valid TOTP token for current window
    const validTotp = generateTotpToken(totpSecret);

    // Verify & enable 2FA
    const verify2FARes = await request('POST', '/api/auth/2fa/verify', {
      totp_code: validTotp
    }, adminToken);

    if (verify2FARes.status !== 200) {
      throw new Error(`2FA verify failed: ${JSON.stringify(verify2FARes.body)}`);
    }

    // Now login without TOTP -> expected 400 (two_fa_required)
    const loginNoTotp = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    if (loginNoTotp.status !== 400 || !loginNoTotp.body.two_fa_required) {
      throw new Error(`Expected 400 two_fa_required, got ${loginNoTotp.status}`);
    }

    // Login with valid TOTP -> expected 200
    const loginWithTotp = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345',
      totp_code: generateTotpToken(totpSecret)
    });
    if (loginWithTotp.status !== 200 || !loginWithTotp.body.token) {
      throw new Error(`Login with TOTP failed: ${JSON.stringify(loginWithTotp.body)}`);
    }

    // Reset 2FA on Super Admin so subsequent tests don't require TOTP
    await User.findByIdAndUpdate(superAdminUser._id, { two_fa_enabled: false, two_fa_secret_enc: null });

    console.log(`   ✓ 2FA setup, TOTP verification, and 2FA login challenge passed.`);

    // -------------------------------------------------------------
    // STAGE 9: Refresh Token Rotation
    // -------------------------------------------------------------
    console.log('\n9️⃣ Testing Refresh Token Rotation...');

    const refreshRes = await request('POST', '/api/auth/refresh-token', {
      refresh_token: adminRefreshToken
    });
    if (refreshRes.status !== 200 || !refreshRes.body.token) {
      throw new Error(`Refresh token rotation failed: ${JSON.stringify(refreshRes.body)}`);
    }

    console.log(`   ✓ Refresh token issued a new valid access token.`);

    // -------------------------------------------------------------
    // STAGE 10: Super Admin Login Attempts Inspection
    // -------------------------------------------------------------
    console.log('\n🔟 Testing Login Attempts Audit Inspection...');

    const loginAttemptsRes = await request('GET', '/api/login-attempts?user_email=' + victimEmail, null, adminToken);
    if (loginAttemptsRes.status !== 200 || loginAttemptsRes.body.count === 0) {
      throw new Error(`Failed to query login attempts: ${JSON.stringify(loginAttemptsRes.body)}`);
    }

    const empLoginAttempts = await request('GET', '/api/login-attempts', null, empToken);
    if (empLoginAttempts.status !== 403) {
      throw new Error(`Expected 403 for employee calling /api/login-attempts, got ${empLoginAttempts.status}`);
    }

    console.log(`   ✓ Login attempt security logs successfully queried by Super Admin (guarded for non-admins).`);

    console.log('\n=============================================================');
    console.log('🎉 ALL MODULE 8 (SECURITY & HARDENING) TESTS PASSED PERFECTLY!');
    console.log('=============================================================');

  } catch (err) {
    console.error('\n❌ Module 8 Test Suite Failed:', err.message);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runModule8Tests();
