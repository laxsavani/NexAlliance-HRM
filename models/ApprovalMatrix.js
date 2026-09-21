const mongoose = require('mongoose');

const approvalMatrixSchema = new mongoose.Schema(
  {
    requester_type: {
      type: String,
      enum: ['USER', 'DEPARTMENT', 'ROLE'],
      required: true
    },
    requester_ref: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
      // Refers dynamically to User._id, Department._id, or Role._id
    },
    module: {
      type: String,
      enum: ['LEAVE', 'REGULARIZATION'],
      required: true
    },
    level_no: {
      type: Number,
      default: 1
    },
    approvers: [
      {
        approver_type: {
          type: String,
          enum: ['USER', 'ROLE'],
          required: true
        },
        approver_ref: {
          type: mongoose.Schema.Types.ObjectId,
          required: true
          // Refers to User._id or Role._id
        }
      }
    ],
    rule: {
      type: String,
      enum: ['ALL', 'ANY'],
      default: 'ALL'
    },
    is_active: {
      type: Boolean,
      default: true
    },
    is_locked: {
      type: Boolean,
      default: false // True only for the seeded Regularization row
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring one configuration per requester entity per module
approvalMatrixSchema.index(
  { requester_type: 1, requester_ref: 1, module: 1 },
  { unique: true }
);

module.exports = mongoose.model('ApprovalMatrix', approvalMatrixSchema);
