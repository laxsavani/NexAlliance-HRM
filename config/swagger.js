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
