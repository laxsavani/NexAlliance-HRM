const mongoose = require('mongoose');

const leaveLedgerSchema = new mongoose.Schema({
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
  date: {
    type: Date,
    default: Date.now
  },
  txn_type: {
    type: String,
    enum: ['ACCRUAL', 'USED', 'LAPSED', 'ADJUSTED', 'RELEASED'],
    required: [true, 'Transaction type is required']
  },
  qty: {
    type: Number,
    required: [true, 'Quantity is required'] // Positive for credit, negative for debit
  },
  ref_id: {
    type: mongoose.Schema.Types.ObjectId,
    default: null // LeaveRequest ID when applicable
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator User ID is required']
  },
  remarks: {
    type: String,
    trim: true,
    default: null
  }
}, { timestamps: true });

leaveLedgerSchema.index({ user_id: 1, leave_type_id: 1, date: -1 });

module.exports = mongoose.model('LeaveLedger', leaveLedgerSchema);
