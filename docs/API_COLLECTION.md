# NexAlliance HRM - API Collection & Cheat-Sheet

## 🔑 Authentication
Include the Bearer token in the `Authorization` header for all protected requests:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. Authentication APIs

### 1.1 Login
- **URL:** `POST /api/auth/login`
- **Body:**
```json
{
  "email": "admin@nexalliance.com",
  "password": "Admin@12345"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "66ebc1234567890abcdef123",
    "employee_code": "NEX-0001",
    "name": "Super Administrator",
    "email": "admin@nexalliance.com",
    "attendance_exempt": true
  }
}
```

### 1.2 Get Current User
- **URL:** `GET /api/auth/me`

### 1.3 Get My Resolved Permissions
- **URL:** `GET /api/auth/me/permissions`

---

## 2. Organization Masters APIs

### 2.1 Departments
- `GET /api/departments` (Query: `?status=Active`)
- `GET /api/departments/:id`
- `POST /api/departments`
```json
{
  "name": "Human Resources",
  "code": "HR"
}
```
- `PUT /api/departments/:id`
- `DELETE /api/departments/:id` (Soft-delete)

### 2.2 Designations
- `GET /api/designations` (Query: `?department_id=&status=Active`)
- `POST /api/designations`
```json
{
  "name": "Senior Software Engineer",
  "code": "SSE",
  "department_id": "66ebc1234567890abcdef102",
  "level": 2
}
```

### 2.3 Branches
- `GET /api/branches`
- `POST /api/branches`
```json
{
  "name": "NexAlliance HQ - Surat",
  "address": "Ring Road, Surat, Gujarat",
  "latitude": 21.1702,
  "longitude": 72.8311,
  "radius_m": 200,
  "timezone": "Asia/Kolkata"
}
```

---

## 3. Employee Master APIs

### 3.1 Create Employee (Super Admin only)
- **URL:** `POST /api/employees`
- **Body:**
```json
{
  "employee_code": "EMP-1002",
  "name": "Rahul Patel",
  "email": "rahul.patel@nexalliance.com",
  "password": "Employee@123",
  "role_id": "66ebc1234567890abcdef101",
  "department_id": "66ebc1234567890abcdef102",
  "designation_id": "66ebc1234567890abcdef103",
  "branch_id": "66ebc1234567890abcdef104",
  "phone": "+91 9876543210",
  "address": "Surat, Gujarat",
  "emergency_contact": "+91 9876543200",
  "bank_details": {
    "account_holder_name": "Rahul Patel",
    "account_number": "123456789012",
    "bank_name": "HDFC Bank",
    "ifsc_code": "HDFC0001234",
    "branch_name": "Ring Road Branch",
    "upi_id": "rahul@okhdfcbank"
  },
  "identity_documents": {
    "aadhar_number": "1234 5678 9012",
    "pan_number": "ABCDE1234F"
  },
  "education_documents": {
    "tenth_marksheet_url": "/uploads/documents/10th.pdf",
    "twelfth_marksheet_url": "/uploads/documents/12th.pdf",
    "diploma_marksheet_url": "/uploads/documents/diploma.pdf",
    "graduation_certificate_url": "/uploads/documents/degree.pdf"
  }
}
```

### 3.2 Upload Employee Documents (Multipart)
- **URL:** `POST /api/employees/:id/upload-documents`
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `photo` (File)
  - `aadhar_card` (File)
  - `pan_card` (File)
  - `tenth_marksheet` (File)
  - `twelfth_marksheet` (File)
  - `diploma_marksheet` (File)
  - `graduation_certificate` (File)

### 3.3 Update Employee
- **URL:** `PUT /api/employees/:id`

### 3.4 Get Employee Profile
- **URL:** `GET /api/employees/:id`

### 3.5 List Employees
- **URL:** `GET /api/employees?search=Rahul&department_id=&status=Active`

---

## 4. Role Master & Permission Matrix APIs

### 4.1 Get Roles
- `GET /api/roles`

### 4.2 Get Permission Matrix for Role
- `GET /api/permission-matrix/:roleId`

### 4.3 Update Permission Matrix
- `PUT /api/permission-matrix/:roleId`
```json
{
  "permissions": [
    {
      "permission_id": "66ebc1234567890abcdef201",
      "allowed": true,
      "scope": "DEPT"
    }
  ]
}
```

---

## 5. Audit Log APIs

### 5.1 Query Audit Logs (Super Admin only)
- `GET /api/audit-logs?module=EMPLOYEE&action=CREATE&page=1&limit=20`

---

## 6. Module 2: Attendance Engine APIs

### 6.1 Clock-In (Employee / CEO / CTO)
- **URL:** `POST /api/attendance/clock-in`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "lat": 21.1702,
  "lng": 72.8311,
  "source": "WEB",
  "device_info": "Chrome on Windows 11"
}
```

### 6.2 Clock-Out (Employee / CEO / CTO)
- **URL:** `POST /api/attendance/clock-out`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "lat": 21.1702,
  "lng": 72.8311,
  "source": "WEB"
}
```

### 6.3 Get Daily Attendance Records
- **URL:** `GET /api/attendance?from=01/09/2026&to=30/09/2026&status=Present&page=1&limit=31`
- **Scope Enforced:** `ALL` (Super Admin/CEO/CTO), `DEPT` (Manager), `OWN` (Employee)

### 6.4 Get Monthly Late Counter & LOP Deduction Summary
- **URL:** `GET /api/attendance/late-summary?year=2026&month=9`
- **URL (Admin querying employee):** `GET /api/attendance/late-summary?user_id=<emp_id>&year=2026&month=9`

### 6.5 Export Attendance (Super Admin / CEO / CTO)
- **URL:** `GET /api/attendance/export?from=01/09/2026&to=30/09/2026&format=csv`

### 6.6 Manual Admin Edit Attendance (Super Admin only)
- **URL:** `PUT /api/attendance/:userId/:date` (date in `DD/MM/YYYY` format)
- **Body:**
```json
{
  "status": "Present",
  "is_late": false,
  "remarks": "Approved Transport Delay Waiver"
}
```

### 6.7 Trigger End-of-Day Reconciliation Job (Super Admin only)
- **URL:** `POST /api/attendance/run-daily-job`
- **Body:**
```json
{
  "date": "19/09/2026"
}
```

### 6.8 Shift Master CRUD (Super Admin only)
- `GET /api/shifts`
- `GET /api/shifts/:id`
- `POST /api/shifts`
- `PUT /api/shifts/:id`
- `DELETE /api/shifts/:id`

### 6.9 Holiday Calendar Master CRUD (Super Admin only)
- `GET /api/holidays?year=2026`
- `GET /api/holidays/:id`
- `POST /api/holidays`
- `PUT /api/holidays/:id`
- `DELETE /api/holidays/:id`

---

## 7. Module 3: Regularization APIs

### 7.1 Regularization Reasons (Master)
- `GET /api/regularization-reasons` (All authenticated users)
- `GET /api/regularization-reasons/:id`
- `POST /api/regularization-reasons` (Super Admin only)
- `PUT /api/regularization-reasons/:id` (Super Admin only)
- `DELETE /api/regularization-reasons/:id` (Super Admin only)

### 7.2 Apply for Regularization (Employee / CEO / CTO)
- **URL:** `POST /api/regularizations`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "date": "15/09/2026",
  "req_in": "2026-09-15T04:30:00.000Z",
  "req_out": "2026-09-15T13:00:00.000Z",
  "reason_id": "66ebc1234567890abcdef123",
  "remark": "Biometric device offline"
}
```

### 7.3 List Regularization Requests
- **URL:** `GET /api/regularizations?status=Pending&from=01/09/2026&to=30/09/2026&page=1&limit=20`
- **Scope Enforced:** `ALL` (Super Admin, CEO, CTO), `OWN` (Employee)

### 7.4 Get Regularization Request Details (with Attendance Context)
- **URL:** `GET /api/regularizations/:id`

### 7.5 Approve Regularization Request (Super Admin ONLY)
- **URL:** `PUT /api/regularizations/:id/approve`
- **Method:** `PUT`
- **Body (Optional):**
```json
{
  "decision_remark": "Approved after verification"
}
```

### 7.6 Reject Regularization Request (Super Admin ONLY)
- **URL:** `PUT /api/regularizations/:id/reject`
- **Method:** `PUT`
- **Body (Mandatory):**
```json
{
  "decision_remark": "Attendance punch records show unapproved absence"
}
```

### 7.7 Cancel Regularization Request (Requester ONLY, Pending ONLY)
- **URL:** `PUT /api/regularizations/:id/cancel`
- **Method:** `PUT`

---

## 8. Module 4: Leave Management APIs

### 8.1 Leave Types Master
- `GET /api/leave-types` (All authenticated users)
- `GET /api/leave-types/:id`
- `POST /api/leave-types` (Super Admin only)
- `PUT /api/leave-types/:id` (Super Admin only)
- `DELETE /api/leave-types/:id` (Super Admin only)

### 8.2 Get Leave Balances
- **URL:** `GET /api/leaves/balance?year=2026&month=9`
- **Scope Enforced:** `ALL` (Super Admin/CEO/CTO), `OWN` (Employee)

### 8.3 Apply for Leave (Employee / CEO / CTO)
- **URL:** `POST /api/leaves`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <token>`
- **Body (Full Day):**
```json
{
  "leave_type_id": "66ebc1234567890abcdef101",
  "from_date": "25/09/2026",
  "to_date": "26/09/2026",
  "day_part": "FULL",
  "reason": "Family vacation"
}
```
- **Body (Short Leave - Max 2 hours / 2 per month):**
```json
{
  "leave_type_id": "66ebc1234567890abcdef102",
  "from_date": "24/09/2026",
  "to_date": "24/09/2026",
  "day_part": "SHORT",
  "from_time": "10:00",
  "to_time": "11:30",
  "reason": "Morning dental checkup"
}
```

### 8.4 List Leave Requests
- **URL:** `GET /api/leaves?status=Pending&page=1&limit=20`
- **Scope Enforced:** `ALL` (Super Admin/CEO/CTO), `OWN` (Employee)

### 8.5 Get Leave Request Details
- **URL:** `GET /api/leaves/:id`

### 8.6 Approve Leave Request (Dual CEO+CTO Approvers & Super Admin Override)
- **URL:** `PUT /api/leaves/:id/approve`
- **Method:** `PUT`
- **Body (Optional):**
```json
{
  "remark": "Approved"
}
```

### 8.7 Reject Leave Request (Immediate circuit breaker on single reject)
- **URL:** `PUT /api/leaves/:id/reject`
- **Method:** `PUT`
- **Body (Mandatory):**
```json
{
  "decision_remark": "Critical release scheduled on these dates"
}
```

### 8.8 Cancel Leave Request
- **URL:** `PUT /api/leaves/:id/cancel`
- **Method:** `PUT`
- **Access:** Requester (Pending or future Approved), Super Admin (Past Approved)

### 8.9 Manual Balance Adjustment (Super Admin only)
- **URL:** `POST /api/leaves/adjust-balance`
- **Method:** `POST`
- **Body:**
```json
{
  "user_id": "66ebc1234567890abcdef789",
  "leave_type_id": "66ebc1234567890abcdef101",
  "year": 2026,
  "qty": 2,
  "reason": "Compensatory off for weekend server maintenance"
}
```

### 8.10 Super Admin Emergency Override (Leave Decision)
- **URL:** `PUT /api/leaves/:id/override-decision`
- **Method:** `PUT`
- **Access:** `SUPER_ADMIN` ONLY
- **Body (Mandatory):**
```json
{
  "decision": "APPROVED",
  "reason": "Executive emergency absence override"
}
```

---

## 9. Module 5: Approval & Reporting Matrix APIs

### 9.1 View Approval Matrix Mappings
- **URL:** `GET /api/approval-matrix?module=LEAVE`
- **Access:** `SUPER_ADMIN`, `CEO`, `CTO` (`ALL` view). `EMPLOYEE` $\rightarrow$ `403 Forbidden`.

### 9.2 Create Approval Matrix Mapping (Super Admin only)
- **URL:** `POST /api/approval-matrix`
- **Method:** `POST`
- **Body:**
```json
{
  "requester_type": "DEPARTMENT",
  "requester_ref": "66ebc1234567890abcdef102",
  "module": "LEAVE",
  "level_no": 1,
  "rule": "ALL",
  "approvers": [
    { "approver_type": "USER", "approver_ref": "66ebc1234567890abcdef103" }
  ]
}
```
*Note: `module: 'REGULARIZATION'` is blocked with `400 Bad Request`.*

### 9.3 Update Approval Matrix Mapping (Super Admin only)
- **URL:** `PUT /api/approval-matrix/:id`
- **Method:** `PUT`
- *Note: `is_locked: true` rows are protected with `400 Bad Request`.*

### 9.4 Soft Deactivate Approval Matrix Mapping (Super Admin only)
- **URL:** `DELETE /api/approval-matrix/:id`
- **Method:** `DELETE`

### 9.5 Get My Pending Approvals Queue
- **URL:** `GET /api/approvals/pending-for-me`
- **Access:** Any authenticated user
- **Description:** Returns pending leave requests specifically assigned to the logged-in approver.

---

## 10. Module 6: Payroll Management APIs

### 10.1 Salary Components Master
- `GET /api/salary-components`: List active components (`PAYROLL:VIEW`).
- `POST /api/salary-components`: Create salary component (`PAYROLL:EDIT_STRUCTURE` - Admin).
```json
{
  "name": "House Rent Allowance (HRA)",
  "code": "HRA",
  "type": "EARNING",
  "calc_type": "PERCENT_OF_BASIC",
  "value": 40,
  "taxable": true
}
```
- `PUT /api/salary-components/:id`: Update component (`PAYROLL:EDIT_STRUCTURE` - Admin).
- `DELETE /api/salary-components/:id`: Soft delete component (`PAYROLL:EDIT_STRUCTURE` - Admin).

### 10.2 Employee Salary Structure Versioning
- `GET /api/employees/:userId/salary-structure`: View salary structure history (`PAYROLL:VIEW` - OWN / ALL).
- `POST /api/employees/:userId/salary-structure`: Assign new version (`PAYROLL:EDIT_STRUCTURE` - Admin).
```json
{
  "effective_from": "2026-04-01",
  "basic": 40000,
  "components": [
    { "component_id": "66ebc1234567890abcdef101", "value": 40 },
    { "component_id": "66ebc1234567890abcdef102", "value": 2000 }
  ]
}
```

### 10.3 Payroll Cycles & Lifecycle Engine
- `GET /api/payroll/cycles`: List all payroll cycles (`PAYROLL:VIEW`).
- `POST /api/payroll/cycles`: Create payroll cycle (`PAYROLL:PROCESS` - Admin).
```json
{
  "name": "March 2026 Payroll",
  "month": 3,
  "year": 2026,
  "from_date": "2026-03-01",
  "to_date": "2026-03-31",
  "cut_off": "2026-03-25",
  "pay_date": "2026-04-01",
  "total_days": 26
}
```
- `POST /api/payroll/process`: Process batch payroll for a cycle (`PAYROLL:PROCESS` - Admin).
```json
{
  "cycle_id": "66ebc1234567890abcdef105"
}
```
- `GET /api/payroll/:cycleId/runs`: View all employee runs for a cycle (`PAYROLL:VIEW`).
- `POST /api/payroll/:cycleId/approve`: Approve payroll runs (`PAYROLL:APPROVE` - CEO / CTO / Admin).
- `POST /api/payroll/:cycleId/release`: Release payslips to employees (`PAYROLL:RELEASE` - Admin).
- `POST /api/payroll/:cycleId/mark-paid`: Disburse & mark paid with bank advice (`PAYROLL:MARK_PAID` - Admin).
```json
{
  "bank_advice_ref": "NEFT-20260331-0099"
}
```
- `POST /api/payroll/:cycleId/reopen`: Reopen locked month (`PAYROLL:REOPEN` - Super Admin only).
```json
{
  "reason": "Late regularization adjustments approved after initial review"
}
```

### 10.4 Payslips & PDF Generation
- `GET /api/payslips/:runId`: View summary JSON (`PAYROLL:VIEW` - OWN / ALL, gate: `Released` or `Paid`).
- `GET /api/payslips/:runId/pdf`: Download print-ready PDF binary (`PAYROLL:VIEW` - OWN / ALL, gate: `Released` or `Paid`).

---

## 11. Module 7: Notifications & Communication APIs

### 11.1 Notification Template Master (Super Admin only)
- `GET /api/notification-templates`: List all notification templates (query: `channel`, `status`, `event`).
- `POST /api/notification-templates`: Create a new template.
```json
{
  "event": "CUSTOM_ANNOUNCEMENT",
  "channel": "IN_APP",
  "body": "Important announcement for {{employee_name}}: {{message}}",
  "status": "Active"
}
```
- `PUT /api/notification-templates/:id`: Update subject, body, status.
```json
{
  "subject": "Updated Email Subject: {{employee_name}}",
  "body": "Updated template body with {{placeholders}}",
  "status": "Active"
}
```
- `DELETE /api/notification-templates/:id`: Soft delete / deactivation.

### 11.2 In-App Notifications Inbox (Self-scoped for all roles)
- `GET /api/notifications`: Retrieve in-app notifications inbox for logged-in user (query: `is_read`, `channel`, `page`, `limit`).
- `GET /api/notifications/unread-count`: Get unread in-app notification count (`{ "success": true, "unread_count": 3 }`).
- `PUT /api/notifications/:id/mark-read`: Mark single notification as read.
- `PUT /api/notifications/mark-all-read`: Mark all unread in-app notifications as read for logged-in user.

### 11.3 Support & Troubleshooting Log Viewer (Super Admin only)
- `GET /api/notifications/user/:userId`: View all dispatched notification logs (IN_APP & EMAIL) for a specific user.


