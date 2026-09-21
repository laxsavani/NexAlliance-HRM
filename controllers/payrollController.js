const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { parseDate, formatDate } = require('../utils/dateUtils');
const { normalizeDate } = require('../services/attendanceService');
const {
  resolveSalaryStructure,
  computePayrollRun,
  generatePayslipPDF,
  queuePayslipEmail
} = require('../services/payrollService');

/**
 * @desc    Create Payroll Cycle
 * @route   POST /api/payroll/cycles
 * @access  Private (SUPER_ADMIN only)
 */
const createPayrollCycle = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can create payroll cycles'
      });
    }

    const { month, year, from_date, to_date, cut_off, pay_date } = req.body;

    if (!month || !year || !from_date || !to_date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide month (1-12), year, from_date, and to_date'
      });
    }

    const parsedFrom = parseDate(from_date);
    const parsedTo = parseDate(to_date);

    if (!parsedFrom || !parsedTo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format for from_date or to_date. Please use DD/MM/YYYY or YYYY-MM-DD'
      });
    }

    const normFrom = normalizeDate(parsedFrom);
    const normTo = normalizeDate(parsedTo);

    if (normFrom.getTime() > normTo.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'from_date cannot be later than to_date'
      });
    }

    const totalDays = Math.floor((normTo.getTime() - normFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const cycle = await PayrollCycle.findOneAndUpdate(
      { year: Number(year), month: Number(month) },
      {
        $set: {
          month: Number(month),
          year: Number(year),
          from_date: normFrom,
          to_date: normTo,
          cut_off: cut_off ? normalizeDate(parseDate(cut_off)) : null,
          pay_date: pay_date ? normalizeDate(parseDate(pay_date)) : null,
          total_days: totalDays
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'CREATE_PAYROLL_CYCLE',
      null,
      cycle,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Payroll cycle created successfully',
      data: cycle
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get all Payroll Cycles
 * @route   GET /api/payroll/cycles
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getPayrollCycles = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view payroll cycles'
      });
    }

    const { year } = req.query;
    const filter = {};
    if (year) filter.year = Number(year);

    const cycles = await PayrollCycle.find(filter).sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      count: cycles.length,
      data: cycles
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Process Payroll for a Cycle (Super Admin only, skips attendance_exempt users)
 * @route   POST /api/payroll/process
 * @access  Private (SUPER_ADMIN only)
 */
const processPayroll = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can trigger payroll processing'
      });
    }

    const { cycle_id } = req.body;
    if (!cycle_id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide cycle_id'
      });
    }

    const cycle = await PayrollCycle.findById(cycle_id);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: 'Payroll cycle not found'
      });
    }

    // Guard: Locked cycle cannot be processed without reopening
    const lockedRun = await PayrollRun.findOne({
      cycle_id: cycle._id,
      status: { $in: ['Approved', 'Released', 'Paid'] }
    });

    if (lockedRun) {
      return res.status(400).json({
        success: false,
        message: `This payroll cycle is locked with status [${lockedRun.status}]. You must reopen the cycle before re-processing.`
      });
    }

    // Fetch all active, non-attendance-exempt users (Super Admin excluded by default)
    const employees = await User.find({
      status: 'Active',
      attendance_exempt: { $ne: true }
    }).populate('department_id designation_id');

    const processedRuns = [];

    for (const emp of employees) {
      // Resolve applicable salary structure version
      let structure = await resolveSalaryStructure(emp._id, cycle.from_date);

      if (!structure) {
        // Create an initial fallback structure if none was explicitly configured
        structure = await EmployeeSalaryStructure.create({
          user_id: emp._id,
          effective_from: normalizeDate(emp.date_of_joining || cycle.from_date),
          basic: emp.salary || 30000,
          components: [],
          status: 'Active'
        });
      }

      const computed = await computePayrollRun(emp, cycle, structure);

      const run = await PayrollRun.findOneAndUpdate(
        { cycle_id: cycle._id, user_id: emp._id },
        {
          $set: {
            cycle_id: cycle._id,
            user_id: emp._id,
            structure_id: structure._id,
            absent_days: computed.absent_days,
            unpaid_leave_days: computed.unpaid_leave_days,
            late_deduction_days: computed.late_deduction_days,
            lop_days: computed.lop_days,
            payable_days: computed.payable_days,
            short_leaves_used: computed.short_leaves_used,
            late_marks_used: computed.late_marks_used,
            earnings: computed.earnings,
            deductions: computed.deductions,
            gross: computed.gross,
            net_pay: computed.net_pay,
            status: 'Processed'
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      processedRuns.push(run);
    }

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'PROCESS_PAYROLL_CYCLE',
      null,
      { cycle_id: cycle._id, employee_count: processedRuns.length },
      req
    );

    res.status(200).json({
      success: true,
      message: `Payroll processed successfully for ${processedRuns.length} employees`,
      cycle,
      count: processedRuns.length,
      data: processedRuns
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Payroll Runs for a Cycle
 * @route   GET /api/payroll/:cycleId/runs
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const getPayrollRuns = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to view payroll runs'
      });
    }

    const { cycleId } = req.params;
    const runs = await PayrollRun.find({ cycle_id: cycleId })
      .populate('user_id', 'name employee_code email department_id designation_id salary')
      .populate('cycle_id')
      .sort({ net_pay: -1 });

    res.status(200).json({
      success: true,
      count: runs.length,
      data: runs
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Single Payslip by Run ID (Scope Enforced)
 * @route   GET /api/payslips/:runId
 * @access  Private (SUPER_ADMIN / CEO / CTO: ALL; Employee: OWN only)
 */
const getPayslip = async (req, res, next) => {
  try {
    const { runId } = req.params;
    const run = await PayrollRun.findById(runId)
      .populate({
        path: 'user_id',
        select: 'name employee_code email department_id designation_id branch_id date_of_joining bank_details',
        populate: [
          { path: 'department_id', select: 'name code' },
          { path: 'designation_id', select: 'name code' }
        ]
      })
      .populate('cycle_id')
      .populate('structure_id');

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Payslip / Payroll run not found'
      });
    }

    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    // Scope check
    if (!isSuperAdmin && !isExec) {
      if (run.user_id._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You can only view your own payslip'
        });
      }
    }

    res.status(200).json({
      success: true,
      data: run
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Generate and Stream Payslip PDF
 * @route   GET /api/payslips/:runId/pdf
 * @access  Private (Released / Paid status required)
 */
const getPayslipPDF = async (req, res, next) => {
  try {
    const { runId } = req.params;
    const run = await PayrollRun.findById(runId)
      .populate({
        path: 'user_id',
        select: 'name employee_code email department_id designation_id branch_id date_of_joining bank_details',
        populate: [
          { path: 'department_id', select: 'name code' },
          { path: 'designation_id', select: 'name code' }
        ]
      })
      .populate('cycle_id')
      .populate('structure_id');

    if (!run) {
      return res.status(404).json({
        success: false,
        message: 'Payslip not found'
      });
    }

    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    // Scope check
    if (!isSuperAdmin && !isExec) {
      if (run.user_id._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You can only download your own payslip'
        });
      }
    }

    // Gate: PDF is only available once officially Released or Paid
    if (run.status !== 'Released' && run.status !== 'Paid') {
      return res.status(400).json({
        success: false,
        message: `Payslip PDF is not yet available for download. Current status is [${run.status}]. Payslips can be downloaded only after being Released.`
      });
    }

    generatePayslipPDF(run, res);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Approve Payroll Cycle (Super Admin / CEO / CTO: ALL scope)
 * @route   PUT /api/payroll/:cycleId/approve
 * @access  Private (SUPER_ADMIN, CEO, CTO)
 */
const approvePayrollCycle = async (req, res, next) => {
  try {
    const roleCode = req.user.role_id?.code || '';
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || roleCode === 'SUPER_ADMIN';
    const isExec = roleCode === 'CEO' || roleCode === 'CTO';

    if (!isSuperAdmin && !isExec) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You do not have permission to approve payroll'
      });
    }

    const { cycleId } = req.params;
    const cycle = await PayrollCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: 'Payroll cycle not found'
      });
    }

    const updated = await PayrollRun.updateMany(
      { cycle_id: cycleId, status: { $in: ['Draft', 'Processed'] } },
      { $set: { status: 'Approved', approved_by: req.user._id } }
    );

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'APPROVE_PAYROLL_CYCLE',
      null,
      { cycle_id: cycleId, modified_count: updated.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Payroll cycle approved successfully. ${updated.modifiedCount} employee runs locked.`,
      modified_count: updated.modifiedCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Release Payslips for a Cycle (Super Admin only)
 * @route   PUT /api/payroll/:cycleId/release
 * @access  Private (SUPER_ADMIN only)
 */
const releasePayrollCycle = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can release payslips'
      });
    }

    const { cycleId } = req.params;
    const cycle = await PayrollCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: 'Payroll cycle not found'
      });
    }

    const updated = await PayrollRun.updateMany(
      { cycle_id: cycleId, status: 'Approved' },
      { $set: { status: 'Released', released_at: new Date() } }
    );

    // Queue payslip release notification emails
    const releasedRuns = await PayrollRun.find({ cycle_id: cycleId, status: 'Released' });
    for (const r of releasedRuns) {
      await queuePayslipEmail(r._id);
    }

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'RELEASE_PAYROLL_CYCLE',
      null,
      { cycle_id: cycleId, modified_count: updated.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Payslips released successfully for ${updated.modifiedCount} employees`,
      modified_count: updated.modifiedCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Mark Payroll Cycle as Paid (Super Admin only)
 * @route   PUT /api/payroll/:cycleId/mark-paid
 * @access  Private (SUPER_ADMIN only)
 */
const markPaidPayrollCycle = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can mark payroll as paid'
      });
    }

    const { cycleId } = req.params;
    const { bank_advice_ref } = req.body;

    const cycle = await PayrollCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: 'Payroll cycle not found'
      });
    }

    const updated = await PayrollRun.updateMany(
      { cycle_id: cycleId, status: { $in: ['Approved', 'Released'] } },
      {
        $set: {
          status: 'Paid',
          paid_at: new Date(),
          bank_advice_ref: bank_advice_ref || `BANK-ADV-${Date.now()}`
        }
      }
    );

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'MARK_PAID_PAYROLL_CYCLE',
      null,
      { cycle_id: cycleId, bank_advice_ref, modified_count: updated.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Payroll marked as Paid for ${updated.modifiedCount} employees`,
      modified_count: updated.modifiedCount
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Reopen a Locked Payroll Cycle (Super Admin only, mandatory reason)
 * @route   PUT /api/payroll/:cycleId/reopen
 * @access  Private (SUPER_ADMIN only)
 */
const reopenPayrollCycle = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role_id?.is_super_admin === true || req.user.role_id?.code === 'SUPER_ADMIN';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can reopen a locked payroll cycle'
      });
    }

    const { cycleId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory reason is required to reopen a locked payroll cycle'
      });
    }

    const cycle = await PayrollCycle.findById(cycleId);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        message: 'Payroll cycle not found'
      });
    }

    const updated = await PayrollRun.updateMany(
      { cycle_id: cycleId },
      {
        $set: {
          status: 'Draft',
          approved_by: null,
          released_at: null,
          paid_at: null
        }
      }
    );

    await AuditLog.record(
      req.user._id,
      'PAYROLL',
      'REOPEN_PAYROLL_CYCLE',
      { status: 'Locked' },
      { status: 'Draft', reason: reason.trim(), modified_count: updated.modifiedCount },
      req
    );

    res.status(200).json({
      success: true,
      message: `Payroll cycle reopened successfully. Month is unlocked for ${updated.modifiedCount} employee runs.`,
      modified_count: updated.modifiedCount
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPayrollCycle,
  getPayrollCycles,
  processPayroll,
  getPayrollRuns,
  getPayslip,
  getPayslipPDF,
  approvePayrollCycle,
  releasePayrollCycle,
  markPaidPayrollCycle,
  reopenPayrollCycle
};
