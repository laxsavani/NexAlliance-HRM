const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const AttendanceDaily = require('../models/AttendanceDaily');
const LateMonthlySummary = require('../models/LateMonthlySummary');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveLedger = require('../models/LeaveLedger');
const LeaveType = require('../models/LeaveType');
const EmployeeSalaryStructure = require('../models/EmployeeSalaryStructure');
const PayrollCycle = require('../models/PayrollCycle');
const PayrollRun = require('../models/PayrollRun');
const User = require('../models/User');
const { normalizeDate } = require('./attendanceService');

/**
 * Calculates Loss of Pay (LOP) and Payable Days for a user within a payroll cycle.
 * Formula:
 *   LOP Days = Absent days + Unpaid leave days + Late-policy deduction days
 *   Payable Days = Total Days in cycle (or prorated from join date) - LOP Days
 * Excluded from LOP: Short Leave, Paid Leave, Holidays, Weekly Offs, First 3 late marks
 * 
 * @param {ObjectId} userId 
 * @param {Object} cycle - PayrollCycle document
 * @returns {Promise<{ absent_days: number, unpaid_leave_days: number, late_deduction_days: number, lop_days: number, payable_days: number, short_leaves_used: number, late_marks_used: number, total_days: number }>}
 */
const calculateLOP = async (userId, cycle) => {
  const from = normalizeDate(cycle.from_date);
  const to = normalizeDate(cycle.to_date);

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // 1. Calculate effective total days in cycle (handle mid-cycle joining)
  let effectiveTotalDays = cycle.total_days;
  if (user.date_of_joining) {
    const doj = normalizeDate(user.date_of_joining);
    if (doj.getTime() > from.getTime() && doj.getTime() <= to.getTime()) {
      effectiveTotalDays = Math.floor((to.getTime() - doj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (doj.getTime() > to.getTime()) {
      effectiveTotalDays = 0; // Joined after this cycle
    }
  }

  // 2. Count Absent days in attendance
  const absentDays = await AttendanceDaily.countDocuments({
    user_id: userId,
    date: { $gte: from, $lte: to },
    status: 'Absent'
  });

  // 3. Count Unpaid Leave (LWP) days from LeaveLedger
  const lwpType = await LeaveType.findOne({ code: 'LWP' });
  let unpaidLeaveDays = 0;
  if (lwpType) {
    const lwpLedgers = await LeaveLedger.find({
      user_id: userId,
      leave_type_id: lwpType._id,
      txn_type: 'USED',
      date: { $gte: from, $lte: to }
    });
    unpaidLeaveDays = lwpLedgers.reduce((sum, item) => sum + Math.abs(item.qty), 0);
  }

  // 4. Retrieve Late-policy deduction days from Module 2 LateMonthlySummary
  const lateSummary = await LateMonthlySummary.findOne({
    user_id: userId,
    year: cycle.year,
    month: cycle.month
  });
  const lateDeductionDays = lateSummary?.deduction_days || 0;
  const lateMarksUsed = lateSummary?.late_count || 0;

  // 5. Short leaves used in month (for display, non-deductible)
  const shortLeaveType = await LeaveType.findOne({ code: 'SHORT_LEAVE' });
  let shortLeavesUsed = 0;
  if (shortLeaveType) {
    shortLeavesUsed = await LeaveRequest.countDocuments({
      user_id: userId,
      leave_type_id: shortLeaveType._id,
      status: 'Approved',
      from_date: { $gte: from, $lte: to }
    });
  }

  // 6. Compute Total LOP and Payable Days
  const lopDays = Number((absentDays + unpaidLeaveDays + lateDeductionDays).toFixed(2));
  const payableDays = Math.max(0, Number((effectiveTotalDays - lopDays).toFixed(2)));

  return {
    absent_days: absentDays,
    unpaid_leave_days: unpaidLeaveDays,
    late_deduction_days: lateDeductionDays,
    lop_days: lopDays,
    payable_days: payableDays,
    short_leaves_used: shortLeavesUsed,
    late_marks_used: lateMarksUsed,
    total_days: effectiveTotalDays
  };
};

/**
 * Resolves the effective salary structure for a user on a given date (latest effective_from <= date)
 * @param {ObjectId} userId 
 * @param {Date} targetDate 
 * @returns {Promise<Object>}
 */
const resolveSalaryStructure = async (userId, targetDate) => {
  const normDate = normalizeDate(targetDate);
  const structure = await EmployeeSalaryStructure.findOne({
    user_id: userId,
    effective_from: { $lte: normDate },
    status: 'Active'
  })
    .sort({ effective_from: -1 })
    .populate('components.component_id');

  if (structure) return structure;

  // Fallback to any active structure if effective_from is slightly ahead
  return await EmployeeSalaryStructure.findOne({
    user_id: userId,
    status: 'Active'
  })
    .sort({ effective_from: 1 })
    .populate('components.component_id');
};

/**
 * Computes the salary components, earnings, deductions, gross, and net pay for a user
 * @param {Object} user - User document
 * @param {Object} cycle - PayrollCycle document
 * @param {Object} structure - EmployeeSalaryStructure document
 * @returns {Promise<Object>}
 */
const computePayrollRun = async (user, cycle, structure) => {
  const lopStats = await calculateLOP(user._id, cycle);
  const baseTotalDays = lopStats.total_days || cycle.total_days || 30;
  const prorationFactor = baseTotalDays > 0 ? lopStats.payable_days / baseTotalDays : 0;

  const basicSalary = structure.basic || 0;
  const earnedBasic = Math.round(basicSalary * prorationFactor);

  const earnings = [];
  const deductions = [];

  // 1. Basic Earning
  earnings.push({
    component_id: null,
    name: 'Basic Salary',
    amount: earnedBasic
  });

  // 2. Process Components
  if (Array.isArray(structure.components)) {
    for (const item of structure.components) {
      const comp = item.component_id;
      if (!comp || comp.status !== 'Active') continue;

      const compVal = item.value || 0;
      let calculatedAmount = 0;

      if (comp.calc_type === 'FIXED') {
        calculatedAmount = comp.type === 'EARNING'
          ? Math.round(compVal * prorationFactor)
          : Math.round(compVal);
      } else if (comp.calc_type === 'PERCENT_OF_BASIC') {
        calculatedAmount = Math.round((earnedBasic * compVal) / 100);
      } else if (comp.calc_type === 'FORMULA') {
        calculatedAmount = Math.round(compVal * prorationFactor);
      }

      if (comp.type === 'EARNING') {
        earnings.push({
          component_id: comp._id,
          name: comp.name,
          amount: calculatedAmount
        });
      } else if (comp.type === 'DEDUCTION') {
        deductions.push({
          component_id: comp._id,
          name: comp.name,
          amount: calculatedAmount
        });
      }
    }
  }

  const gross = earnings.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDeductions = deductions.reduce((acc, curr) => acc + curr.amount, 0);
  const netPay = Math.max(0, gross - totalDeductions);

  return {
    ...lopStats,
    earnings,
    deductions,
    gross,
    net_pay: netPay
  };
};

/**
 * Checks if the payroll for the given date's month/cycle is locked (Approved, Released, or Paid)
 * @param {Date} date 
 * @returns {Promise<boolean>}
 */
const isPayrollMonthLocked = async (date) => {
  if (!date) return false;
  const normDate = normalizeDate(date);

  // Find cycle covering this date or matching year/month
  const year = normDate.getUTCFullYear();
  const month = normDate.getUTCMonth() + 1;

  const cycle = await PayrollCycle.findOne({
    $or: [
      { from_date: { $lte: normDate }, to_date: { $gte: normDate } },
      { year, month }
    ]
  });

  if (!cycle) return false;

  const lockedRunExists = await PayrollRun.exists({
    cycle_id: cycle._id,
    status: { $in: ['Approved', 'Released', 'Paid'] }
  });

  return Boolean(lockedRunExists);
};

/**
 * Generates and streams a professional PDF payslip
 * @param {Object} payrollRun - Populated PayrollRun document
 * @param {Object} res - Express Response object
 */
const generatePayslipPDF = (payrollRun, res) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=Payslip_${payrollRun.user_id?.employee_code || 'EMP'}_${payrollRun.cycle_id?.year}_${payrollRun.cycle_id?.month}.pdf`
  );

  doc.pipe(res);

  // --- Header ---
  doc.fontSize(20).fillColor('#1e293b').text('NEXALLIANCE IT SOLUTIONS', { align: 'center', bold: true });
  doc.fontSize(10).fillColor('#64748b').text('Enterprise Human Resource Management System', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#0f172a').text(`PAYSLIP FOR ${payrollRun.cycle_id?.month}/${payrollRun.cycle_id?.year}`, { align: 'center', underline: true });
  doc.moveDown(1);

  // --- Employee Info Box ---
  const startY = doc.y;
  doc.rect(40, startY, 515, 75).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(9);

  const u = payrollRun.user_id || {};
  doc.text(`Employee Code: ${u.employee_code || 'N/A'}`, 50, startY + 10);
  doc.text(`Employee Name: ${u.name || 'N/A'}`, 50, startY + 25);
  doc.text(`Email: ${u.email || 'N/A'}`, 50, startY + 40);
  doc.text(`Date of Joining: ${u.date_of_joining ? new Date(u.date_of_joining).toLocaleDateString('en-GB') : 'N/A'}`, 50, startY + 55);

  doc.text(`Department : ${u.department_id?.name || 'N/A'}`, 320, startY + 10);
  doc.text(`Designation: ${u.designation_id?.name || 'N/A'}`, 320, startY + 25);
  doc.text(`Bank A/C   : ${u.bank_details?.account_number ? '••••' + u.bank_details.account_number.slice(-4) : 'N/A'}`, 320, startY + 40);
  doc.text(`Status     : ${payrollRun.status}`, 320, startY + 55);

  doc.y = startY + 90;

  // --- Attendance & Leave Summary ---
  const attY = doc.y;
  doc.rect(40, attY, 515, 30).fillAndStroke('#f1f5f9', '#cbd5e1');
  doc.fillColor('#334155').fontSize(9);
  doc.text(`Total Cycle Days: ${payrollRun.cycle_id?.total_days || 30}`, 50, attY + 10);
  doc.text(`Payable Days: ${payrollRun.payable_days}`, 160, attY + 10);
  doc.text(`LOP Days: ${payrollRun.lop_days} (Absent: ${payrollRun.absent_days}, LWP: ${payrollRun.unpaid_leave_days}, Late: ${payrollRun.late_deduction_days})`, 250, attY + 10);

  doc.y = attY + 45;

  // --- Earnings & Deductions Tables ---
  const tableY = doc.y;
  const colWidth = 250;

  // Earnings Table
  doc.rect(40, tableY, colWidth, 20).fillAndStroke('#0284c7', '#0284c7');
  doc.fillColor('#ffffff').fontSize(10).text('EARNINGS', 45, tableY + 5);
  doc.text('AMOUNT (₹)', 210, tableY + 5);

  let curEarnY = tableY + 25;
  doc.fillColor('#0f172a').fontSize(9);
  for (const e of payrollRun.earnings || []) {
    doc.text(e.name, 45, curEarnY);
    doc.text(`₹ ${e.amount.toLocaleString('en-IN')}`, 210, curEarnY);
    curEarnY += 18;
  }

  // Deductions Table
  doc.rect(305, tableY, colWidth, 20).fillAndStroke('#e11d48', '#e11d48');
  doc.fillColor('#ffffff').fontSize(10).text('DEDUCTIONS', 310, tableY + 5);
  doc.text('AMOUNT (₹)', 475, tableY + 5);

  let curDeductY = tableY + 25;
  doc.fillColor('#0f172a').fontSize(9);
  for (const d of payrollRun.deductions || []) {
    doc.text(d.name, 310, curDeductY);
    doc.text(`₹ ${d.amount.toLocaleString('en-IN')}`, 475, curDeductY);
    curDeductY += 18;
  }

  const maxY = Math.max(curEarnY, curDeductY, tableY + 100);

  // Subtotal Bars
  doc.rect(40, maxY, colWidth, 20).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(9).text('Gross Earnings', 45, maxY + 5);
  doc.text(`₹ ${payrollRun.gross.toLocaleString('en-IN')}`, 210, maxY + 5);

  const totalDeduct = (payrollRun.deductions || []).reduce((s, d) => s + d.amount, 0);
  doc.rect(305, maxY, colWidth, 20).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#0f172a').fontSize(9).text('Total Deductions', 310, maxY + 5);
  doc.text(`₹ ${totalDeduct.toLocaleString('en-IN')}`, 475, maxY + 5);

  // --- Net Pay Highlight Box ---
  const netY = maxY + 35;
  doc.rect(40, netY, 515, 40).fillAndStroke('#dcfce7', '#86efac');
  doc.fillColor('#166534').fontSize(12).text('NET TAKE HOME PAY:', 50, netY + 14);
  doc.fontSize(14).text(`₹ ${payrollRun.net_pay.toLocaleString('en-IN')}`, 400, netY + 12, { bold: true });

  // --- Footer Notice ---
  doc.fontSize(8).fillColor('#94a3b8').text(
    'This is a system-generated payslip from NexAlliance HRM System and requires no physical signature.',
    40,
    760,
    { align: 'center' }
  );

  doc.end();
};

/**
 * Module 7 Forward Hook: Dispatches payslip release notification
 * @param {ObjectId} payrollRunId 
 */
const queuePayslipEmail = async (payrollRunId) => {
  try {
    const { sendNotification } = require('./notificationService');
    const PayrollRun = require('../models/PayrollRun');

    if (!payrollRunId) return;

    const run = await PayrollRun.findById(payrollRunId)
      .populate('user_id', 'name email employee_code')
      .populate('cycle_id', 'name month year');

    if (!run || !run.user_id) return;

    const context = {
      employee_name: run.user_id.name || 'Employee',
      employee_code: run.user_id.employee_code || '',
      month: run.cycle_id?.month || '',
      year: run.cycle_id?.year || '',
      cycle_name: run.cycle_id?.name || '',
      net_pay: run.net_pay,
      gross: run.gross,
      payable_days: run.payable_days
    };

    await sendNotification(run.user_id._id, 'PAYSLIP_RELEASED', context, run._id);
  } catch (err) {
    console.error('[queuePayslipEmail Error]:', err.message);
  }
};

module.exports = {
  calculateLOP,
  resolveSalaryStructure,
  computePayrollRun,
  isPayrollMonthLocked,
  generatePayslipPDF,
  queuePayslipEmail
};
