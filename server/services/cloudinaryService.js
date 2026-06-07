'use strict';

const cloudinary = require('../config/cloudinary');

// ─── Upload base64 face image to Cloudinary ─────────────────────────────────
async function uploadFaceImage(base64Image) {
  // Ensure the base64 string has the data URI prefix
  const dataUri = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'faceattend/faces/',
    resource_type: 'image',
    transformation: [
      { width: 400, height: 400, crop: 'limit' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

// ─── Delete face image from Cloudinary ──────────────────────────────────────
async function deleteFaceImage(publicId) {
  if (!publicId) return null;
  const result = await cloudinary.uploader.destroy(publicId);
  return result;
}

module.exports = { uploadFaceImage, deleteFaceImage };
