const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  module: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true 
  },
  action: { 
    type: String, 
    required: true, 
    uppercase: true, 
    trim: true 
  },
  old_value: { 
    type: mongoose.Schema.Types.Mixed, 
    default: null 
  },
  new_value: { 
    type: mongoose.Schema.Types.Mixed, 
    default: null 
  },
  ip: { 
    type: String, 
    default: null 
  },
  user_agent: {
    type: String,
    default: null
  },
  performed_at: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

auditLogSchema.index({ user_id: 1, performed_at: -1 });
auditLogSchema.index({ module: 1, action: 1 });

// Helper to record an audit log entry
auditLogSchema.statics.record = async function(userId, module, action, oldValue, newValue, req = null) {
  try {
    let ip = null;
    let userAgent = null;
    if (req) {
      ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
      userAgent = req.headers['user-agent'] || null;
      req._auditLogged = true; // Mark request as manually logged to prevent double-logging by global middleware
    }
    return await this.create({
      user_id: userId,
      module,
      action,
      old_value: oldValue,
      new_value: newValue,
      ip,
      user_agent: userAgent
    });
  } catch (err) {
    console.error('⚠️ AuditLog record error (non-fatal):', err.message);
    return null;
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
