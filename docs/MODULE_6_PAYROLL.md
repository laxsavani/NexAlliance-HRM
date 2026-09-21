# NexAlliance HRM System - Module 6: Payroll Management Engine

## Overview & Architecture

The **Payroll Management Engine** is a deterministic, financial-grade, read-only consumer of attendance and leave data. It handles everything from salary component definitions and versioned employee salary structures to automated Loss of Pay (LOP) computations, cycle state transitions (`Draft` $\rightarrow$ `Processed` $\rightarrow$ `Approved` $\rightarrow$ `Released` $\rightarrow$ `Paid`), locked month enforcement, and PDF payslip generation.

```
+-----------------------------------------------------------------------------+
|                               MODULE 6: PAYROLL                             |
+-----------------------------------------------------------------------------+
|                                                                             |
|  1. Salary Components Master                                                |
|     (Earnings / Deductions, Fixed / Percent of Basic / Formula, Taxable)     |
|                                                                             |
|  2. Employee Salary Structures                                              |
|     (Versioned with effective_from; Historical Resolution for past runs)    |
|                                                                             |
|  3. Read-Only Attendance & Leave Aggregation                                |
|     (Daily Attendance, Lates, Unpaid/Paid Leaves, Holidays, Join Date)      |
|                                                                             |
|  4. Deterministic LOP Calculation Engine                                    |
|     LOP Days = Absent + Unpaid Leave + Late Deductions (Lates > 3)          |
|     Payable Days = Total Cycle Days - LOP Days (Prorated for joiners)       |
|                                                                             |
|  5. Lifecycle State Machine                                                 |
|     [Draft] ---> [Processed] ---> [Approved] ---> [Released] ---> [Paid]    |
|                      ^                | (Month Locked)  | (Payslips Open)   |
|                      +--- Reopen <----+                 | (Email Trigger)   |
|                                                                             |
|  6. PDF Payslip Generation (PDFKit)                                         |
|     (Earnings, Deductions, Gross, Net Take-Home, Payables, Bank Details)    |
+-----------------------------------------------------------------------------+
```

---

## Key Core Principles

1. **Pure Read-Only Consumer**:
   - Payroll **never writes or modifies** Module 2 (`AttendanceRecord`) or Module 4 (`LeaveRequest`, `LeaveLedger`, `LeaveBalance`).
   - All attendance and leave data is queried dynamically and aggregated for the payroll cycle.

2. **Historical Salary Structure Integrity**:
   - Updates to an employee's salary create a **new structure document** with an `effective_from` date.
   - `resolveSalaryStructure(userId, targetDate)` always selects the active structure version where `effective_from <= cycle.from_date`.
   - Past payslips preserve original earnings/deductions even after salary increments or promotions.

3. **Canonical LOP Formula**:
   $$\text{LOP Days} = \text{Absent Days} + \text{Unpaid Leave Days} + \text{Late Deduction Days}$$
   - **Late Deduction Rule**: Under `Shift.late_action == 'DEDUCT'`, the first 3 monthly lates are forgiven. Each excess late (4th onwards) incurs `Shift.late_deduct_days` (default: 0.5 days).
   - **Exclusions**: Short leaves, paid leaves (CL, SL, PL), weekly offs, and official holidays **never** contribute to LOP.
   - **Mid-Cycle Joiners**: If an employee joined after `cycle.from_date`, non-employed calendar days prior to `date_of_joining` reduce `total_cycle_days`.

4. **Component Calculation & Proration**:
   - `Basic Prorated = (Basic / Total Cycle Days) * Payable Days`
   - `Percent of Basic = Component Value % * Basic Prorated`
   - `Fixed Earnings = (Fixed Value / Total Cycle Days) * Payable Days`
   - `Deductions`: Fixed deductions (e.g. PT ₹200) apply in full; percentage deductions (e.g. PF 12%) calculate against prorated basic.
   - `Net Pay = Round(Gross Earnings - Total Deductions)`

5. **Locked Month Integration**:
   - A payroll cycle is **locked** as soon as its runs reach `Approved`, `Released`, or `Paid`.
   - While locked, Module 2 (Clock-in/out), Module 3 (Regularization), and Module 4 (Leave applications) are blocked from applying/modifying records within that calendar month.
   - Super Admin can reopen a locked cycle with a mandatory reason, reverting runs to `Processed` and unlocking attendance/leave modifications.

---

## Data Models

### 1. `SalaryComponent` (`models/SalaryComponent.js`)
| Field | Type | Description |
|---|---|---|
| `name` | String | e.g. "House Rent Allowance (HRA)", "Provident Fund (PF)" |
| `code` | String | e.g. "HRA", "PF" |
| `type` | Enum | `EARNING` \| `DEDUCTION` |
| `calc_type` | Enum | `FIXED` \| `PERCENT_OF_BASIC` \| `FORMULA` |
| `value` | Number | Fixed amount or percentage |
| `taxable` | Boolean | Taxability flag |
| `status` | Enum | `Active` \| `Inactive` (Soft delete) |

### 2. `EmployeeSalaryStructure` (`models/EmployeeSalaryStructure.js`)
| Field | Type | Description |
|---|---|---|
| `user_id` | ObjectId | Ref to `User` |
| `effective_from` | Date | Effective starting date of this salary version |
| `basic` | Number | Monthly basic pay (e.g. ₹30,000) |
| `components` | Array | `[{ component_id, value }]` |
| `status` | Enum | `Active` \| `Superseded` \| `Inactive` |

### 3. `PayrollCycle` (`models/PayrollCycle.js`)
| Field | Type | Description |
|---|---|---|
| `name` | String | e.g. "March 2026 Payroll" |
| `month` | Number | 1 to 12 |
| `year` | Number | e.g. 2026 |
| `from_date` | Date | Start date of cycle (e.g. `2026-03-01`) |
| `to_date` | Date | End date of cycle (e.g. `2026-03-31`) |
| `cut_off` | Date | Cut-off date for payroll submissions |
| `pay_date` | Date | Disbursal date |
| `total_days` | Number | Total calendar/working days in the cycle period |
| `status` | Enum | `Draft` \| `Processed` \| `Approved` \| `Released` \| `Paid` |

### 4. `PayrollRun` (`models/PayrollRun.js`)
| Field | Type | Description |
|---|---|---|
| `cycle_id` | ObjectId | Ref to `PayrollCycle` |
| `user_id` | ObjectId | Ref to `User` |
| `structure_id` | ObjectId | Ref to `EmployeeSalaryStructure` |
| `total_cycle_days`| Number | Total days in cycle |
| `absent_days` | Number | Total absent days |
| `unpaid_leave_days`| Number | Total unpaid leave days |
| `late_deduction_days`| Number | Total late deduction days |
| `lop_days` | Number | Absent + Unpaid + Late deductions |
| `payable_days`| Number | Total cycle days - LOP days |
| `earnings` | Array | `[{ component_id, name, type, calc_type, value, calculated_amount }]` |
| `deductions` | Array | `[{ component_id, name, type, calc_type, value, calculated_amount }]` |
| `gross` | Number | Sum of all earnings |
| `total_deductions` | Number | Sum of all deductions |
| `net_pay` | Number | Net take-home salary |
| `status` | Enum | `Draft` \| `Processed` \| `Approved` \| `Released` \| `Paid` |
| `approved_by` | ObjectId | User ID of approver (CEO / CTO / Admin) |
| `released_at` | Date | Timestamp of release |
| `paid_at` | Date | Timestamp of disbursal |
| `bank_advice_ref`| String | Disbursal / NEFT reference string |

---

## API Endpoints

### Salary Components Master (`/api/salary-components`)
- `GET /api/salary-components`: List all active components (`PAYROLL:VIEW`).
- `POST /api/salary-components`: Create a salary component (`PAYROLL:EDIT_STRUCTURE` - Admin).
- `PUT /api/salary-components/:id`: Update component (`PAYROLL:EDIT_STRUCTURE` - Admin).
- `DELETE /api/salary-components/:id`: Soft delete component (`PAYROLL:EDIT_STRUCTURE` - Admin).

### Employee Salary Structures (`/api/employees/:userId/salary-structure`)
- `GET /api/employees/:userId/salary-structure`: Get all versions for an employee (`PAYROLL:VIEW` - OWN / ALL).
- `POST /api/employees/:userId/salary-structure`: Assign new version with `effective_from` (`PAYROLL:EDIT_STRUCTURE` - Admin).

### Payroll Cycles & Runs (`/api/payroll`)
- `GET /api/payroll/cycles`: List all payroll cycles (`PAYROLL:VIEW`).
- `POST /api/payroll/cycles`: Create a new payroll cycle (`PAYROLL:PROCESS` - Admin).
- `POST /api/payroll/process`: Run deterministic payroll calculation engine for a cycle (`PAYROLL:PROCESS` - Admin).
  - Skips `attendance_exempt: true` accounts (e.g. Super Admin).
- `GET /api/payroll/:cycleId/runs`: View all employee runs for a cycle with filter & pagination (`PAYROLL:VIEW`).
- `POST /api/payroll/:cycleId/approve`: Approve payroll cycle (`PAYROLL:APPROVE` - CEO / CTO / Super Admin).
- `POST /api/payroll/:cycleId/release`: Release payslips to employees (`PAYROLL:RELEASE` - Super Admin).
- `POST /api/payroll/:cycleId/mark-paid`: Mark disbursal with bank reference (`PAYROLL:MARK_PAID` - Super Admin).
- `POST /api/payroll/:cycleId/reopen`: Reopen locked payroll cycle with mandatory reason (`PAYROLL:REOPEN` - Super Admin).

### Payslips (`/api/payslips`)
- `GET /api/payslips/:runId`: View detailed payslip summary JSON (`PAYROLL:VIEW` - OWN / ALL, gate: Released or Paid).
- `GET /api/payslips/:runId/pdf`: Download formatted, print-ready PDF payslip via `PDFKit` (`PAYROLL:VIEW` - OWN / ALL, gate: Released or Paid).

---

## Verification & Test Results

Run the automated test suite:
```bash
node scripts/test_module6.js
```

### Test Coverage Summary:
- **10/10 Stages Passed**:
  1. Super Admin, CEO, CTO, and Employee Authentication.
  2. Salary Component Master CRUD & Scope Gates.
  3. Employee Salary Structure Versioning & Historical Date Resolution.
  4. Payroll Cycle Creation (`from_date`, `to_date`, `total_days`).
  5. Canonical LOP & Payable Days Formula Validation (Absent + Unpaid + Late Deductions).
  6. Batch Payroll Processing with Super Admin Exemption.
  7. Approval State Transition & Real `isPayrollMonthLocked()` Integration.
  8. Reopen Locked Month Gate with Mandatory Reason Logging.
  9. Payslip Release & Mark Paid Transitions.
  10. Employee Payslip Access & Binary PDF Header Verification (`%PDF`).
