const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
  role_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Role', 
    required: true 
  },
  permission_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Permission', 
    required: true 
  },
  allowed: { 
    type: Boolean, 
    default: false 
  },
  scope: { 
    type: String, 
    enum: ['OWN', 'DEPT', 'ALL', 'MATRIX', 'N/A', 'NO'], 
    default: 'NO' 
  }
}, { timestamps: true });

rolePermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true });

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
