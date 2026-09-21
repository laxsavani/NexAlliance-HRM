const mongoose = require('mongoose');

const payrollRunSchema = new mongoose.Schema(
  {
    cycle_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayrollCycle',
      required: true
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    structure_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmployeeSalaryStructure',
      required: true
    },
    absent_days: {
      type: Number,
      default: 0
    },
    unpaid_leave_days: {
      type: Number,
      default: 0
    },
    late_deduction_days: {
      type: Number,
      default: 0
    },
    lop_days: {
      type: Number,
      default: 0
    },
    payable_days: {
      type: Number,
      required: true
    },
    short_leaves_used: {
      type: Number,
      default: 0
    },
    late_marks_used: {
      type: Number,
      default: 0
    },
    earnings: [
      {
        component_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SalaryComponent'
        },
        name: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 }
      }
    ],
    deductions: [
      {
        component_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SalaryComponent'
        },
        name: { type: String, required: true },
        amount: { type: Number, required: true, default: 0 }
      }
    ],
    gross: {
      type: Number,
      default: 0
    },
    net_pay: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['Draft', 'Processed', 'Approved', 'Released', 'Paid'],
      default: 'Draft'
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    released_at: {
      type: Date,
      default: null
    },
    paid_at: {
      type: Date,
      default: null
    },
    bank_advice_ref: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

payrollRunSchema.index({ cycle_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
