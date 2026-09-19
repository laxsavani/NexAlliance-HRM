const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Role name is required'], 
    unique: true, 
    trim: true 
  },
  code: { 
    type: String, 
    required: [true, 'Role code is required'], 
    unique: true, 
    uppercase: true, 
    trim: true 
  },
  is_system: { 
    type: Boolean, 
    default: false 
  },
  is_super_admin: { 
    type: Boolean, 
    default: false 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
