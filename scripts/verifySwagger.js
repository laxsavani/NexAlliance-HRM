const fs = require('fs');
const path = require('path');
const swaggerJsDoc = require('swagger-jsdoc');

// 1. Get Swagger Spec
const swaggerSpec = swaggerJsDoc({
  definition: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } },
  apis: ['./routes/*.js']
});

const documented = swaggerSpec.paths || {};

// 2. Read server.js to map route files to their mount paths
const serverContent = fs.readFileSync('./server.js', 'utf8');
const mountMap = {};

const lines = serverContent.split('\n');
lines.forEach(l => {
  const mountMatch = l.match(/app\.use\(['"]([^'"]+)['"],\s*(?:require\(['"]\.\/routes\/([^'"]+)['"]\)|([a-zA-Z0-9_]+))\)/);
  if (mountMatch) {
    const mountPath = mountMatch[1];
    const directReq = mountMatch[2];
    const varName = mountMatch[3];
    if (directReq) {
      mountMap[directReq.endsWith('.js') ? directReq : directReq + '.js'] = mountPath;
    } else if (varName) {
      const reqRegex = new RegExp(`const\\s+${varName}\\s*=\\s*require\\(['"]\\.\\/routes\\/([^'"]+)['"]\\)`);
      const reqMatch = serverContent.match(reqRegex);
      if (reqMatch) {
        const file = reqMatch[1].endsWith('.js') ? reqMatch[1] : reqMatch[1] + '.js';
        mountMap[file] = mountPath;
      }
    }
  }
});

// Also map nested router
mountMap['salaryStructureRoutes.js'] = '/api/employees/:userId/salary-structure';

const routeFiles = fs.readdirSync('./routes').filter(f => f.endsWith('.js'));
const allEndpoints = [];

routeFiles.forEach(file => {
  const mount = mountMap[file] || ('/api/' + file.replace('Routes.js', '').toLowerCase());
  const content = fs.readFileSync(path.join('./routes', file), 'utf8');

  // Case A: router.get('/path', ...), router.post('/path', ...)
  const directRegex = /router\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let m;
  while ((m = directRegex.exec(content)) !== null) {
    const method = m[1].toLowerCase();
    const routePart = m[2];
    let fullPath = mount.replace(/\/$/, '') + (routePart === '/' ? '' : routePart.startsWith('/') ? routePart : '/' + routePart);
    allEndpoints.push({ file, method, fullPath });
  }

  // Case B: router.route('/path').get(...).post(...)
  const routeChainRegex = /router\.route\(\s*['"`]([^'"`]+)['"`]\)([\s\S]*?)(?=router\b|module\.exports|$)/g;
  let chainMatch;
  while ((chainMatch = routeChainRegex.exec(content)) !== null) {
    const routePart = chainMatch[1];
    const chainBody = chainMatch[2];
    let fullPath = mount.replace(/\/$/, '') + (routePart === '/' ? '' : routePart.startsWith('/') ? routePart : '/' + routePart);
    
    ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
      const methodRegex = new RegExp(`\\.${method}\\s*\\(`, 'g');
      if (methodRegex.test(chainBody)) {
        allEndpoints.push({ file, method, fullPath });
      }
    });
  }
});

console.log(`\n=== COMPREHENSIVE SWAGGER API VERIFICATION ===\n`);
console.log(`Total Route Files in codebase: ${routeFiles.length}`);
console.log(`Total API route handlers in codebase: ${allEndpoints.length}`);

let missingCount = 0;
allEndpoints.forEach(ep => {
  const swaggerPath = ep.fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
  const isDoc = documented[swaggerPath] && documented[swaggerPath][ep.method];
  if (!isDoc) {
    missingCount++;
    console.log(`❌ MISSING: [${ep.file}] ${ep.method.toUpperCase()} ${ep.fullPath} -> Swagger: ${swaggerPath}`);
  }
});

console.log(`\nDocumented Endpoints: ${allEndpoints.length - missingCount} / ${allEndpoints.length}`);
if (missingCount === 0) {
  console.log('✅ ALL API ENDPOINTS (INCLUDING MODULE 8) ARE 100% COVERED IN SWAGGER DOCUMENTATION WITH ZERO MISSING!');
} else {
  console.log(`⚠️ ${missingCount} endpoints need documentation.`);
}
