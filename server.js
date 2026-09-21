require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { connectDB, ensureDbConnected } = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const setupSwagger = require('./config/swagger');

// Route files
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionMatrixRoutes = require('./routes/permissionMatrixRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const designationRoutes = require('./routes/designationRoutes');
const branchRoutes = require('./routes/branchRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const regularizationReasonRoutes = require('./routes/regularizationReasonRoutes');
const regularizationRoutes = require('./routes/regularizationRoutes');
const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const approvalMatrixRoutes = require('./routes/approvalMatrixRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const salaryComponentRoutes = require('./routes/salaryComponentRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const payslipRoutes = require('./routes/payslipRoutes');
const notificationTemplateRoutes = require('./routes/notificationTemplateRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const sensitiveChangeRequestRoutes = require('./routes/sensitiveChangeRequestRoutes');
const loginAttemptRoutes = require('./routes/loginAttemptRoutes');

// Middlewares for rate limiting and global audit logging
const { generalApiRateLimiter } = require('./middlewares/rateLimiter');
const auditWrapper = require('./middlewares/auditWrapper');

const app = express();

// Connect to MongoDB Atlas
connectDB();

// Security and utility middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-bypass-rate-limit']
}));

// Setup Swagger API Documentation at /api/docs
setupSwagger(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve uploaded documents and photos statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root Welcome & Documentation pointer
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to NexAlliance HRM System Backend API',
    documentation: '/api/docs',
    health: '/api/health',
    version: '1.0.0'
  });
});

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'NexAlliance HRM Backend API is healthy and running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Middleware to ensure DB connection is active before executing model queries (prevents bufferCommands errors in serverless)
app.use(ensureDbConnected);

// Global General API Rate Limiter
app.use('/api', generalApiRateLimiter);

// Global Audit Logging Wrapper for write operations (POST, PUT, PATCH, DELETE)
app.use('/api', auditWrapper());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permission-matrix', permissionMatrixRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/designations', designationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/regularization-reasons', regularizationReasonRoutes);
app.use('/api/regularizations', regularizationRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/approval-matrix', approvalMatrixRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/salary-components', salaryComponentRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/payslips', payslipRoutes);
app.use('/api/notification-templates', notificationTemplateRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/sensitive-change-requests', sensitiveChangeRequestRoutes);
app.use('/api/login-attempts', loginAttemptRoutes);

// Fallback 404 handler for undefined API routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found`
  });
});

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 NexAlliance HRM Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`💥 Unhandled Rejection: ${err.message}`);
});

module.exports = app;
