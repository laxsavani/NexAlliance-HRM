const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  date: { 
    type: Date, 
    required: [true, 'Holiday date is required'] 
  },
  name: { 
    type: String, 
    required: [true, 'Holiday name is required'], 
    trim: true 
  },
  type: { 
    type: String, 
    enum: ['HOLIDAY', 'WEEKLY_OFF'], 
    default: 'HOLIDAY' 
  },
  branch_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Branch', 
    default: null // null indicates all branches
  },
  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  }
}, { timestamps: true });

holidaySchema.index({ date: 1, branch_id: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
