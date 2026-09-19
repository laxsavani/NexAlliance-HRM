const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Branch name is required'], 
    trim: true 
  },
  address: { 
    type: String, 
    trim: true 
  },
  latitude: { 
    type: Number 
  },
  longitude: { 
    type: Number 
  },
  radius_m: { 
    type: Number, 
    default: 200 
  },
  timezone: { 
    type: String, 
    default: 'Asia/Kolkata' 
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema);
