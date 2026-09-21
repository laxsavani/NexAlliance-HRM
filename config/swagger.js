const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NexAlliance HRM System - API Documentation',
      version: '1.0.0',
      description: `
### NexAlliance Enterprise Human Resource Management (HRM) System API Documentation

**Core Stack:** Node.js, Express.js, MongoDB (Mongoose), Cloudinary

#### Modules Covered:
- **Module 1: Foundation Layer** (Authentication, RBAC & Permission Matrix, Organization Masters, Employee Master with Bank & KYC/Marksheets, and System-Wide Audit Log)

#### Key Architectural Rules:
1. **Master-Driven**: Nothing is hardcoded. Departments, Designations, Roles, Branches, and Permissions are all dynamically managed in database tables.
2. **Access Control**: Super Admin has immediate bypass across all endpoints; CEO and CTO have identical high-level read access; Employee has self-service limited scope (OWN).
3. **Audit Logged**: Every write operation (Create, Update, Deactivate, Upload) generates an immutable audit record.
4. **Cloud Storage**: All documents, identity cards, and marksheets are uploaded to Cloudinary.
      `,
      contact: {
        name: 'NexAlliance IT Support',
        email: 'support@nexalliance.com'
      }
    },
    servers: [
      {
        url: 'https://nexallianceitsolution.vercel.app',
        description: 'Vercel Production Server'
      },
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from `/api/auth/login`'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error description message' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@nexalliance.com' },
            password: { type: 'string', example: 'Admin@12345' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '66ebc1234567890abcdef123' },
                employee_code: { type: 'string', example: 'NEX-0001' },
                name: { type: 'string', example: 'Super Administrator' },
                email: { type: 'string', example: 'admin@nexalliance.com' },
                attendance_exempt: { type: 'boolean', example: true }
              }
            }
          }
        },
        BankDetails: {
          type: 'object',
          properties: {
            account_holder_name: { type: 'string', example: 'Rahul Patel' },
            account_number: { type: 'string', example: '123456789012' },
            bank_name: { type: 'string', example: 'HDFC Bank' },
            ifsc_code: { type: 'string', example: 'HDFC0001234' },
            branch_name: { type: 'string', example: 'Ring Road Branch, Surat' },
            upi_id: { type: 'string', example: 'rahul@okhdfcbank' }
          }
        },
        IdentityDocuments: {
          type: 'object',
          properties: {
            aadhar_number: { type: 'string', example: '1234 5678 9012' },
            aadhar_card_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/image/upload/sample_aadhar.pdf' },
            pan_number: { type: 'string', example: 'ABCDE1234F' },
            pan_card_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/image/upload/sample_pan.pdf' }
          }
        },
        EducationDocuments: {
          type: 'object',
          properties: {
            tenth_marksheet_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/raw/upload/10th-marksheet.pdf' },
            twelfth_marksheet_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/raw/upload/12th-marksheet.pdf' },
            diploma_marksheet_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/raw/upload/diploma-marksheet.pdf' },
            graduation_certificate_url: { type: 'string', example: 'https://res.cloudinary.com/djn7ivlo7/raw/upload/btech-degree.pdf' }
          }
        },
        EmployeeCreateRequest: {
          type: 'object',
          required: ['employee_code', 'name', 'email', 'password', 'role_id'],
          properties: {
            employee_code: { type: 'string', example: 'EMP-1002' },
            name: { type: 'string', example: 'Rahul Patel' },
            email: { type: 'string', format: 'email', example: 'rahul.patel@nexalliance.com' },
            password: { type: 'string', example: 'Employee@123' },
            role_id: { type: 'string', example: '66ebc1234567890abcdef101' },
            department_id: { type: 'string', example: '66ebc1234567890abcdef102' },
            designation_id: { type: 'string', example: '66ebc1234567890abcdef103' },
            branch_id: { type: 'string', example: '66ebc1234567890abcdef104' },
            dob: { type: 'string', example: '15/08/1998', description: 'Date of Birth in DD/MM/YYYY format' },
            date_of_joining: { type: 'string', example: '19/09/2026', description: 'Date of Joining in DD/MM/YYYY format' },
            salary: { type: 'number', example: 50000, description: 'Monthly Gross / CTC Salary' },
            phone: { type: 'string', example: '+91 9876543210' },
            address: { type: 'string', example: '402, Royal Residency, Surat, Gujarat' },
            emergency_contact: { type: 'string', example: '+91 9876543200' },
            bank_details: { $ref: '#/components/schemas/BankDetails' },
            identity_documents: { $ref: '#/components/schemas/IdentityDocuments' },
            education_documents: { $ref: '#/components/schemas/EducationDocuments' }
          }
        },
        Shift: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'General Day Shift' },
            start_time: { type: 'string', example: '10:00' },
            end_time: { type: 'string', example: '18:30' },
            grace_in_min: { type: 'number', example: 10 },
            monthly_late_allowed: { type: 'number', example: 3 },
            late_action: { type: 'string', enum: ['DEDUCT', 'FLAG'], example: 'DEDUCT' },
            late_deduct_days: { type: 'number', example: 0.5 },
            half_day_hrs: { type: 'number', example: 4 },
            full_day_hrs: { type: 'number', example: 8 },
            status: { type: 'string', example: 'Active' }
          }
        },
        Holiday: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '26/01/2026' },
            name: { type: 'string', example: 'Republic Day' },
            type: { type: 'string', enum: ['HOLIDAY', 'WEEKLY_OFF'], example: 'HOLIDAY' },
            status: { type: 'string', example: 'Active' }
          }
        },
        AttendanceDaily: {
          type: 'object',
          properties: {
            date: { type: 'string', example: '19/09/2026' },
            status: { type: 'string', example: 'Present' },
            first_in: { type: 'string', example: '2026-09-19T04:30:00.000Z' },
            last_out: { type: 'string', example: '2026-09-19T13:00:00.000Z' },
            work_minutes: { type: 'number', example: 510 },
            is_late: { type: 'boolean', example: false },
            is_regularized: { type: 'boolean', example: false }
          }
        },
        LateMonthlySummary: {
          type: 'object',
          properties: {
            year: { type: 'number', example: 2026 },
            month: { type: 'number', example: 9 },
            late_count: { type: 'number', example: 4 },
            allowed: { type: 'number', example: 3 },
            extra_lates: { type: 'number', example: 1 },
            deduction_days: { type: 'number', example: 0.5 }
          }
        },
        RegularizationReason: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef123' },
            reason: { type: 'string', example: 'Biometric / Device Issue' },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' }
          }
        },
        RegularizationRequest: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef456' },
            user_id: { type: 'string', example: '66ebc1234567890abcdef789' },
            date: { type: 'string', example: '15/09/2026' },
            req_in: { type: 'string', format: 'date-time', example: '2026-09-15T04:30:00.000Z' },
            req_out: { type: 'string', format: 'date-time', example: '2026-09-15T13:00:00.000Z' },
            reason_id: { type: 'string', example: '66ebc1234567890abcdef123' },
            remark: { type: 'string', example: 'Biometric fingerprint reader was offline' },
            status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], example: 'Pending' },
            decided_by: { type: 'string', example: '66ebc1234567890abcdef001' },
            decision_remark: { type: 'string', example: 'Verified with IT helpdesk log' },
            decided_at: { type: 'string', format: 'date-time' }
          }
        },
        LeaveType: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef123' },
            code: { type: 'string', example: 'SHORT_LEAVE' },
            name: { type: 'string', example: 'Short Leave' },
            is_paid: { type: 'boolean', example: true },
            quota: { type: 'number', example: 2 },
            quota_period: { type: 'string', enum: ['MONTH', 'YEAR'], example: 'MONTH' },
            carry_forward: { type: 'boolean', example: false },
            deduct_salary: { type: 'boolean', example: false },
            max_duration_minutes: { type: 'number', example: 120 },
            half_day_allowed: { type: 'boolean', example: false },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' }
          }
        },
        LeaveBalance: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            leave_type_id: { type: 'string' },
            year: { type: 'number', example: 2026 },
            month: { type: 'number', example: 9 },
            opening: { type: 'number', example: 2 },
            accrued: { type: 'number', example: 0 },
            used: { type: 'number', example: 0 },
            pending: { type: 'number', example: 1 },
            available: { type: 'number', example: 1 }
          }
        },
        LeaveRequest: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user_id: { type: 'string' },
            leave_type_id: { type: 'string' },
            from_date: { type: 'string', example: '25/09/2026' },
            to_date: { type: 'string', example: '26/09/2026' },
            day_part: { type: 'string', enum: ['FULL', 'FIRST_HALF', 'SECOND_HALF', 'SHORT'] },
            from_time: { type: 'string', example: '10:00' },
            to_time: { type: 'string', example: '11:30' },
            days: { type: 'number', example: 2 },
            reason: { type: 'string', example: 'Family personal function' },
            status: { type: 'string', enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'] },
            approvals_needed: { type: 'number', example: 2 },
            approvals_done: { type: 'number', example: 1 }
          }
        },
        LeaveLedger: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user_id: { type: 'string' },
            leave_type_id: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            txn_type: { type: 'string', enum: ['ACCRUAL', 'USED', 'LAPSED', 'ADJUSTED', 'RELEASED'] },
            qty: { type: 'number', example: -1 },
            remarks: { type: 'string' }
          }
        },
        ApprovalMatrix: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef999' },
            requester_type: { type: 'string', enum: ['USER', 'DEPARTMENT', 'ROLE'], example: 'DEPARTMENT' },
            requester_ref: { type: 'string', example: '66ebc1234567890abcdef102' },
            module: { type: 'string', enum: ['LEAVE', 'REGULARIZATION'], example: 'LEAVE' },
            level_no: { type: 'integer', example: 1 },
            approvers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  approver_type: { type: 'string', enum: ['USER', 'ROLE'], example: 'ROLE' },
                  approver_ref: { type: 'string', example: '66ebc1234567890abcdef101' }
                }
              }
            },
            rule: { type: 'string', enum: ['ALL', 'ANY'], example: 'ALL' },
            is_active: { type: 'boolean', example: true },
            is_locked: { type: 'boolean', example: false }
          }
        },
        SalaryComponent: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef201' },
            name: { type: 'string', example: 'House Rent Allowance (HRA)' },
            type: { type: 'string', enum: ['EARNING', 'DEDUCTION'], example: 'EARNING' },
            calc_type: { type: 'string', enum: ['FIXED', 'PERCENT_OF_BASIC', 'FORMULA'], example: 'PERCENT_OF_BASIC' },
            value: { type: 'number', example: 40 },
            taxable: { type: 'boolean', example: true },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' }
          }
        },
        EmployeeSalaryStructure: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef301' },
            user_id: { type: 'string' },
            effective_from: { type: 'string', format: 'date-time' },
            basic: { type: 'number', example: 35000 },
            components: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  component_id: { type: 'string' },
                  value: { type: 'number', example: 40 }
                }
              }
            },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' }
          }
        },
        PayrollCycle: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef401' },
            month: { type: 'integer', example: 9 },
            year: { type: 'integer', example: 2026 },
            from_date: { type: 'string', example: '01/09/2026' },
            to_date: { type: 'string', example: '30/09/2026' },
            cut_off: { type: 'string', example: '25/09/2026' },
            pay_date: { type: 'string', example: '01/10/2026' },
            total_days: { type: 'integer', example: 30 }
          }
        },
        PayrollRun: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef501' },
            cycle_id: { type: 'string' },
            user_id: { type: 'string' },
            structure_id: { type: 'string' },
            absent_days: { type: 'number', example: 1 },
            unpaid_leave_days: { type: 'number', example: 0 },
            late_deduction_days: { type: 'number', example: 1 },
            lop_days: { type: 'number', example: 2 },
            payable_days: { type: 'number', example: 24 },
            short_leaves_used: { type: 'number', example: 1 },
            late_marks_used: { type: 'number', example: 5 },
            gross: { type: 'number', example: 48000 },
            net_pay: { type: 'number', example: 46000 },
            status: { type: 'string', enum: ['Draft', 'Processed', 'Approved', 'Released', 'Paid'], example: 'Processed' },
            bank_advice_ref: { type: 'string', example: 'HDFC-ADV-2026-09-001' }
          }
        },
        NotificationTemplate: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef101' },
            event: { type: 'string', example: 'LEAVE_APPROVED' },
            channel: { type: 'string', enum: ['EMAIL', 'IN_APP'], example: 'IN_APP' },
            subject: { type: 'string', example: 'Leave Request Approved: {{leave_type}}' },
            body: { type: 'string', example: 'Your leave application for {{days}} day(s) is approved.' },
            status: { type: 'string', enum: ['Active', 'Inactive'], example: 'Active' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '66ebc1234567890abcdef102' },
            user_id: { type: 'string', example: '66ebc1234567890abcdef103' },
            event: { type: 'string', example: 'LEAVE_APPROVED' },
            channel: { type: 'string', enum: ['EMAIL', 'IN_APP'], example: 'IN_APP' },
            title: { type: 'string', example: 'Leave Request Approved: Casual Leave' },
            body: { type: 'string', example: 'Your leave application for 2 day(s) is approved.' },
            is_read: { type: 'boolean', example: false },
            delivery_status: { type: 'string', enum: ['QUEUED', 'SENT', 'FAILED', 'N/A'], example: 'N/A' },
            ref_id: { type: 'string', example: '66ebc1234567890abcdef104' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJsDoc(options);

const setupSwagger = (app) => {
  // Custom CSS for modern dark/light UI aesthetic
  const customCss = `
    .swagger-ui .topbar { background-color: #1e293b; }
    .swagger-ui .topbar .topbar-wrapper img { content: url('https://img.icons8.com/color/96/briefcase.png'); width: 40px; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .btn.authorize { background-color: #0284c7; color: #fff; border-color: #0284c7; }
  `;

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss,
      customSiteTitle: 'NexAlliance HRM - API Docs',
      customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui.min.css',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.11.0/swagger-ui-standalone-preset.js'
      ]
    })
  );

  // Serve swagger spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};

module.exports = setupSwagger;
