const mongoose = require('mongoose');

const employeeSalaryStructureSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    effective_from: {
      type: Date,
      required: true
    },
    basic: {
      type: Number,
      required: true,
      min: [0, 'Basic salary cannot be negative']
    },
    components: [
      {
        component_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'SalaryComponent',
          required: true
        },
        value: {
          type: Number,
          required: true,
          default: 0
        }
      }
    ],
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

// Index for fast query of effective structure historical lookup
employeeSalaryStructureSchema.index({ user_id: 1, effective_from: -1 });

module.exports = mongoose.model('EmployeeSalaryStructure', employeeSalaryStructureSchema);
