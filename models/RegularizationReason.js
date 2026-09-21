const mongoose = require('mongoose');

const regularizationReasonSchema = new mongoose.Schema({
  reason: {
    type: String,
    required: [true, 'Regularization reason text is required'],
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, { timestamps: true });

module.exports = mongoose.model('RegularizationReason', regularizationReasonSchema);
