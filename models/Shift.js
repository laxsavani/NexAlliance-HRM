const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Shift name is required'], 
    trim: true 
  },
  start_time: { 
    type: String, 
    default: '10:00', // Format: "HH:mm" (24h)
    trim: true 
  },
  end_time: { 
    type: String, 
    default: '18:30', // Format: "HH:mm" (24h)
    trim: true 
  },
  grace_in_min: { 
    type: Number, 
    default: 10 // Clock-in up to 10:10 AM is On-Time
  },
  monthly_late_allowed: { 
    type: Number, 
    default: 3 // First 3 late marks per month are allowed/free
  },
  late_action: { 
    type: String, 
    enum: ['FLAG', 'DEDUCT'], 
    default: 'DEDUCT' 
  },
  late_deduct_days: { 
    type: Number, 
    default: 0.5 // 0.5 days LOP deduction per extra late mark
  },
  half_day_hrs: { 
    type: Number, 
    default: 4 // Minimum working hours for Half Day
  },
  full_day_hrs: { 
    type: Number, 
    default: 8 // Minimum working hours for Full Day
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

module.exports = mongoose.model('Shift', shiftSchema);
