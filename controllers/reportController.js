const {
  aggregateAttendanceSummary,
  aggregateLeaveBalanceSummary,
  aggregateLeaveLedgerReport,
  aggregateLeaveUtilization,
  aggregateShortLeaveUsage,
  aggregateLopReport,
  aggregatePayrollRegister,
  aggregateAuditSummary
} = require('../utils/reportAggregations');
const { jsonToCSV, sendCSVResponse } = require('../utils/csvExportUtils');

/**
 * Access Control Helper: Super Admin, CEO, and CTO have ALL-scope access to reports; Employee 403
 */
const checkReportsRoleAccess = (user) => {
  const role = user.role_id;
  if (!role) return false;
  return role.is_super_admin === true || ['SUPER_ADMIN', 'CEO', 'CTO'].includes(role.code);
};

/**
 * @desc    Get Attendance Summary Report (JSON)
 * @route   GET /api/reports/attendance
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getAttendanceReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { from, to, branch_id, department_id, user_id } = req.query;
    const data = await aggregateAttendanceSummary({ from, to, branch_id, department_id, user_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Export Attendance Summary Report as CSV
 * @route   GET /api/reports/attendance/export
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const exportAttendanceReportCSV = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { from, to, branch_id, department_id, user_id } = req.query;
    const data = await aggregateAttendanceSummary({ from, to, branch_id, department_id, user_id });

    const columns = [
      { key: 'employee_code', label: 'Employee Code' },
      { key: 'name', label: 'Employee Name' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'branch', label: 'Branch' },
      { key: 'total_days_tracked', label: 'Tracked Days' },
      { key: 'present_days', label: 'Present Days' },
      { key: 'absent_days', label: 'Absent Days' },
      { key: 'half_days', label: 'Half Days' },
      { key: 'paid_leave_days', label: 'Paid Leave Days' },
      { key: 'unpaid_leave_days', label: 'Unpaid Leave Days' },
      { key: 'holiday_days', label: 'Holidays' },
      { key: 'weekly_off_days', label: 'Weekly Offs' },
      { key: 'late_count', label: 'Late Marks' },
      { key: 'total_work_minutes', label: 'Total Work Minutes' }
    ];

    const csvData = jsonToCSV(data, columns);
    const filename = `attendance_report_${from || 'all'}_to_${to || 'all'}`;
    sendCSVResponse(res, filename, csvData);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Leave Balance Report
 * @route   GET /api/reports/leave-balance
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getLeaveBalanceReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { year, month, department_id } = req.query;
    const data = await aggregateLeaveBalanceSummary({ year, month, department_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Leave Ledger History Report
 * @route   GET /api/reports/leave-ledger
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getLeaveLedgerReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { user_id, leave_type_id, from, to } = req.query;
    const data = await aggregateLeaveLedgerReport({ user_id, leave_type_id, from, to });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Leave Utilization Percentage Report
 * @route   GET /api/reports/leave-utilization
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getLeaveUtilizationReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { year, department_id } = req.query;
    const data = await aggregateLeaveUtilization({ year, department_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Monthly Short Leave Usage Report
 * @route   GET /api/reports/short-leave-usage
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getShortLeaveUsageReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { year, month, department_id } = req.query;
    const data = await aggregateShortLeaveUsage({ year, month, department_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Loss of Pay (LOP) Days Report
 * @route   GET /api/reports/lop
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getLopReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { cycle_id } = req.query;
    const data = await aggregateLopReport({ cycle_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Payroll Register Report (JSON)
 * @route   GET /api/reports/payroll-register
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const getPayrollRegisterReport = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { cycle_id } = req.query;
    const data = await aggregatePayrollRegister({ cycle_id });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Export Payroll Register Report as CSV
 * @route   GET /api/reports/payroll-register/export
 * @access  Private (SUPER_ADMIN / CEO / CTO)
 */
const exportPayrollRegisterCSV = async (req, res, next) => {
  try {
    if (!checkReportsRoleAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view or export reports'
      });
    }

    const { cycle_id } = req.query;
    const data = await aggregatePayrollRegister({ cycle_id });

    const columns = [
      { key: 'employee_code', label: 'Employee Code' },
      { key: 'name', label: 'Employee Name' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'branch', label: 'Branch' },
      { key: 'cycle', label: 'Payroll Cycle' },
      { key: 'payable_days', label: 'Payable Days' },
      { key: 'gross', label: 'Gross Salary' },
      { key: 'earnings_total', label: 'Total Earnings' },
      { key: 'deductions_total', label: 'Total Deductions' },
      { key: 'net_pay', label: 'Net Pay' },
      { key: 'status', label: 'Status' },
      { key: 'bank_name', label: 'Bank Name' },
      { key: 'bank_account_number', label: 'Bank Account' },
      { key: 'ifsc_code', label: 'IFSC Code' },
      { key: 'bank_advice_ref', label: 'Bank Advice Ref' }
    ];

    const csvData = jsonToCSV(data, columns);
    const filename = `payroll_register_${cycle_id || 'all'}`;
    sendCSVResponse(res, filename, csvData);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Audit Summary Report (SUPER_ADMIN ONLY)
 * @route   GET /api/reports/audit-summary
 * @access  Private (SUPER_ADMIN only)
 */
const getAuditSummaryReport = async (req, res, next) => {
  try {
    const role = req.user.role_id;
    const isSuperAdmin = role && (role.is_super_admin === true || role.code === 'SUPER_ADMIN');

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Super Admin permission required for audit reports'
      });
    }

    const { from, to, module } = req.query;
    const data = await aggregateAuditSummary({ from, to, module });

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAttendanceReport,
  exportAttendanceReportCSV,
  getLeaveBalanceReport,
  getLeaveLedgerReport,
  getLeaveUtilizationReport,
  getShortLeaveUsageReport,
  getLopReport,
  getPayrollRegisterReport,
  exportPayrollRegisterCSV,
  getAuditSummaryReport
};
