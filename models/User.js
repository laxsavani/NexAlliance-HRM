const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { formatDate } = require('../utils/dateUtils');

const userSchema = new mongoose.Schema({
  employee_code: { 
    type: String, 
    required: [true, 'Employee code is required'], 
    unique: true, 
    uppercase: true, 
    trim: true 
  },
  name: { 
    type: String, 
    required: [true, 'Name is required'], 
    trim: true 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password_hash: { 
    type: String, 
    required: [true, 'Password is required'] 
  },
  role_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Role', 
    required: [true, 'Role is required'] 
  },
  department_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department',
    default: null
  },
  designation_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Designation',
    default: null
  },
  branch_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Branch',
    default: null
  },
  shift_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Shift',
    default: null 
  },
  dob: { 
    type: Date,
    default: null
  }, // Date of Birth (DD/MM/YYYY)
  date_of_joining: { 
    type: Date,
    default: Date.now 
  }, // Date of Joining (DD/MM/YYYY)
  salary: {
    type: Number,
    default: 0
  }, // Monthly Gross / CTC Salary
  phone: { 
    type: String, 
    trim: true 
  },
  address: { 
    type: String, 
    trim: true 
  },
  emergency_contact: { 
    type: String, 
    trim: true 
  },
  photo_url: { 
    type: String, 
    default: null 
  },
  attendance_exempt: { 
    type: Boolean, 
    default: false 
  }, // true for Super Admin

  // --- Bank Details ---
  bank_details: {
    account_holder_name: { type: String, trim: true },
    account_number: { type: String, trim: true },
    bank_name: { type: String, trim: true },
    ifsc_code: { type: String, uppercase: true, trim: true },
    branch_name: { type: String, trim: true },
    upi_id: { type: String, trim: true }
  },

  // --- Identity & KYC Documents (Aadhaar, PAN) ---
  identity_documents: {
    aadhar_number: { type: String, trim: true },
    aadhar_card_url: { type: String, default: null },
    pan_number: { type: String, uppercase: true, trim: true },
    pan_card_url: { type: String, default: null }
  },

  // --- Educational Documents (10th, 12th/Diploma, Graduation) ---
  education_documents: {
    tenth_marksheet_url: { type: String, default: null },
    twelfth_marksheet_url: { type: String, default: null },
    diploma_marksheet_url: { type: String, default: null },
    graduation_certificate_url: { type: String, default: null },
    other_documents: [{
      title: { type: String, trim: true },
      file_url: { type: String, required: true }
    }]
  },

  status: { 
    type: String, 
    enum: ['Active', 'Inactive'], 
    default: 'Active' 
  },

  // --- Module 8: Security & Encryption Additions ---
  bank_account_enc: { 
    type: String, 
    default: null 
  }, // AES-256-GCM ciphertext
  pan_enc: { 
    type: String, 
    default: null 
  }, // AES-256-GCM ciphertext
  aadhaar_enc: { 
    type: String, 
    default: null 
  }, // AES-256-GCM ciphertext
  two_fa_enabled: { 
    type: Boolean, 
    default: false 
  },
  two_fa_secret_enc: { 
    type: String, 
    default: null 
  }, // AES-256-GCM encrypted TOTP secret
  failed_login_count: { 
    type: Number, 
    default: 0 
  },
  locked_until: { 
    type: Date, 
    default: null 
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true, 
    getters: true,
    transform: function(doc, ret) {
      delete ret.password_hash;
      delete ret.two_fa_secret_enc;
      delete ret.__v;
      
      // Serialization masking by default (unless unmasked explicitly by caller)
      if (!ret._unmasked) {
        if (ret.bank_details && ret.bank_details.account_number) {
          const acc = String(ret.bank_details.account_number);
          ret.bank_details.account_number = acc.length > 4 
            ? 'X'.repeat(acc.length - 4) + acc.slice(-4) 
            : 'XXXX' + acc;
        }
        if (ret.identity_documents && ret.identity_documents.pan_number) {
          const pan = String(ret.identity_documents.pan_number);
          ret.identity_documents.pan_number = pan.length === 10
            ? 'XXXXX' + pan.slice(5, 9) + 'X'
            : 'XXXXX' + pan.slice(-4);
        }
        if (ret.identity_documents && ret.identity_documents.aadhar_number) {
          const aadhar = String(ret.identity_documents.aadhar_number).replace(/\s+/g, '');
          ret.identity_documents.aadhar_number = aadhar.length > 4
            ? 'X'.repeat(aadhar.length - 4) + aadhar.slice(-4)
            : 'XXXXXXXX' + aadhar;
        }
      }
      delete ret._unmasked;
      return ret;
    }
  },
  toObject: { 
    virtuals: true, 
    getters: true 
  }
});

// Virtual field for DD/MM/YYYY formatted Date of Birth
userSchema.virtual('dob_formatted').get(function() {
  return formatDate(this.dob);
});

// Virtual field for DD/MM/YYYY formatted Date of Joining
userSchema.virtual('doj_formatted').get(function() {
  return formatDate(this.date_of_joining);
});

// Method to verify password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

// Static method to hash password
userSchema.statics.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

module.exports = mongoose.model('User', userSchema);
