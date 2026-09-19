const mongoose = require('mongoose');

const attendancePunchSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'] 
  },
  time_utc: { 
    type: Date, 
    required: [true, 'Punch timestamp is required'],
    default: Date.now 
  },
  type: { 
    type: String, 
    enum: ['IN', 'OUT'], 
    required: [true, 'Punch type (IN/OUT) is required'] 
  },
  source: { 
    type: String, 
    enum: ['WEB', 'MOBILE', 'MANUAL', 'BIOMETRIC'], 
    default: 'WEB' 
  },
  lat: { 
    type: Number, 
    default: null 
  },
  lng: { 
    type: Number, 
    default: null 
  },
  device_info: { 
    type: String, 
    trim: true,
    default: null 
  }
}, { timestamps: true });

attendancePunchSchema.index({ user_id: 1, time_utc: 1 });

module.exports = mongoose.model('AttendancePunch', attendancePunchSchema);
