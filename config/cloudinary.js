const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djn7ivlo7',
  api_key: process.env.CLOUDINARY_API_KEY || '278376822492173',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'n7gWH7n3c1PP5l3ZmZtCUWMWUsA'
});

/**
 * Upload a file buffer directly to Cloudinary
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {string} folder - Target folder in Cloudinary (e.g. 'nexalliance_hrm/documents')
 * @param {string} publicId - Optional custom public ID
 * @returns {Promise<Object>} Cloudinary upload result containing secure_url
 */
const uploadToCloudinary = (buffer, folder = 'nexalliance_hrm/documents', publicId = null) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: 'auto', // Automatically detects images (jpg/png) vs raw docs (pdf)
      use_filename: true,
      unique_filename: true
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return reject(error);
        }
        resolve(result);
      }
    );

    const stream = Readable.from(buffer);
    stream.pipe(uploadStream);
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary
};
