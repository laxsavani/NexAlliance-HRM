const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Designation name is required'], 
    trim: true 
  },
  code: { 
    type: String, 
    required: [true, 'Designation code is required'], 
    unique: true, 
    uppercase: true, 
    trim: true 
  },
  department_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department', 
    default: null 
  },
  level: { 
    type: Number, 
    default: 1 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Designation', designationSchema);
