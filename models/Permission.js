const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  module: { 
    type: String, 
    required: [true, 'Module is required'], 
    uppercase: true, 
    trim: true 
  }, // e.g. 'EMPLOYEE', 'ATTENDANCE', 'MASTERS', 'LEAVE'
  action: { 
    type: String, 
    required: [true, 'Action is required'], 
    uppercase: true, 
    trim: true 
  }, // e.g. 'VIEW', 'CREATE', 'EDIT', 'DELETE', 'CLOCK_IN'
  description: { 
    type: String, 
    trim: true 
  }
}, { timestamps: true });

permissionSchema.index({ module: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('Permission', permissionSchema);
