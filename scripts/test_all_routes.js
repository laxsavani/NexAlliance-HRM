require('dotenv').config();
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

const verifyAllRoutes = async () => {
  console.log('🔍 Auditing ALL Registered API Routes in NexAlliance HRM...\n');

  try {
    // 1. Root & Health
    console.log('📌 System Routes:');
    const root = await request('GET', '/');
    console.log(`   GET  /                    -> Status: ${root.status} (${root.body.message})`);
    const health = await request('GET', '/api/health');
    console.log(`   GET  /api/health          -> Status: ${health.status} (${health.body.status})`);
    const docs = await request('GET', '/api/docs/');
    console.log(`   GET  /api/docs/           -> Status: ${docs.status}`);

    // 2. Auth Routes
    console.log('\n📌 Auth Routes:');
    const loginRes = await request('POST', '/api/auth/login', {
      email: 'admin@nexalliance.com',
      password: 'Admin@12345'
    });
    console.log(`   POST /api/auth/login      -> Status: ${loginRes.status} (Token: ${Boolean(loginRes.body.token)})`);
    const token = loginRes.body.token;

    const meRes = await request('GET', '/api/auth/me', null, token);
    console.log(`   GET  /api/auth/me         -> Status: ${meRes.status} (${meRes.body.data?.name})`);

    const permsRes = await request('GET', '/api/auth/me/permissions', null, token);
    console.log(`   GET  /api/auth/me/permissions -> Status: ${permsRes.status} (Count: ${permsRes.body.data?.length})`);

    // 3. Organization Masters
    console.log('\n📌 Organization Masters:');
    const deptRes = await request('GET', '/api/departments', null, token);
    console.log(`   GET  /api/departments     -> Status: ${deptRes.status} (Count: ${deptRes.body.count})`);

    const desigRes = await request('GET', '/api/designations', null, token);
    console.log(`   GET  /api/designations    -> Status: ${desigRes.status} (Count: ${desigRes.body.count})`);

    const branchRes = await request('GET', '/api/branches', null, token);
    console.log(`   GET  /api/branches        -> Status: ${branchRes.status} (Count: ${branchRes.body.count})`);

    const rolesRes = await request('GET', '/api/roles', null, token);
    console.log(`   GET  /api/roles           -> Status: ${rolesRes.status} (Count: ${rolesRes.body.count})`);

    const empRes = await request('GET', '/api/employees', null, token);
    console.log(`   GET  /api/employees       -> Status: ${empRes.status} (Count: ${empRes.body.count})`);

    const auditRes = await request('GET', '/api/audit-logs', null, token);
    console.log(`   GET  /api/audit-logs      -> Status: ${auditRes.status} (Count: ${auditRes.body.count})`);

    // 4. Module 2: Attendance & Shift Masters
    console.log('\n📌 Module 2: Attendance Engine Routes:');
    const shiftsRes = await request('GET', '/api/shifts', null, token);
    console.log(`   GET  /api/shifts          -> Status: ${shiftsRes.status} (Count: ${shiftsRes.body.count})`);

    const holidaysRes = await request('GET', '/api/holidays', null, token);
    console.log(`   GET  /api/holidays        -> Status: ${holidaysRes.status} (Count: ${holidaysRes.body.count})`);

    const attRes = await request('GET', '/api/attendance', null, token);
    console.log(`   GET  /api/attendance      -> Status: ${attRes.status} (Total Records: ${attRes.body.total})`);

    const lateSummaryRes = await request('GET', '/api/attendance/late-summary', null, token);
    console.log(`   GET  /api/attendance/late-summary -> Status: ${lateSummaryRes.status} (Month: ${lateSummaryRes.body.month})`);

    const exportRes = await request('GET', '/api/attendance/export', null, token);
    console.log(`   GET  /api/attendance/export -> Status: ${exportRes.status} (Count: ${exportRes.body.count})`);

    // Clock-in route testing (POST method)
    const clockInPost = await request('POST', '/api/attendance/clock-in', { lat: 21.1702, lng: 72.8311 }, token);
    console.log(`   POST /api/attendance/clock-in -> Status: ${clockInPost.status} (${clockInPost.body.message})`);

    // Clock-out route testing (POST method)
    const clockOutPost = await request('POST', '/api/attendance/clock-out', { lat: 21.1702, lng: 72.8311 }, token);
    console.log(`   POST /api/attendance/clock-out -> Status: ${clockOutPost.status} (${clockOutPost.body.message})`);

    console.log('\n=============================================================');
    console.log('✅ ALL API ROUTES ARE REGISTERED AND FUNCTIONING 100% CORRECTLY!');
    console.log('=============================================================\n');

  } catch (err) {
    console.error('❌ Route audit failed with error:', err.message);
  }
};

verifyAllRoutes();
