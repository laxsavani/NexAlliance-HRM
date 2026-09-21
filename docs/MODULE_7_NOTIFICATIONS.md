# NexAlliance HRM System - Module 7: Notifications & Communication Engine

## Overview & Architecture

The **Notification & Communication Engine** is a template-driven dispatch layer delivering In-App notifications and queuing Email dispatches for all system lifecycle events. It connects directly to the forward-hook stubs left by earlier modules (`queueRegularizationEmail`, `queueLeaveEmail`, `queuePayslipEmail`), manages self-scoped inboxes for all users, provides Super Admin template management, and includes a scheduled pending-leave reminder job.

```
+-----------------------------------------------------------------------------+
|                     MODULE 7: NOTIFICATIONS & DISPATCH ENGINE               |
+-----------------------------------------------------------------------------+
|                                                                             |
|  1. Notification Template Master                                            |
|     (event, channel: EMAIL | IN_APP, subject, body, status: Active|Inactive)|
|                                                                             |
|  2. Event Dispatcher: sendNotification(userId, eventCode, context, refId)    |
|     - Queries active templates for eventCode                                |
|     - Resolves {{placeholder}} tokens (fails gracefully to "" on missing)   |
|     - Generates IN_APP (unread inbox) and EMAIL (QUEUED) records            |
|     - Silently skips when zero active templates exist (never throws)        |
|                                                                             |
|  3. System Forward Hooks Implemented                                        |
|     - Module 3: REGULARIZATION_APPROVED, REGULARIZATION_REJECTED            |
|     - Module 4: LEAVE_APPLIED (approvers), LEAVE_FIRST_APPROVAL (requester),|
|                 LEAVE_APPROVED (requester), LEAVE_REJECTED (requester),     |
|                 LEAVE_CANCELLED_NOTICE (approvers)                          |
|     - Module 6: PAYSLIP_RELEASED (employee)                                 |
|     - Periodic Job: LEAVE_PENDING_REMINDER (unresolved approvers)           |
|                                                                             |
|  4. In-App Notification Inbox (Self-Scoped)                                 |
|     (GET /api/notifications, GET /unread-count, PUT /mark-read, mark-all)   |
|                                                                             |
|  5. Super Admin Support Log Viewer                                          |
|     (GET /api/notifications/user/:userId - Troubleshooting access)           |
+-----------------------------------------------------------------------------+
```

---

## Catalog of Seeded Default Events (18 Templates)

| Event Code | Channel | Default Subject / Title | Recipient |
|---|---|---|---|
| `REGULARIZATION_APPROVED` | `EMAIL`, `IN_APP` | Attendance Regularization Approved for `{{date}}` | Requester |
| `REGULARIZATION_REJECTED` | `EMAIL`, `IN_APP` | Attendance Regularization Rejected for `{{date}}` | Requester |
| `LEAVE_APPLIED` | `EMAIL`, `IN_APP` | New Leave Application: `{{employee_name}}` (`{{leave_type}}`) | Assigned Approvers |
| `LEAVE_FIRST_APPROVAL` | `EMAIL`, `IN_APP` | Leave Request Partially Approved (`{{approvals_done}}`/`{{approvals_needed}}`) | Requester |
| `LEAVE_APPROVED` | `EMAIL`, `IN_APP` | Leave Request Approved: `{{leave_type}}` (`{{from_date}}` to `{{to_date}}`) | Requester |
| `LEAVE_REJECTED` | `EMAIL`, `IN_APP` | Leave Request Rejected: `{{leave_type}}` | Requester |
| `LEAVE_CANCELLED_NOTICE` | `EMAIL`, `IN_APP` | Notice: Leave Cancelled by `{{employee_name}}` | Assigned Approvers |
| `PAYSLIP_RELEASED` | `EMAIL`, `IN_APP` | Payslip Released for `{{month}}`/`{{year}}` | Employee |
| `LEAVE_PENDING_REMINDER` | `EMAIL`, `IN_APP` | Reminder: Pending Leave Approval for `{{employee_name}}` | Unresolved Approvers |

---

## Data Models

### 1. `NotificationTemplate` (`models/NotificationTemplate.js`)
| Field | Type | Description |
|---|---|---|
| `event` | String | Event code (e.g. `'LEAVE_APPROVED'`) |
| `channel` | Enum | `'EMAIL'` \| `'IN_APP'` |
| `subject` | String | Email subject line (ignored for `IN_APP`) |
| `body` | String | Template text supporting `{{placeholder}}` tokens |
| `status` | Enum | `'Active'` \| `'Inactive'` (deactivation mutes that channel) |

*Index: `{ event: 1, channel: 1 }` (unique).*

### 2. `Notification` (`models/Notification.js`)
| Field | Type | Description |
|---|---|---|
| `user_id` | ObjectId | Ref to `User` |
| `event` | String | Triggering event code |
| `channel` | Enum | `'EMAIL'` \| `'IN_APP'` |
| `title` | String | Resolved subject or event title |
| `body` | String | Resolved notification text |
| `is_read` | Boolean | Read state for in-app inbox (default: `false`) |
| `delivery_status` | Enum | `'QUEUED'` \| `'SENT'` \| `'FAILED'` \| `'N/A'` |
| `ref_id` | ObjectId | Reference to `LeaveRequest` / `RegularizationRequest` / `PayrollRun` |

*Index: `{ user_id: 1, channel: 1, is_read: 1, createdAt: -1 }`.*

---

## API Endpoints

### 1. Notification Template Master (`/api/notification-templates`)
- `GET /api/notification-templates`: List templates (Super Admin only).
- `POST /api/notification-templates`: Create new template (Super Admin only).
- `PUT /api/notification-templates/:id`: Update template subject, body, status (Super Admin only).
- `DELETE /api/notification-templates/:id`: Soft delete / deactivation (Super Admin only).

### 2. In-App Notification Inbox (`/api/notifications`)
- `GET /api/notifications`: Retrieve current user's in-app inbox (`req.user.id` only, query: `is_read`, `channel`, `page`, `limit`).
- `GET /api/notifications/unread-count`: Get unread count for badge display (`{ unread_count: N }`).
- `PUT /api/notifications/:id/mark-read`: Mark single notification as read (owner verified).
- `PUT /api/notifications/mark-all-read`: Mark all unread in-app notifications as read for current user.

### 3. Support & Troubleshooting View
- `GET /api/notifications/user/:userId`: Super Admin only inspection of user's notifications.

---

## Automated Verification & Test Results

Run the automated test suite:
```bash
node scripts/test_module7.js
```

### Test Results:
- **10/10 Stages Passed**:
  1. Super Admin, CEO, CTO, and Employee Authentication.
  2. Notification Template Master CRUD & Permission Access Control.
  3. Dispatcher `sendNotification()` placeholder resolution & unconfigured event graceful bypass.
  4. Module 3 Regularization trigger integration (`REGULARIZATION_APPROVED`).
  5. Module 4 Leave 4-point notification flow (`LEAVE_APPLIED` to approvers, `LEAVE_FIRST_APPROVAL`, `LEAVE_APPROVED`, `LEAVE_CANCELLED_NOTICE`).
  6. Module 6 Payroll release trigger integration (`PAYSLIP_RELEASED`).
  7. In-App inbox self-scoping (`unread-count`, `mark-read`, `mark-all-read`).
  8. Template deactivation mute behavior (zero records generated when inactive).
  9. Threshold-based pending request reminder job.
  10. Super Admin support troubleshooting viewer.
