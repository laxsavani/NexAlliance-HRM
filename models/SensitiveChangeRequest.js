const mongoose = require('mongoose');

const sensitiveChangeRequestSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  field: { 
    type: String, 
    enum: ['bank_account', 'pan', 'aadhaar'], 
    required: true 
  },
  new_value_enc: { 
    type: String, 
    required: true 
  }, // Encrypted at submission time with AES-256-GCM, never stored plain
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  decided_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  decision_remark: { 
    type: String, 
    default: null 
  },
  decided_at: { 
    type: Date, 
    default: null 
  }
}, { timestamps: true });

sensitiveChangeRequestSchema.index({ user_id: 1, status: 1 });
sensitiveChangeRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SensitiveChangeRequest', sensitiveChangeRequestSchema);
