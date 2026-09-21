# NexAlliance HRM System - Module 9: Reports & Dashboard APIs

## Overview & Architecture

**Module 9: Reports & Dashboard APIs** is the terminal, read-only analytics and aggregation layer across Modules 1 to 8. It introduces no new primary collections and performs zero mutations, delivering role-tailored dashboards and company-wide reports across Attendance, Leave, Payroll, Approvals, and System Audit logs.

```
+-----------------------------------------------------------------------------+
|               MODULE 9: REPORTS & DASHBOARD AGGREGATION LAYER               |
+-----------------------------------------------------------------------------+
|                                                                             |
|  1. Universal Role-Tailored Dashboard (GET /api/dashboard)                  |
|     - Super Admin: Pending approvals (leave, reg, sensitive), payroll       |
|       status breakdown, recent 20 audit logs, active employee count         |
|     - CEO / CTO: Pending approvals for me (unified multi-module), today's   |
|       team attendance breakdown, payroll runs pending approval              |
|     - Employee: Own leave balance summary, late marks this month (2 of 3),  |
|       own pending requests, unread in-app notifications                     |
|                                                                             |
|  2. Attendance Summary Reports (JSON & CSV Export)                          |
|     - Date range, branch, department, and user filterable                   |
|     - Aggregates Present, Absent, Half Day, Leave, Holiday, Week Off, Late  |
|                                                                             |
|  3. Leave Management Analytics                                              |
|     - Leave Balance Report: Balance breakdown by year, month, department    |
|     - Leave Ledger Report: Full credit/debit transaction history            |
|     - Leave Utilization Report: Quota vs Used utilization percentage        |
|     - Short Leave Usage Report: Monthly application count and minutes       |
|                                                                             |
|  4. Payroll & Statutory Reports                                             |
|     - Loss of Pay (LOP) Report: Absent, unpaid leave, late deduction days   |
|     - Payroll Register (JSON & CSV): Company-wide gross, deductions, net    |
|                                                                             |
|  5. System Audit Analytics                                                  |
|     - Audit Summary Report: Module and action breakdown with recent logs    |
|                                                                             |
|  6. Role Access Gates: Strict 403 Forbidden for Employee on all /reports/*  |
+-----------------------------------------------------------------------------+
```

---

## Aggregation Engine (`utils/reportAggregations.js`)

Pure, reusable aggregation functions operating over existing transactional collections:
- `aggregateAttendanceSummary({ from, to, branch_id, department_id, user_id })`: Aggregates `AttendanceDaily` records and calculates per-employee attendance totals.
- `aggregateLeaveBalanceSummary({ year, month, department_id })`: Aggregates `LeaveBalance` records across employees and active leave types.
- `aggregateLeaveLedgerReport({ user_id, leave_type_id, from, to })`: Queries `LeaveLedger` with transaction details.
- `aggregateLeaveUtilization({ year, department_id })`: Calculates quota allocation vs consumption percentage.
- `aggregateShortLeaveUsage({ year, month, department_id })`: Groups short leave approvals and calculates total duration minutes.
- `aggregateLopReport({ cycle_id })`: Aggregates `PayrollRun` LOP days, absent days, and late deduction days.
- `aggregatePayrollRegister({ cycle_id })`: Produces complete payroll register table with earnings, deductions, and net pay.
- `aggregateAuditSummary({ from, to, module })`: Analyzes system audit logs with module and action distribution.
- `aggregateDashboardCounts(user)`: Returns single-load role-tailored dashboard payload.

---

## API Endpoints

### 1. Dashboard (`/api/dashboard`)
- `GET /api/dashboard`: Universal authenticated dashboard endpoint returning role-tailored metrics.

### 2. Attendance Reports (`/api/reports`)
- `GET /api/reports/attendance`: Attendance summary report (Super Admin / CEO / CTO).
- `GET /api/reports/attendance/export`: Attendance report CSV download (Super Admin / CEO / CTO).

### 3. Leave Management Reports (`/api/reports`)
- `GET /api/reports/leave-balance`: Employee leave balances by year, month, and department.
- `GET /api/reports/leave-ledger`: Detailed credit/debit leave ledger transactions.
- `GET /api/reports/leave-utilization`: Quota utilization percentages per leave type.
- `GET /api/reports/short-leave-usage`: Monthly short leave frequency and duration per employee.

### 4. Payroll Reports (`/api/reports`)
- `GET /api/reports/lop`: Loss of Pay (LOP) and unpaid leave breakdown per employee.
- `GET /api/reports/payroll-register`: Complete company-wide payroll register (JSON).
- `GET /api/reports/payroll-register/export`: Downloadable payroll register (CSV).

### 5. Audit Analytics (`/api/reports`)
- `GET /api/reports/audit-summary`: System-wide audit log summary and distribution (Super Admin only).

---

## Role Access Rules

| Route Category | Super Admin | CEO / CTO | Employee |
|---|---|---|---|
| Universal Dashboard (`GET /api/dashboard`) | Super Admin Payload | CEO/CTO Payload | Employee Own Payload |
| Attendance Reports & CSV Export | Full Access | Full Access | 403 Forbidden |
| Leave Balance & Utilization Reports | Full Access | Full Access | 403 Forbidden |
| Short Leave Usage & Ledger Reports | Full Access | Full Access | 403 Forbidden |
| LOP & Payroll Register Reports | Full Access | Full Access | 403 Forbidden |
| Audit Summary Report | Full Access | 403 Forbidden | 403 Forbidden |
