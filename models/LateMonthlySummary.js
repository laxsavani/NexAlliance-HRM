const mongoose = require('mongoose');

const lateMonthlySummarySchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'] 
  },
  year: { 
    type: Number, 
    required: [true, 'Year is required'] // e.g. 2026
  },
  month: { 
    type: Number, 
    required: [true, 'Month is required'], // 1-12
    min: 1,
    max: 12
  },
  late_count: { 
    type: Number, 
    default: 0 // Total late marks in this month
  },
  allowed: { 
    type: Number, 
    default: 3 // Free allowance (default 3)
  },
  extra_lates: { 
    type: Number, 
    default: 0 // Math.max(0, late_count - allowed)
  },
  deduction_days: { 
    type: Number, 
    default: 0 // Loss of Pay (LOP) deduction days (e.g. extra_lates * 0.5)
  }
}, { timestamps: true });

lateMonthlySummarySchema.index({ user_id: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('LateMonthlySummary', lateMonthlySummarySchema);
