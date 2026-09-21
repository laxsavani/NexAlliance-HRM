# NexAlliance HRM System - Module 8: Security & System Hardening

## Overview & Architecture

**Module 8: Security & System Hardening** provides cross-cutting security, data protection, authentication hardening, and audit trail automation across all modules in the NexAlliance HRM system without adding disjoint business workflows.

```
+-----------------------------------------------------------------------------+
|                MODULE 8: SECURITY & SYSTEM HARDENING LAYER                  |
+-----------------------------------------------------------------------------+
|                                                                             |
|  1. AES-256-GCM Data Encryption & Serialization Masking                     |
|     - Application-level encryption for Bank Account, PAN, and Aadhaar        |
|     - Automatic response masking in User.toJSON() (e.g. XXXXXXXX5566)       |
|     - Dedicated Super Admin Unmask route with mandatory SENSITIVE_VIEW audit|
|                                                                             |
|  2. Sensitive Change Approval Workflow                                      |
|     - Non-super admins editing sensitive fields create Pending requests     |
|     - Super Admin approval commits encrypted update to User record          |
|                                                                             |
|  3. Authentication Security & Brute-Force Lockout                           |
|     - LoginAttempt tracking per email + IP                                  |
|     - 5 failed login attempts in 15 mins -> 15 min lockout (HTTP 423)       |
|     - Timing-safe: Lockout evaluated before password hashing comparison     |
|                                                                             |
|  4. Optional Super Admin 2FA (RFC 6238 TOTP) & Refresh Tokens               |
|     - 2FA setup & verification with standard 6-digit TOTP authenticator     |
|     - JWT refresh token rotation for secure session extension               |
|                                                                             |
|  5. Global Deduplicating Audit Middleware (auditWrapper)                    |
|     - Intercepts mutating requests (POST, PUT, PATCH, DELETE)               |
|     - Automatic capture of IP, User Agent, before/after snapshots           |
|     - req._auditLogged guard prevents duplicate logging                     |
|                                                                             |
|  6. Rate Limiting Gateways                                                  |
|     - Login rate limit (20 req/min per IP)                                  |
|     - General API rate limit (100 req/min per IP)                           |
+-----------------------------------------------------------------------------+
```

---

## Data Models & Schema Extensions

### 1. `User` Schema Additions (`models/User.js`)
| Field | Type | Description |
|---|---|---|
| `bank_account_enc` | String | AES-256-GCM encrypted bank account ciphertext (`iv:authTag:cipher`) |
| `pan_enc` | String | AES-256-GCM encrypted PAN ciphertext |
| `aadhaar_enc` | String | AES-256-GCM encrypted Aadhaar ciphertext |
| `two_fa_enabled` | Boolean | Flag indicating if 2FA TOTP is required at login (default: `false`) |
| `two_fa_secret_enc` | String | AES-256-GCM encrypted TOTP base32 secret |
| `failed_login_count` | Number | Counter for consecutive failed login attempts (resets on success or lockout) |
| `locked_until` | Date | Timestamp until which the account is locked (returns HTTP 423) |

### 2. `LoginAttempt` (`models/LoginAttempt.js`)
| Field | Type | Description |
|---|---|---|
| `email` | String | Lowercased target user email |
| `ip` | String | Client IP address |
| `success` | Boolean | True for successful auth, False for failed/locked attempt |
| `attempted_at` | Date | Timestamp of attempt |

*Indexes: `{ email: 1, ip: 1, attempted_at: -1 }`, `{ attempted_at: -1 }`.*

### 3. `SensitiveChangeRequest` (`models/SensitiveChangeRequest.js`)
| Field | Type | Description |
|---|---|---|
| `user_id` | ObjectId | Ref to `User` requesting the update |
| `field` | Enum | `'bank_account'` \| `'pan'` \| `'aadhaar'` |
| `new_value_enc` | String | AES-256-GCM encrypted candidate value |
| `status` | Enum | `'Pending'` \| `'Approved'` \| `'Rejected'` |
| `decided_by` | ObjectId | Ref to Super Admin user |
| `decision_remark` | String | Approval or rejection remark |
| `decided_at` | Date | Decision timestamp |

*Indexes: `{ user_id: 1, status: 1 }`, `{ status: 1, createdAt: -1 }`.*

### 4. `AuditLog` Schema Additions (`models/AuditLog.js`)
| Field | Type | Description |
|---|---|---|
| `user_agent` | String | Client User-Agent header value |

---

## API Endpoints

### 1. Authentication & Security
- `POST /api/auth/login`: Login with rate limiting (20 req/min), lockout check (HTTP 423), and 2FA TOTP verification.
- `POST /api/auth/2fa/setup`: Generate TOTP secret and OTPAuth URI (Super Admin only).
- `POST /api/auth/2fa/verify`: Verify 6-digit TOTP code and enable 2FA on account (Super Admin only).
- `POST /api/auth/refresh-token`: Exchange refresh token for a new access token.

### 2. Sensitive Data & Change Approvals
- `PUT /api/employees/me/sensitive-field`: Submit a sensitive field change (`bank_account`, `pan`, `aadhaar`) creating a `Pending` request.
- `GET /api/sensitive-change-requests`: List sensitive change requests with status filter (Super Admin only).
- `PUT /api/sensitive-change-requests/:id/approve`: Approve request, decrypt value, update User record, and audit log (Super Admin only).
- `PUT /api/sensitive-change-requests/:id/reject`: Reject request with mandatory remark (Super Admin only).

### 3. Dedicated Unmask & Audit Inspection
- `GET /api/employees/:id/sensitive-fields/unmask`: Decrypts plaintext sensitive data and unconditionally creates `SENSITIVE_VIEW` AuditLog (Super Admin only).
- `GET /api/login-attempts`: Query login attempt logs with email and date range filters (Super Admin only).

---

## Role Access Rules

| Operation | Super Admin | CEO / CTO | Employee |
|---|---|---|---|
| Submit Sensitive Field Edit | Yes (routes to approval) | Yes (routes to approval) | Yes (routes to approval) |
| Approve / Reject Sensitive Request | Full Access | No (403) | No (403) |
| View Unmasked Sensitive Data | Full Access (Audited) | No (403) | No (403) |
| Setup & Verify 2FA | Full Access | No (403) | No (403) |
| View Login Attempt History | Full Access | No (403) | No (403) |
