const mongoose = require('mongoose');
const User = require('../models/User');
const AttendanceDaily = require('../models/AttendanceDaily');
const LateMonthlySummary = require('../models/LateMonthlySummary');
const RegularizationRequest = require('../models/RegularizationRequest');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveBalance = require('../models/LeaveBalance');
const LeaveLedger = require('../models/LeaveLedger');
const LeaveType = require('../models/LeaveType');
const PayrollRun = require('../models/PayrollRun');
const PayrollCycle = require('../models/PayrollCycle');
const Notification = require('../models/Notification');
const SensitiveChangeRequest = require('../models/SensitiveChangeRequest');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate, getTodayFormatted } = require('./dateUtils');

/**
 * 1. Attendance Summary Aggregation
 */
const aggregateAttendanceSummary = async ({ from, to, branch_id, department_id, user_id } = {}) => {
  const userFilter = { status: 'Active' };
  if (user_id) userFilter._id = user_id;
  if (branch_id) userFilter.branch_id = branch_id;
  if (department_id) userFilter.department_id = department_id;

  const users = await User.find(userFilter)
    .select('employee_code name department_id designation_id branch_id')
    .populate('department_id', 'name code')
    .populate('designation_id', 'name code')
    .populate('branch_id', 'name');

  const userIds = users.map(u => u._id);

  const attFilter = { user_id: { $in: userIds } };
  if (from || to) {
    attFilter.date = {};
    if (from) attFilter.date.$gte = parseDate(from) || from;
    if (to) {
      const parsedTo = parseDate(to) || to;
      if (parsedTo instanceof Date) {
        parsedTo.setUTCHours(23, 59, 59, 999);
      }
      attFilter.date.$lte = parsedTo;
    }
  }

  const attendanceRecords = await AttendanceDaily.find(attFilter).sort({ date: 1 });

  // Map per user
  const summaryMap = {};
  users.forEach(u => {
    summaryMap[u._id.toString()] = {
      user_id: u._id,
      employee_code: u.employee_code,
      name: u.name,
      department: u.department_id?.name || 'N/A',
      designation: u.designation_id?.name || 'N/A',
      branch: u.branch_id?.name || 'N/A',
      total_days_tracked: 0,
      present_days: 0,
      absent_days: 0,
      half_days: 0,
      paid_leave_days: 0,
      unpaid_leave_days: 0,
      holiday_days: 0,
      weekly_off_days: 0,
      late_count: 0,
      total_work_minutes: 0,
      daily_logs: []
    };
  });

  attendanceRecords.forEach(rec => {
    const uKey = rec.user_id.toString();
    if (summaryMap[uKey]) {
      const s = summaryMap[uKey];
      s.total_days_tracked++;
      s.total_work_minutes += (rec.work_minutes || 0);
      if (rec.is_late) s.late_count++;

      switch (rec.status) {
        case 'Present': s.present_days++; break;
        case 'Absent': s.absent_days++; break;
        case 'Half Day': s.half_days++; break;
        case 'Paid Leave': s.paid_leave_days++; break;
        case 'Unpaid Leave': s.unpaid_leave_days++; break;
        case 'Holiday': s.holiday_days++; break;
        case 'Week Off': s.weekly_off_days++; break;
      }

      s.daily_logs.push({
        date: rec.date,
        status: rec.status,
        first_in: rec.first_in,
        last_out: rec.last_out,
        work_minutes: rec.work_minutes,
        is_late: rec.is_late,
        is_regularized: rec.is_regularized
      });
    }
  });

  return Object.values(summaryMap);
};

/**
 * 2. Leave Balance Report Aggregation
 */
const aggregateLeaveBalanceSummary = async ({ year, month, department_id } = {}) => {
  const currentYear = year ? Number(year) : new Date().getFullYear();
  const currentMonth = month ? Number(month) : new Date().getMonth() + 1;

  const userFilter = { status: 'Active' };
  if (department_id) userFilter.department_id = department_id;

  const users = await User.find(userFilter)
    .select('employee_code name department_id designation_id')
    .populate('department_id', 'name code')
    .populate('designation_id', 'name');

  const userIds = users.map(u => u._id);

  const balances = await LeaveBalance.find({
    user_id: { $in: userIds },
    year: currentYear,
    month: currentMonth
  }).populate('leave_type_id', 'name code is_paid quota');

  const balanceList = balances.map(b => {
    const user = users.find(u => u._id.toString() === b.user_id.toString());
    return {
      user_id: b.user_id,
      employee_code: user?.employee_code || 'N/A',
      name: user?.name || 'N/A',
      department: user?.department_id?.name || 'N/A',
      leave_type_id: b.leave_type_id?._id,
      leave_type_name: b.leave_type_id?.name || 'N/A',
      leave_type_code: b.leave_type_id?.code || 'N/A',
      is_paid: b.leave_type_id?.is_paid ?? true,
      year: b.year,
      month: b.month,
      opening: b.opening,
      accrued: b.accrued,
      used: b.used,
      pending: b.pending,
      available: b.available
    };
  });

  return balanceList;
};

/**
 * 3. Leave Ledger Report Aggregation
 */
const aggregateLeaveLedgerReport = async ({ user_id, leave_type_id, from, to } = {}) => {
  const filter = {};
  if (user_id) filter.user_id = user_id;
  if (leave_type_id) filter.leave_type_id = leave_type_id;

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const ledger = await LeaveLedger.find(filter)
    .populate('user_id', 'employee_code name department_id')
    .populate('leave_type_id', 'name code is_paid')
    .sort({ date: -1 });

  return ledger.map(l => ({
    id: l._id,
    user_id: l.user_id?._id,
    employee_code: l.user_id?.employee_code || 'N/A',
    employee_name: l.user_id?.name || 'N/A',
    leave_type: l.leave_type_id?.name || 'N/A',
    date: l.date,
    txn_type: l.txn_type,
    qty: l.qty,
    remarks: l.remarks,
    ref_id: l.ref_id
  }));
};

/**
 * 4. Leave Utilization Report Aggregation
 */
const aggregateLeaveUtilization = async ({ year, department_id } = {}) => {
  const targetYear = year ? Number(year) : new Date().getFullYear();

  const userFilter = { status: 'Active' };
  if (department_id) userFilter.department_id = department_id;
  const users = await User.find(userFilter).select('_id');
  const userIds = users.map(u => u._id);

  const leaveTypes = await LeaveType.find({ status: 'Active' });
  const balances = await LeaveBalance.find({
    user_id: { $in: userIds },
    year: targetYear
  });

  const utilizationList = leaveTypes.map(lt => {
    const typeBalances = balances.filter(b => b.leave_type_id.toString() === lt._id.toString());
    const totalOpening = typeBalances.reduce((sum, b) => sum + (b.opening || 0), 0);
    const totalAccrued = typeBalances.reduce((sum, b) => sum + (b.accrued || 0), 0);
    const totalUsed = typeBalances.reduce((sum, b) => sum + (b.used || 0), 0);
    const totalPending = typeBalances.reduce((sum, b) => sum + (b.pending || 0), 0);
    const totalAllocated = totalOpening + totalAccrued;
    const utilizationPct = totalAllocated > 0 ? Number(((totalUsed / totalAllocated) * 100).toFixed(2)) : 0;

    return {
      leave_type_id: lt._id,
      leave_type_name: lt.name,
      leave_type_code: lt.code,
      year: targetYear,
      is_paid: lt.is_paid,
      total_quota_allocated: totalAllocated,
      total_used: totalUsed,
      total_pending: totalPending,
      utilization_percentage: utilizationPct
    };
  });

  return utilizationList;
};

/**
 * 5. Monthly Short Leave Usage Report
 */
const aggregateShortLeaveUsage = async ({ year, month, department_id } = {}) => {
  const targetYear = year ? Number(year) : new Date().getFullYear();
  const targetMonth = month ? Number(month) : new Date().getMonth() + 1;

  const shortLeaveType = await LeaveType.findOne({ code: 'SHORT_LEAVE' });
  if (!shortLeaveType) return [];

  const userFilter = { status: 'Active' };
  if (department_id) userFilter.department_id = department_id;
  const users = await User.find(userFilter)
    .select('employee_code name department_id designation_id')
    .populate('department_id', 'name code')
    .populate('designation_id', 'name');

  const userIds = users.map(u => u._id);

  const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

  const shortLeaveRequests = await LeaveRequest.find({
    user_id: { $in: userIds },
    leave_type_id: shortLeaveType._id,
    from_date: { $gte: startDate, $lte: endDate },
    status: { $in: ['Approved', 'Pending'] }
  });

  const usageMap = {};
  users.forEach(u => {
    usageMap[u._id.toString()] = {
      user_id: u._id,
      employee_code: u.employee_code,
      name: u.name,
      department: u.department_id?.name || 'N/A',
      designation: u.designation_id?.name || 'N/A',
      year: targetYear,
      month: targetMonth,
      monthly_quota: shortLeaveType.quota || 2,
      used_count: 0,
      pending_count: 0,
      total_minutes_used: 0,
      applications: []
    };
  });

  shortLeaveRequests.forEach(req => {
    const uKey = req.user_id.toString();
    if (usageMap[uKey]) {
      const entry = usageMap[uKey];
      if (req.status === 'Approved') {
        entry.used_count++;
      } else if (req.status === 'Pending') {
        entry.pending_count++;
      }

      // Calculate minutes if from_time and to_time exist
      let minutes = 0;
      if (req.from_time && req.to_time) {
        const [fh, fm] = req.from_time.split(':').map(Number);
        const [th, tm] = req.to_time.split(':').map(Number);
        minutes = Math.max(0, (th * 60 + tm) - (fh * 60 + fm));
      }
      entry.total_minutes_used += minutes;

      entry.applications.push({
        id: req._id,
        date: req.from_date_formatted || formatDate(req.from_date),
        time: `${req.from_time || ''} - ${req.to_time || ''}`,
        minutes,
        reason: req.reason,
        status: req.status
      });
    }
  });

  return Object.values(usageMap);
};

/**
 * 6. LOP Days Report
 */
const aggregateLopReport = async ({ cycle_id } = {}) => {
  const filter = {};
  if (cycle_id) filter.cycle_id = cycle_id;

  const runs = await PayrollRun.find(filter)
    .populate('user_id', 'employee_code name department_id designation_id')
    .populate('cycle_id', 'month year cut_off pay_date total_days');

  return runs.map(r => ({
    run_id: r._id,
    user_id: r.user_id?._id,
    employee_code: r.user_id?.employee_code || 'N/A',
    name: r.user_id?.name || 'N/A',
    cycle: r.cycle_id ? `${r.cycle_id.month}/${r.cycle_id.year}` : 'N/A',
    total_days: r.cycle_id?.total_days || 30,
    absent_days: r.absent_days || 0,
    unpaid_leave_days: r.unpaid_leave_days || 0,
    late_deduction_days: r.late_deduction_days || 0,
    lop_days: r.lop_days || 0,
    payable_days: r.payable_days || 0,
    status: r.status
  }));
};

/**
 * 7. Payroll Register Report
 */
const aggregatePayrollRegister = async ({ cycle_id } = {}) => {
  const filter = {};
  if (cycle_id) filter.cycle_id = cycle_id;

  const runs = await PayrollRun.find(filter)
    .populate({
      path: 'user_id',
      select: 'employee_code name email department_id designation_id branch_id bank_details',
      populate: [
        { path: 'department_id', select: 'name code' },
        { path: 'designation_id', select: 'name code' },
        { path: 'branch_id', select: 'name' }
      ]
    })
    .populate('cycle_id', 'month year cut_off pay_date total_days')
    .populate('structure_id');

  return runs.map(r => ({
    run_id: r._id,
    user_id: r.user_id?._id,
    employee_code: r.user_id?.employee_code || 'N/A',
    name: r.user_id?.name || 'N/A',
    email: r.user_id?.email || 'N/A',
    department: r.user_id?.department_id?.name || 'N/A',
    designation: r.user_id?.designation_id?.name || 'N/A',
    branch: r.user_id?.branch_id?.name || 'N/A',
    cycle: r.cycle_id ? `${r.cycle_id.month}/${r.cycle_id.year}` : 'N/A',
    payable_days: r.payable_days || 0,
    gross: r.gross || 0,
    earnings_total: r.earnings?.reduce((s, e) => s + (e.amount || 0), 0) || 0,
    deductions_total: r.deductions?.reduce((s, d) => s + (d.amount || 0), 0) || 0,
    net_pay: r.net_pay || 0,
    status: r.status,
    bank_account_number: r.user_id?.bank_details?.account_number || 'N/A',
    bank_name: r.user_id?.bank_details?.bank_name || 'N/A',
    ifsc_code: r.user_id?.bank_details?.ifsc_code || 'N/A',
    bank_advice_ref: r.bank_advice_ref || 'N/A'
  }));
};

/**
 * 8. Audit Summary Report (Super Admin only)
 */
const aggregateAuditSummary = async ({ from, to, module } = {}) => {
  const filter = {};
  if (module) filter.module = module.toUpperCase();
  if (from || to) {
    filter.performed_at = {};
    if (from) filter.performed_at.$gte = new Date(from);
    if (to) filter.performed_at.$lte = new Date(to);
  }

  const logs = await AuditLog.find(filter)
    .populate('user_id', 'employee_code name email')
    .sort({ performed_at: -1 })
    .limit(500);

  const totalLogs = logs.length;
  const moduleCounts = {};
  const actionCounts = {};

  logs.forEach(l => {
    moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1;
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  });

  return {
    total_logs: totalLogs,
    module_breakdown: moduleCounts,
    action_breakdown: actionCounts,
    recent_logs: logs.slice(0, 100)
  };
};

/**
 * 9. Multi-Role Dashboard Counts Aggregator
 */
const aggregateDashboardCounts = async (user) => {
  const role = user.role_id;
  const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');
  const isCEO = role && role.code === 'CEO';
  const isCTO = role && role.code === 'CTO';

  const unreadNotifs = await Notification.countDocuments({
    user_id: user._id,
    channel: 'IN_APP',
    is_read: false
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = getTodayFormatted();

  if (isSuperAdmin) {
    // Super Admin: Full operational & security view
    const [
      pendingRegularizations,
      pendingLeaves,
      pendingSensitiveChanges,
      payrollStatusCounts,
      recentAuditLogs,
      activeEmployeesCount
    ] = await Promise.all([
      RegularizationRequest.countDocuments({ status: 'Pending' }),
      LeaveRequest.countDocuments({ status: 'Pending' }),
      SensitiveChangeRequest.countDocuments({ status: 'Pending' }),
      PayrollRun.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      AuditLog.find()
        .sort({ performed_at: -1 })
        .limit(20)
        .populate('user_id', 'name email employee_code'),
      User.countDocuments({ status: 'Active' })
    ]);

    const payrollRunsMap = {};
    payrollStatusCounts.forEach(c => {
      payrollRunsMap[c._id] = c.count;
    });

    return {
      role: 'SUPER_ADMIN',
      unread_notifications_count: unreadNotifs,
      total_active_employees: activeEmployeesCount,
      pending_approvals: {
        regularizations_count: pendingRegularizations,
        leaves_count: pendingLeaves,
        sensitive_changes_count: pendingSensitiveChanges
      },
      payroll_runs_by_status: payrollRunsMap,
      recent_system_activity: recentAuditLogs
    };
  }

  if (isCEO || isCTO) {
    // CEO / CTO: Executive operations & matrix approvals view
    const [
      pendingRequests,
      teamAttendanceToday,
      payrollPendingApprovalCount
    ] = await Promise.all([
      LeaveRequest.find({
        status: 'Pending',
        approvers: user._id
      })
        .populate('user_id', 'name employee_code email department_id designation_id')
        .populate('leave_type_id')
        .sort({ createdAt: -1 }),
      AttendanceDaily.aggregate([
        { $match: { date: { $gte: parseDate(todayStr), $lte: new Date(parseDate(todayStr).getTime() + 86400000 - 1) } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      PayrollRun.countDocuments({ status: 'Processed' })
    ]);

    const awaitingDecision = pendingRequests.filter((lr) => {
      const alreadyActed = lr.approvals.some(
        (a) => a.approver_id && a.approver_id.toString() === user._id.toString()
      );
      return !alreadyActed;
    });

    const attendanceBreakdown = {};
    teamAttendanceToday.forEach(a => {
      attendanceBreakdown[a._id] = a.count;
    });

    return {
      role: role.code,
      unread_notifications_count: unreadNotifs,
      pending_approvals_for_me: {
        total_count: awaitingDecision.length,
        items: awaitingDecision
      },
      team_attendance_today: {
        date: todayStr,
        breakdown: attendanceBreakdown
      },
      payroll_runs_pending_approval_count: payrollPendingApprovalCount
    };
  }

  // Standard Employee: Self-service view
  const [
    leaveBalances,
    lateSummary,
    pendingLeavesCount,
    pendingRegularizationsCount
  ] = await Promise.all([
    LeaveBalance.find({
      user_id: user._id,
      year: currentYear,
      month: currentMonth
    }).populate('leave_type_id', 'name code is_paid quota'),
    LateMonthlySummary.findOne({
      user_id: user._id,
      year: currentYear,
      month: currentMonth
    }),
    LeaveRequest.countDocuments({
      user_id: user._id,
      status: 'Pending'
    }),
    RegularizationRequest.countDocuments({
      user_id: user._id,
      status: 'Pending'
    })
  ]);

  return {
    role: 'EMPLOYEE',
    unread_notifications_count: unreadNotifs,
    leave_balance_summary: leaveBalances.map(b => ({
      leave_type: b.leave_type_id?.name || 'N/A',
      code: b.leave_type_id?.code || 'N/A',
      is_paid: b.leave_type_id?.is_paid,
      available: b.available,
      used: b.used,
      pending: b.pending
    })),
    late_status_this_month: {
      year: currentYear,
      month: currentMonth,
      late_count: lateSummary?.late_count || 0,
      allowed: lateSummary?.allowed || 3,
      extra_lates: lateSummary?.extra_lates || 0,
      deduction_days: lateSummary?.deduction_days || 0
    },
    my_pending_requests: {
      leaves_count: pendingLeavesCount,
      regularizations_count: pendingRegularizationsCount
    }
  };
};

module.exports = {
  aggregateAttendanceSummary,
  aggregateLeaveBalanceSummary,
  aggregateLeaveLedgerReport,
  aggregateLeaveUtilization,
  aggregateShortLeaveUsage,
  aggregateLopReport,
  aggregatePayrollRegister,
  aggregateAuditSummary,
  aggregateDashboardCounts
};
