const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  leave_type_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveType',
    required: [true, 'Leave Type ID is required']
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  month: {
    type: Number,
    default: null // 1-12 for monthly quota types (e.g. Short Leave), null for yearly types
  },
  opening: {
    type: Number,
    default: 0
  },
  accrued: {
    type: Number,
    default: 0
  },
  used: {
    type: Number,
    default: 0
  },
  pending: {
    type: Number,
    default: 0 // Quantity held while requests are pending approval
  },
  adjusted: {
    type: Number,
    default: 0
  },
  lapsed: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Unique compound index: one balance row per user per leave type per period
leaveBalanceSchema.index({ user_id: 1, leave_type_id: 1, year: 1, month: 1 }, { unique: true });

// Virtual available balance calculation
leaveBalanceSchema.virtual('available').get(function() {
  const totalCredited = (this.opening || 0) + (this.accrued || 0) + (this.adjusted || 0);
  const totalDebited = (this.used || 0) + (this.pending || 0) + (this.lapsed || 0);
  return Math.max(0, totalCredited - totalDebited);
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
