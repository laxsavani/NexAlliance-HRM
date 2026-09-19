const mongoose = require('mongoose');
const { formatDate } = require('../utils/dateUtils');

const attendanceDailySchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'User ID is required'] 
  },
  date: { 
    type: Date, 
    required: [true, 'Date is required'] // Normalized to midnight UTC (00:00:00.000Z)
  },
  first_in: { 
    type: Date, 
    default: null 
  },
  last_out: { 
    type: Date, 
    default: null 
  },
  work_minutes: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: [
      'Present', 
      'Half Day', 
      'Absent', 
      'Leave', 
      'Holiday', 
      'Week Off', 
      'Late', 
      'Incomplete', 
      'Regularized'
    ], 
    default: 'Absent' 
  },
  is_late: { 
    type: Boolean, 
    default: false 
  },
  is_regularized: { 
    type: Boolean, 
    default: false 
  },
  remarks: { 
    type: String, 
    trim: true, 
    default: null 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// Unique index: one summary row per user per date
attendanceDailySchema.index({ user_id: 1, date: 1 }, { unique: true });
attendanceDailySchema.index({ date: 1, status: 1 });

// Virtual formatted date (DD/MM/YYYY)
attendanceDailySchema.virtual('date_formatted').get(function() {
  return formatDate(this.date);
});

// Virtual work hours in readable format (e.g. "8 hrs 30 mins")
attendanceDailySchema.virtual('work_hours_display').get(function() {
  const hours = Math.floor(this.work_minutes / 60);
  const mins = this.work_minutes % 60;
  return `${hours} hrs ${mins} mins`;
});

module.exports = mongoose.model('AttendanceDaily', attendanceDailySchema);
