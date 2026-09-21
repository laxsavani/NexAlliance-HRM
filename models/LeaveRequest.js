const mongoose = require('mongoose');
const { formatDate } = require('../utils/dateUtils');

const leaveApprovalSchema = new mongoose.Schema({
  approver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['APPROVE', 'REJECT'],
    required: true
  },
  remark: {
    type: String,
    trim: true,
    default: null
  },
  acted_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const leaveRequestSchema = new mongoose.Schema({
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
  from_date: {
    type: Date,
    required: [true, 'From date is required']
  },
  to_date: {
    type: Date,
    required: [true, 'To date is required']
  },
  day_part: {
    type: String,
    enum: ['FULL', 'FIRST_HALF', 'SECOND_HALF', 'SHORT'],
    default: 'FULL'
  },
  from_time: {
    type: String,
    default: null // e.g. "10:00" for Short Leave
  },
  to_time: {
    type: String,
    default: null // e.g. "11:30" for Short Leave
  },
  days: {
    type: Number,
    required: [true, 'Calculated leave days/units is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason for leave is required'],
    trim: true
  },
  attachment_url: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },
  approvers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // Snapshot of assigned approvers resolved at apply time
  approvals_needed: {
    type: Number,
    required: true,
    default: 2 // 2 for Employee (CEO+CTO), 1 for CEO/CTO cross-approval
  },
  approvals_done: {
    type: Number,
    default: 0
  },
  approvals: [leaveApprovalSchema],
  is_override: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

leaveRequestSchema.index({ user_id: 1, status: 1 });
leaveRequestSchema.index({ from_date: 1, to_date: 1 });

// Virtual formatted dates (DD/MM/YYYY)
leaveRequestSchema.virtual('from_date_formatted').get(function() {
  return formatDate(this.from_date);
});

leaveRequestSchema.virtual('to_date_formatted').get(function() {
  return formatDate(this.to_date);
});

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
