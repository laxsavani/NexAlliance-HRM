const multer = require('multer');
const path = require('path');

// Memory storage engine for streaming uploads to Cloudinary
const storage = multer.memoryStorage();

// File filter (Images and PDFs)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type ${ext}. Allowed formats: JPG, PNG, WEBP, PDF`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Multi-document upload middleware for Employee onboarding and KYC
const employeeDocUpload = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'aadhar_card', maxCount: 1 },
  { name: 'pan_card', maxCount: 1 },
  { name: 'tenth_marksheet', maxCount: 1 },
  { name: 'twelfth_marksheet', maxCount: 1 },
  { name: 'diploma_marksheet', maxCount: 1 },
  { name: 'graduation_certificate', maxCount: 1 },
  { name: 'other_document', maxCount: 5 }
]);

module.exports = {
  upload,
  employeeDocUpload
};
