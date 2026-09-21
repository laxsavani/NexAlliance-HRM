const mongoose = require('mongoose');

const payrollCycleSchema = new mongoose.Schema(
  {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true
    },
    from_date: {
      type: Date,
      required: true
    },
    to_date: {
      type: Date,
      required: true
    },
    cut_off: {
      type: Date
    },
    pay_date: {
      type: Date
    },
    total_days: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

payrollCycleSchema.index({ year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('PayrollCycle', payrollCycleSchema);
