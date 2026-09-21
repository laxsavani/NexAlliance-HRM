const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    lowercase: true, 
    trim: true 
  },
  ip: { 
    type: String, 
    required: true 
  },
  success: { 
    type: Boolean, 
    required: true 
  },
  attempted_at: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

loginAttemptSchema.index({ email: 1, ip: 1, attempted_at: -1 });
loginAttemptSchema.index({ attempted_at: -1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
