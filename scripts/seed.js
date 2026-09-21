require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Branch = require('../models/Branch');
const Shift = require('../models/Shift');
const Holiday = require('../models/Holiday');
const RegularizationReason = require('../models/RegularizationReason');
const LeaveType = require('../models/LeaveType');
const ApprovalMatrix = require('../models/ApprovalMatrix');
const SalaryComponent = require('../models/SalaryComponent');
const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const NotificationTemplate = require('../models/NotificationTemplate');
const Notification = require('../models/Notification');
const User = require('../models/User');

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding for NexAlliance HRM...');
    await connectDB();

    // 1. Seed System Roles
    console.log('1️⃣ Seeding System Roles...');
    const rolesData = [
      { name: 'Super Admin', code: 'SUPER_ADMIN', is_system: true, is_super_admin: true, status: 'Active' },
      { name: 'Chief Executive Officer', code: 'CEO', is_system: true, is_super_admin: false, status: 'Active' },
      { name: 'Chief Technology Officer', code: 'CTO', is_system: true, is_super_admin: false, status: 'Active' },
      { name: 'Employee', code: 'EMPLOYEE', is_system: true, is_super_admin: false, status: 'Active' }
    ];

    const rolesMap = new Map();
    for (const r of rolesData) {
      const role = await Role.findOneAndUpdate(
        { code: r.code },
        { $set: r },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      rolesMap.set(r.code, role);
      console.log(`   ✓ Role seeded: ${role.name} (${role.code})`);
    }

    // 2. Seed Permission Catalog
    console.log('2️⃣ Seeding Permission Catalog...');
    const permissionsData = [
      // Employee
      { module: 'EMPLOYEE', action: 'VIEW', description: 'View employee profiles' },
      { module: 'EMPLOYEE', action: 'CREATE', description: 'Create new employee' },
      { module: 'EMPLOYEE', action: 'EDIT', description: 'Edit employee profile' },
      { module: 'EMPLOYEE', action: 'DELETE', description: 'Deactivate employee' },

      // Masters
      { module: 'MASTERS', action: 'VIEW', description: 'View organization masters (Department, Designation, Branch)' },
      { module: 'MASTERS', action: 'CREATE', description: 'Create organization master record' },
      { module: 'MASTERS', action: 'EDIT', description: 'Edit organization master record' },
      { module: 'MASTERS', action: 'DELETE', description: 'Deactivate organization master record' },

      // Role Master
      { module: 'ROLE', action: 'VIEW', description: 'View system roles' },
      { module: 'ROLE', action: 'CREATE', description: 'Create custom role' },
      { module: 'ROLE', action: 'EDIT', description: 'Edit custom role' },
      { module: 'ROLE', action: 'DELETE', description: 'Deactivate custom role' },

      // Permission Matrix
      { module: 'PERMISSION_MATRIX', action: 'VIEW', description: 'View role permission matrix' },
      { module: 'PERMISSION_MATRIX', action: 'EDIT', description: 'Configure role permission matrix' },

      // Attendance
      { module: 'ATTENDANCE', action: 'CLOCK_IN', description: 'Perform Clock In' },
      { module: 'ATTENDANCE', action: 'CLOCK_OUT', description: 'Perform Clock Out' },
      { module: 'ATTENDANCE', action: 'VIEW', description: 'View attendance records' },
      { module: 'ATTENDANCE', action: 'EDIT', description: 'Edit / override attendance' },

      // Regularization
      { module: 'REGULARIZATION', action: 'APPLY', description: 'Apply for attendance regularization' },
      { module: 'REGULARIZATION', action: 'VIEW', description: 'View regularization requests' },
      { module: 'REGULARIZATION', action: 'APPROVE', description: 'Approve regularization' },
      { module: 'REGULARIZATION', action: 'REJECT', description: 'Reject regularization' },

      // Leave
      { module: 'LEAVE', action: 'APPLY', description: 'Apply for leave / short leave' },
      { module: 'LEAVE', action: 'VIEW', description: 'View leave applications' },
      { module: 'LEAVE', action: 'APPROVE', description: 'Approve leave request' },
      { module: 'LEAVE', action: 'REJECT', description: 'Reject leave request' },

      // Approval Matrix (Module 5)
      { module: 'APPROVAL_MATRIX', action: 'VIEW', description: 'View approval matrix configurations' },
      { module: 'APPROVAL_MATRIX', action: 'CREATE', description: 'Create approval matrix mapping' },
      { module: 'APPROVAL_MATRIX', action: 'EDIT', description: 'Edit approval matrix mapping' },
      { module: 'APPROVAL_MATRIX', action: 'DELETE', description: 'Deactivate approval matrix mapping' },

      // Payroll (Module 6)
      { module: 'PAYROLL', action: 'VIEW', description: 'View payslips / payroll summary' },
      { module: 'PAYROLL', action: 'PROCESS', description: 'Process monthly payroll' },
      { module: 'PAYROLL', action: 'APPROVE', description: 'Approve payroll cycle' },
      { module: 'PAYROLL', action: 'RELEASE', description: 'Release payslips to employees' },
      { module: 'PAYROLL', action: 'MARK_PAID', description: 'Mark payroll cycle as paid' },
      { module: 'PAYROLL', action: 'REOPEN', description: 'Reopen locked payroll cycle' },
      { module: 'PAYROLL', action: 'EDIT_STRUCTURE', description: 'Assign employee salary structures' },
      { module: 'PAYROLL', action: 'GENERATE', description: 'Generate payslips' },

      // Reports, Settings, Audit
      { module: 'REPORTS', action: 'VIEW', description: 'View HRM reports and analytics' },
      { module: 'REPORTS', action: 'EXPORT', description: 'Export HRM reports' },
      { module: 'SETTINGS', action: 'VIEW', description: 'View company settings' },
      { module: 'SETTINGS', action: 'EDIT', description: 'Modify company settings' },
      { module: 'AUDIT', action: 'VIEW', description: 'View system audit trail' }
    ];

    const permissionsMap = new Map();
    for (const p of permissionsData) {
      const perm = await Permission.findOneAndUpdate(
        { module: p.module, action: p.action },
        { $set: p },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      permissionsMap.set(`${p.module}:${p.action}`, perm);
    }
    console.log(`   ✓ Seeded ${permissionsMap.size} static permissions.`);

    // 3. Seed RolePermission Matrix
    console.log('3️⃣ Seeding Role-Permission Matrix mappings...');

    // CEO & CTO Matrix Rules (Identical)
    const execPermConfigs = {
      'EMPLOYEE:VIEW': { allowed: true, scope: 'ALL' },
      'EMPLOYEE:CREATE': { allowed: false, scope: 'NO' },
      'EMPLOYEE:EDIT': { allowed: false, scope: 'NO' },
      'EMPLOYEE:DELETE': { allowed: false, scope: 'NO' },
      'MASTERS:VIEW': { allowed: true, scope: 'ALL' },
      'MASTERS:CREATE': { allowed: false, scope: 'NO' },
      'MASTERS:EDIT': { allowed: false, scope: 'NO' },
      'MASTERS:DELETE': { allowed: false, scope: 'NO' },
      'ROLE:VIEW': { allowed: true, scope: 'ALL' },
      'ROLE:CREATE': { allowed: false, scope: 'NO' },
      'ROLE:EDIT': { allowed: false, scope: 'NO' },
      'ROLE:DELETE': { allowed: false, scope: 'NO' },
      'PERMISSION_MATRIX:VIEW': { allowed: true, scope: 'ALL' },
      'PERMISSION_MATRIX:EDIT': { allowed: false, scope: 'NO' },
      'ATTENDANCE:CLOCK_IN': { allowed: true, scope: 'OWN' },
      'ATTENDANCE:CLOCK_OUT': { allowed: true, scope: 'OWN' },
      'ATTENDANCE:VIEW': { allowed: true, scope: 'ALL' },
      'ATTENDANCE:EDIT': { allowed: false, scope: 'NO' },
      'REGULARIZATION:APPLY': { allowed: true, scope: 'OWN' },
      'REGULARIZATION:VIEW': { allowed: true, scope: 'ALL' },
      'REGULARIZATION:APPROVE': { allowed: false, scope: 'NO' },
      'REGULARIZATION:REJECT': { allowed: false, scope: 'NO' },
      'LEAVE:APPLY': { allowed: true, scope: 'OWN' },
      'LEAVE:VIEW': { allowed: true, scope: 'ALL' },
      'LEAVE:APPROVE': { allowed: true, scope: 'MATRIX' },
      'LEAVE:REJECT': { allowed: true, scope: 'MATRIX' },
      'APPROVAL_MATRIX:VIEW': { allowed: true, scope: 'ALL' },
      'APPROVAL_MATRIX:CREATE': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:EDIT': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:DELETE': { allowed: false, scope: 'NO' },
      'PAYROLL:VIEW': { allowed: true, scope: 'ALL' },
      'PAYROLL:PROCESS': { allowed: false, scope: 'NO' },
      'PAYROLL:APPROVE': { allowed: true, scope: 'ALL' },
      'PAYROLL:RELEASE': { allowed: false, scope: 'NO' },
      'PAYROLL:MARK_PAID': { allowed: false, scope: 'NO' },
      'PAYROLL:REOPEN': { allowed: false, scope: 'NO' },
      'PAYROLL:EDIT_STRUCTURE': { allowed: false, scope: 'NO' },
      'PAYROLL:GENERATE': { allowed: false, scope: 'NO' },
      'REPORTS:VIEW': { allowed: true, scope: 'ALL' },
      'REPORTS:EXPORT': { allowed: true, scope: 'ALL' },
      'SETTINGS:VIEW': { allowed: true, scope: 'ALL' },
      'SETTINGS:EDIT': { allowed: false, scope: 'NO' },
      'AUDIT:VIEW': { allowed: false, scope: 'NO' }
    };

    // Employee Matrix Rules (Self-service only)
    const empPermConfigs = {
      'EMPLOYEE:VIEW': { allowed: true, scope: 'OWN' },
      'EMPLOYEE:CREATE': { allowed: false, scope: 'NO' },
      'EMPLOYEE:EDIT': { allowed: true, scope: 'OWN' },
      'EMPLOYEE:DELETE': { allowed: false, scope: 'NO' },
      'MASTERS:VIEW': { allowed: true, scope: 'ALL' },
      'MASTERS:CREATE': { allowed: false, scope: 'NO' },
      'MASTERS:EDIT': { allowed: false, scope: 'NO' },
      'MASTERS:DELETE': { allowed: false, scope: 'NO' },
      'ROLE:VIEW': { allowed: false, scope: 'NO' },
      'ROLE:CREATE': { allowed: false, scope: 'NO' },
      'ROLE:EDIT': { allowed: false, scope: 'NO' },
      'ROLE:DELETE': { allowed: false, scope: 'NO' },
      'PERMISSION_MATRIX:VIEW': { allowed: false, scope: 'NO' },
      'PERMISSION_MATRIX:EDIT': { allowed: false, scope: 'NO' },
      'ATTENDANCE:CLOCK_IN': { allowed: true, scope: 'OWN' },
      'ATTENDANCE:CLOCK_OUT': { allowed: true, scope: 'OWN' },
      'ATTENDANCE:VIEW': { allowed: true, scope: 'OWN' },
      'ATTENDANCE:EDIT': { allowed: false, scope: 'NO' },
      'REGULARIZATION:APPLY': { allowed: true, scope: 'OWN' },
      'REGULARIZATION:VIEW': { allowed: true, scope: 'OWN' },
      'REGULARIZATION:APPROVE': { allowed: false, scope: 'NO' },
      'REGULARIZATION:REJECT': { allowed: false, scope: 'NO' },
      'LEAVE:APPLY': { allowed: true, scope: 'OWN' },
      'LEAVE:VIEW': { allowed: true, scope: 'OWN' },
      'LEAVE:APPROVE': { allowed: false, scope: 'NO' },
      'LEAVE:REJECT': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:VIEW': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:CREATE': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:EDIT': { allowed: false, scope: 'NO' },
      'APPROVAL_MATRIX:DELETE': { allowed: false, scope: 'NO' },
      'PAYROLL:VIEW': { allowed: true, scope: 'OWN' },
      'PAYROLL:PROCESS': { allowed: false, scope: 'NO' },
      'PAYROLL:APPROVE': { allowed: false, scope: 'NO' },
      'PAYROLL:RELEASE': { allowed: false, scope: 'NO' },
      'PAYROLL:MARK_PAID': { allowed: false, scope: 'NO' },
      'PAYROLL:REOPEN': { allowed: false, scope: 'NO' },
      'PAYROLL:EDIT_STRUCTURE': { allowed: false, scope: 'NO' },
      'PAYROLL:GENERATE': { allowed: false, scope: 'NO' },
      'REPORTS:VIEW': { allowed: false, scope: 'NO' },
      'REPORTS:EXPORT': { allowed: false, scope: 'NO' },
      'SETTINGS:VIEW': { allowed: false, scope: 'NO' },
      'SETTINGS:EDIT': { allowed: false, scope: 'NO' },
      'AUDIT:VIEW': { allowed: false, scope: 'NO' }
    };

    const populateRolePermissions = async (roleObj, configMap) => {
      for (const [key, perm] of permissionsMap.entries()) {
        const config = configMap[key] || { allowed: false, scope: 'NO' };
        await RolePermission.findOneAndUpdate(
          { role_id: roleObj._id, permission_id: perm._id },
          {
            $set: {
              role_id: roleObj._id,
              permission_id: perm._id,
              allowed: config.allowed,
              scope: config.scope
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    };

    // Populate for CEO, CTO, EMPLOYEE
    await populateRolePermissions(rolesMap.get('CEO'), execPermConfigs);
    await populateRolePermissions(rolesMap.get('CTO'), execPermConfigs);
    await populateRolePermissions(rolesMap.get('EMPLOYEE'), empPermConfigs);

    // Also populate Super Admin rows as ALL/allowed (even though bypassed at middleware)
    const superAdminPermConfigs = {};
    for (const key of permissionsMap.keys()) {
      superAdminPermConfigs[key] = { allowed: true, scope: 'ALL' };
    }
    await populateRolePermissions(rolesMap.get('SUPER_ADMIN'), superAdminPermConfigs);
    console.log('   ✓ Seeded all Role-Permission Matrix mappings.');

    // 4. Seed Default Organization Masters (Branch, Department, Designation)
    console.log('4️⃣ Seeding Default Organization Masters...');
    const defaultBranch = await Branch.findOneAndUpdate(
      { name: 'NexAlliance HQ' },
      {
        $set: {
          name: 'NexAlliance HQ',
          address: 'Surat, Gujarat, India',
          latitude: 21.1702,
          longitude: 72.8311,
          radius_m: 200,
          timezone: 'Asia/Kolkata',
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const defaultDept = await Department.findOneAndUpdate(
      { code: 'EXEC' },
      {
        $set: {
          name: 'Executive & Administration',
          code: 'EXEC',
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const itDept = await Department.findOneAndUpdate(
      { code: 'IT' },
      {
        $set: {
          name: 'Information Technology',
          code: 'IT',
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const defaultDesignation = await Designation.findOneAndUpdate(
      { code: 'SA' },
      {
        $set: {
          name: 'Super Administrator',
          code: 'SA',
          department_id: defaultDept._id,
          level: 1,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const seDesignation = await Designation.findOneAndUpdate(
      { code: 'SSE' },
      {
        $set: {
          name: 'Senior Software Engineer',
          code: 'SSE',
          department_id: itDept._id,
          level: 2,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const defaultShift = await Shift.findOneAndUpdate(
      { name: 'General Day Shift' },
      {
        $set: {
          name: 'General Day Shift',
          start_time: '10:00',
          end_time: '18:30',
          grace_in_min: 10,
          monthly_late_allowed: 3,
          late_action: 'DEDUCT',
          late_deduct_days: 0.5,
          half_day_hrs: 4,
          full_day_hrs: 8,
          status: 'Active'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Seed 2026 Sample Holidays
    const holidays2026 = [
      { name: 'Republic Day', date: new Date(Date.UTC(2026, 0, 26)), type: 'HOLIDAY' },
      { name: 'Holi', date: new Date(Date.UTC(2026, 2, 4)), type: 'HOLIDAY' },
      { name: 'Independence Day', date: new Date(Date.UTC(2026, 7, 15)), type: 'HOLIDAY' },
      { name: 'Mahatma Gandhi Jayanti', date: new Date(Date.UTC(2026, 9, 2)), type: 'HOLIDAY' },
      { name: 'Diwali (Deepawali)', date: new Date(Date.UTC(2026, 10, 8)), type: 'HOLIDAY' },
      { name: 'Christmas Day', date: new Date(Date.UTC(2026, 11, 25)), type: 'HOLIDAY' }
    ];

    for (const h of holidays2026) {
      await Holiday.findOneAndUpdate(
        { name: h.name, date: h.date },
        { $set: { ...h, branch_id: null, status: 'Active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Seed Default Regularization Reasons (Module 3 Master)
    const defaultReasons = [
      'Forgot to Clock In / Out',
      'On-duty / Client Site Visit',
      'Biometric / Device Technical Issue',
      'Traffic / Public Transport Delay',
      'Emergency Family Obligation'
    ];

    for (const rText of defaultReasons) {
      await RegularizationReason.findOneAndUpdate(
        { reason: rText },
        { $set: { reason: rText, status: 'Active' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Seed Default Leave Types (Module 4 Master)
    const defaultLeaveTypes = [
      {
        code: 'SHORT_LEAVE',
        name: 'Short Leave',
        is_paid: true,
        quota: 2,
        quota_period: 'MONTH',
        carry_forward: false,
        deduct_salary: false,
        max_duration_minutes: 120,
        half_day_allowed: false,
        needs_attachment: false,
        notice_days: 0,
        status: 'Active'
      },
      {
        code: 'LWP',
        name: 'Unpaid Leave (LWP)',
        is_paid: false,
        quota: 0, // No cap
        quota_period: 'YEAR',
        carry_forward: false,
        deduct_salary: true,
        max_duration_minutes: null,
        half_day_allowed: true,
        needs_attachment: false,
        notice_days: 0,
        status: 'Active'
      },
      {
        code: 'CL',
        name: 'Casual Leave',
        is_paid: true,
        quota: 12,
        quota_period: 'YEAR',
        carry_forward: false,
        deduct_salary: false,
        max_duration_minutes: null,
        half_day_allowed: true,
        needs_attachment: false,
        notice_days: 1,
        status: 'Active'
      }
    ];

    for (const lt of defaultLeaveTypes) {
      await LeaveType.findOneAndUpdate(
        { code: lt.code },
        { $set: lt },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('   ✓ Seeded Branches, Departments, Designations, Shifts, Holidays, Reasons, and Leave Types.');

    // 5. Seed Default Approval Matrix Configurations (Matrix A + Locked Regularization Row)
    console.log('5️⃣ Seeding Default Approval Matrix Mappings (Matrix A & Locked Regularization)...');
    const empRole = rolesMap.get('EMPLOYEE');
    const ceoRole = rolesMap.get('CEO');
    const ctoRole = rolesMap.get('CTO');
    const saRole = rolesMap.get('SUPER_ADMIN');

    const defaultMatrixConfigs = [
      // 1. Employee Leave -> Both CEO & CTO must approve (rule: ALL)
      {
        requester_type: 'ROLE',
        requester_ref: empRole._id,
        module: 'LEAVE',
        level_no: 1,
        rule: 'ALL',
        approvers: [
          { approver_type: 'ROLE', approver_ref: ceoRole._id },
          { approver_type: 'ROLE', approver_ref: ctoRole._id }
        ],
        is_active: true,
        is_locked: false
      },
      // 2. CTO Leave -> CEO single approver (rule: ALL)
      {
        requester_type: 'ROLE',
        requester_ref: ctoRole._id,
        module: 'LEAVE',
        level_no: 1,
        rule: 'ALL',
        approvers: [
          { approver_type: 'ROLE', approver_ref: ceoRole._id }
        ],
        is_active: true,
        is_locked: false
      },
      // 3. CEO Leave -> CTO single approver (rule: ALL)
      {
        requester_type: 'ROLE',
        requester_ref: ceoRole._id,
        module: 'LEAVE',
        level_no: 1,
        rule: 'ALL',
        approvers: [
          { approver_type: 'ROLE', approver_ref: ctoRole._id }
        ],
        is_active: true,
        is_locked: false
      },
      // 4. Regularization Role Default -> Super Admin only (is_locked: true)
      {
        requester_type: 'ROLE',
        requester_ref: empRole._id,
        module: 'REGULARIZATION',
        level_no: 1,
        rule: 'ALL',
        approvers: [
          { approver_type: 'ROLE', approver_ref: saRole._id }
        ],
        is_active: true,
        is_locked: true
      }
    ];

    for (const mCfg of defaultMatrixConfigs) {
      await ApprovalMatrix.findOneAndUpdate(
        {
          requester_type: mCfg.requester_type,
          requester_ref: mCfg.requester_ref,
          module: mCfg.module
        },
        { $set: mCfg },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('   ✓ Seeded Matrix A Role Defaults (Employee, CTO, CEO) & Locked Regularization row.');

    // 6. Seed Default Salary Components (Module 6 Master)
    console.log('6️⃣ Seeding Default Salary Components...');
    const defaultSalaryComponents = [
      { name: 'House Rent Allowance (HRA)', type: 'EARNING', calc_type: 'PERCENT_OF_BASIC', value: 40, taxable: true, status: 'Active' },
      { name: 'Conveyance Allowance', type: 'EARNING', calc_type: 'FIXED', value: 2000, taxable: true, status: 'Active' },
      { name: 'Special Allowance', type: 'EARNING', calc_type: 'FIXED', value: 5000, taxable: true, status: 'Active' },
      { name: 'Provident Fund (PF)', type: 'DEDUCTION', calc_type: 'PERCENT_OF_BASIC', value: 12, taxable: false, status: 'Active' },
      { name: 'Professional Tax (PT)', type: 'DEDUCTION', calc_type: 'FIXED', value: 200, taxable: false, status: 'Active' }
    ];

    for (const sc of defaultSalaryComponents) {
      await SalaryComponent.findOneAndUpdate(
        { name: sc.name },
        { $set: sc },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('   ✓ Seeded Default Salary Components (HRA, Conveyance, Special, PF, PT).');

    // 7. Seed Default Notification Templates (Module 7 Master)
    console.log('7️⃣ Seeding Default Notification Templates...');
    const defaultNotificationTemplates = [
      // 1. REGULARIZATION_APPROVED
      {
        event: 'REGULARIZATION_APPROVED',
        channel: 'EMAIL',
        subject: 'Attendance Regularization Approved for {{date}}',
        body: 'Dear {{employee_name}},\n\nYour attendance regularization request for {{date}} (In: {{in_time}}, Out: {{out_time}}) has been approved by Super Admin.\n\nRegards,\nNexAlliance HR Team',
        status: 'Active'
      },
      {
        event: 'REGULARIZATION_APPROVED',
        channel: 'IN_APP',
        subject: null,
        body: 'Your attendance regularization for {{date}} has been approved.',
        status: 'Active'
      },

      // 2. REGULARIZATION_REJECTED
      {
        event: 'REGULARIZATION_REJECTED',
        channel: 'EMAIL',
        subject: 'Attendance Regularization Rejected for {{date}}',
        body: 'Dear {{employee_name}},\n\nYour attendance regularization request for {{date}} has been rejected.\nReason: {{rejection_reason}}\n\nRegards,\nNexAlliance HR Team',
        status: 'Active'
      },
      {
        event: 'REGULARIZATION_REJECTED',
        channel: 'IN_APP',
        subject: null,
        body: 'Your attendance regularization for {{date}} was rejected. Reason: {{rejection_reason}}',
        status: 'Active'
      },

      // 3. LEAVE_APPLIED
      {
        event: 'LEAVE_APPLIED',
        channel: 'EMAIL',
        subject: 'New Leave Application: {{employee_name}} ({{leave_type}})',
        body: 'Hello,\n\n{{employee_name}} has applied for {{days}} day(s) of {{leave_type}} from {{from_date}} to {{to_date}}.\nReason: {{reason}}\n\nPlease review the request in your approval queue.\n\nRegards,\nNexAlliance HRM',
        status: 'Active'
      },
      {
        event: 'LEAVE_APPLIED',
        channel: 'IN_APP',
        subject: null,
        body: '{{employee_name}} applied for {{days}} day(s) of {{leave_type}} from {{from_date}} to {{to_date}}. Action required.',
        status: 'Active'
      },

      // 4. LEAVE_FIRST_APPROVAL
      {
        event: 'LEAVE_FIRST_APPROVAL',
        channel: 'EMAIL',
        subject: 'Leave Request Partially Approved ({{approvals_done}}/{{approvals_needed}})',
        body: 'Dear {{employee_name}},\n\nYour {{leave_type}} application has received 1st-level approval ({{approvals_done}} of {{approvals_needed}} approvals recorded). Awaiting final decision.\n\nRegards,\nNexAlliance HRM',
        status: 'Active'
      },
      {
        event: 'LEAVE_FIRST_APPROVAL',
        channel: 'IN_APP',
        subject: null,
        body: 'Your {{leave_type}} application received 1st-level approval ({{approvals_done}}/{{approvals_needed}}).',
        status: 'Active'
      },

      // 5. LEAVE_APPROVED
      {
        event: 'LEAVE_APPROVED',
        channel: 'EMAIL',
        subject: 'Leave Request Approved: {{leave_type}} ({{from_date}} to {{to_date}})',
        body: 'Dear {{employee_name}},\n\nYour leave application for {{days}} day(s) of {{leave_type}} from {{from_date}} to {{to_date}} has been APPROVED.\n\nRegards,\nNexAlliance HR Team',
        status: 'Active'
      },
      {
        event: 'LEAVE_APPROVED',
        channel: 'IN_APP',
        subject: null,
        body: 'Your leave application for {{days}} day(s) of {{leave_type}} from {{from_date}} to {{to_date}} is Approved.',
        status: 'Active'
      },

      // 6. LEAVE_REJECTED
      {
        event: 'LEAVE_REJECTED',
        channel: 'EMAIL',
        subject: 'Leave Request Rejected: {{leave_type}}',
        body: 'Dear {{employee_name}},\n\nYour leave application for {{leave_type}} has been REJECTED.\nReason: {{rejection_reason}}\n\nRegards,\nNexAlliance HR Team',
        status: 'Active'
      },
      {
        event: 'LEAVE_REJECTED',
        channel: 'IN_APP',
        subject: null,
        body: 'Your {{leave_type}} application was rejected. Reason: {{rejection_reason}}',
        status: 'Active'
      },

      // 7. LEAVE_CANCELLED_NOTICE
      {
        event: 'LEAVE_CANCELLED_NOTICE',
        channel: 'EMAIL',
        subject: 'Notice: Leave Cancelled by {{employee_name}}',
        body: 'Hello,\n\n{{employee_name}} has cancelled their approved {{leave_type}} from {{from_date}} to {{to_date}}. Their leave balance has been restored.\n\nRegards,\nNexAlliance HRM',
        status: 'Active'
      },
      {
        event: 'LEAVE_CANCELLED_NOTICE',
        channel: 'IN_APP',
        subject: null,
        body: '{{employee_name}} cancelled their approved {{leave_type}} from {{from_date}} to {{to_date}}.',
        status: 'Active'
      },

      // 8. PAYSLIP_RELEASED
      {
        event: 'PAYSLIP_RELEASED',
        channel: 'EMAIL',
        subject: 'Payslip Released for {{month}}/{{year}}',
        body: 'Dear {{employee_name}},\n\nYour payslip for {{month}}/{{year}} is now released and available.\nNet Pay: ₹{{net_pay}} (Gross: ₹{{gross}}, Payable Days: {{payable_days}}).\nYou may view and download your payslip PDF from the employee portal.\n\nRegards,\nNexAlliance Payroll Team',
        status: 'Active'
      },
      {
        event: 'PAYSLIP_RELEASED',
        channel: 'IN_APP',
        subject: null,
        body: 'Your payslip for {{month}}/{{year}} has been released. Net Pay: ₹{{net_pay}}.',
        status: 'Active'
      },

      // 9. LEAVE_PENDING_REMINDER
      {
        event: 'LEAVE_PENDING_REMINDER',
        channel: 'EMAIL',
        subject: 'Reminder: Pending Leave Approval for {{employee_name}}',
        body: 'Hello,\n\nThis is a reminder that {{employee_name}}\'s leave request for {{days}} day(s) of {{leave_type}} from {{from_date}} to {{to_date}} has been pending for {{days_pending}} day(s). Please review and act on it.\n\nRegards,\nNexAlliance HRM',
        status: 'Active'
      },
      {
        event: 'LEAVE_PENDING_REMINDER',
        channel: 'IN_APP',
        subject: null,
        body: 'Reminder: {{employee_name}}\'s leave request for {{days}} day(s) has been pending for {{days_pending}} day(s).',
        status: 'Active'
      }
    ];

    for (const nt of defaultNotificationTemplates) {
      await NotificationTemplate.findOneAndUpdate(
        { event: nt.event, channel: nt.channel },
        { $set: nt },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`   ✓ Seeded ${defaultNotificationTemplates.length} Default Notification Templates.`);

    // 8. Seed Initial Super Admin User
    console.log('8️⃣ Seeding Default Super Admin Account...');
    const superAdminRole = rolesMap.get('SUPER_ADMIN');
    const adminEmail = 'admin@nexalliance.com';
    const adminPassword = 'Admin@12345';
    const passwordHash = await User.hashPassword(adminPassword);

    let superAdminUser = await User.findOne({
      $or: [{ email: adminEmail }, { employee_code: 'NEX-0001' }]
    });

    if (!superAdminUser) {
      superAdminUser = await User.create({
        employee_code: 'NEX-0001',
        name: 'Super Administrator',
        email: adminEmail,
        password_hash: passwordHash,
        role_id: superAdminRole._id,
        department_id: defaultDept._id,
        designation_id: defaultDesignation._id,
        branch_id: defaultBranch._id,
        shift_id: defaultShift._id,
        attendance_exempt: true,
        dob: new Date('1990-01-01'),
        date_of_joining: new Date(),
        salary: 150000,
        phone: '+91 9876543210',
        status: 'Active'
      });
    } else {
      superAdminUser.name = 'Super Administrator';
      superAdminUser.email = adminEmail;
      superAdminUser.password_hash = passwordHash;
      superAdminUser.role_id = superAdminRole._id;
      superAdminUser.department_id = defaultDept._id;
      superAdminUser.designation_id = defaultDesignation._id;
      superAdminUser.branch_id = defaultBranch._id;
      superAdminUser.shift_id = defaultShift._id;
      superAdminUser.attendance_exempt = true;
      superAdminUser.status = 'Active';
      await superAdminUser.save();
    }

    console.log(`   ✓ Super Admin seeded: ${superAdminUser.email} (Employee Code: ${superAdminUser.employee_code})`);

    console.log('\n🎉 Database Seeding Completed Successfully!');
    console.log('====================================================');
    console.log('Credentials:');
    console.log(`Super Admin Email: ${adminEmail}`);
    console.log(`Super Admin Pass : ${adminPassword}`);
    console.log('====================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
