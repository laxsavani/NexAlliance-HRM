const mongoose = require('mongoose');

const salaryComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Component name is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['EARNING', 'DEDUCTION'],
      required: [true, 'Component type is required (EARNING | DEDUCTION)']
    },
    calc_type: {
      type: String,
      enum: ['FIXED', 'PERCENT_OF_BASIC', 'FORMULA'],
      required: [true, 'Calculation type is required (FIXED | PERCENT_OF_BASIC | FORMULA)']
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: 0 // number for FIXED/PERCENT, string formula for FORMULA
    },
    taxable: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SalaryComponent', salaryComponentSchema);
