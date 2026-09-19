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
