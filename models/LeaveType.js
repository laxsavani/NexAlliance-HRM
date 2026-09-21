const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Leave type code is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Leave type name is required'],
    trim: true
  },
  is_paid: {
    type: Boolean,
    default: true
  },
  quota: {
    type: Number,
    default: 0 // 0 = unlimited / not capped (e.g. Unpaid Leave / LWP)
  },
  quota_period: {
    type: String,
    enum: ['MONTH', 'YEAR'],
    default: 'YEAR'
  },
  carry_forward: {
    type: Boolean,
    default: false
  },
  deduct_salary: {
    type: Boolean,
    default: false
  },
  max_duration_minutes: {
    type: Number,
    default: null // Used for Short Leave (e.g. 120 minutes)
  },
  half_day_allowed: {
    type: Boolean,
    default: true
  },
  needs_attachment: {
    type: Boolean,
    default: false
  },
  notice_days: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
