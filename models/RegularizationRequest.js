const mongoose = require('mongoose');
const { formatDate } = require('../utils/dateUtils');

const regularizationRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date to regularize is required']
  },
  req_in: {
    type: Date,
    required: [true, 'Requested In-Time is required']
  },
  req_out: {
    type: Date,
    required: [true, 'Requested Out-Time is required']
  },
  reason_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegularizationReason',
    required: [true, 'Reason ID is required']
  },
  remark: {
    type: String,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending'
  },
  decided_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  decision_remark: {
    type: String,
    trim: true,
    default: null
  },
  decided_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Index for efficient user + date queries and status filtering
regularizationRequestSchema.index({ user_id: 1, date: 1 });
regularizationRequestSchema.index({ status: 1 });

// Virtual formatted date (DD/MM/YYYY)
regularizationRequestSchema.virtual('date_formatted').get(function() {
  return formatDate(this.date);
});

module.exports = mongoose.model('RegularizationRequest', regularizationRequestSchema);
