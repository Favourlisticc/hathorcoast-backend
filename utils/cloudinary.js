const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadToCloudinary = async (filePath, folder) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `agents/${folder}`
    });
    fs.unlinkSync(filePath); // Remove file from local storage
    return result;
  } catch (error) {
    fs.unlinkSync(filePath); // Remove file from local storage
    throw error;
  }
};

exports.removeFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    throw error;
  }
}; 