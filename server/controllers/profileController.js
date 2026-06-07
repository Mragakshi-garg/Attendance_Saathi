'use strict';

const User = require('../models/User');
const FaceProfile = require('../models/FaceProfile');
const Attendance = require('../models/Attendance');
const { uploadFaceImage, deleteFaceImage } = require('../services/cloudinaryService');
const { detectAndEncode } = require('../services/faceService');

// ─── GET /api/profile — Get own profile ─────────────────────────────────────
async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const faceProfile = await FaceProfile.findOne({ userId: req.user.id });

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        rollNumber: user.rollNumber,
        role: user.role,
        verified: user.verified,
        photo: user.photo,
        cloudinaryUrl: faceProfile ? faceProfile.cloudinaryUrl : null,
        hasFaceProfile: !!faceProfile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error('[Profile] Get profile error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── PUT /api/profile — Update own name and department ──────────────────────
async function updateProfile(req, res) {
  try {
    const { name, department } = req.body;

    if (!name && !department) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (name, department) is required.',
      });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (department) updates.department = department.trim();

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    console.log(`[Profile] User "${user.name}" updated their profile.`);

    return res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        department: user.department,
        rollNumber: user.rollNumber,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('[Profile] Update profile error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /api/profile/attendance — Get own attendance history ────────────────
async function getMyAttendance(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { userId: req.user.id };

    // Optional date range filtering
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = req.query.startDate;
      if (req.query.endDate) filter.date.$lte = req.query.endDate;
    }

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        records,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('[Profile] Get attendance error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /api/profile/face — Upload face image and create encoding ─────────
async function uploadFace(req, res) {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: 'Base64 image is required in the "image" field.',
      });
    }

    // Step 1: Upload to Cloudinary
    const { url, publicId } = await uploadFaceImage(image);

    // Step 2: Get face encoding from the Python service
    let faces;
    try {
      faces = await detectAndEncode(image);
} catch (faceErr) {
  await deleteFaceImage(publicId);

  console.error('==============================');
  console.error('FACE DETECTION ERROR');
  console.error(faceErr);
  console.error('==============================');

  return res.status(422).json({
    success: false,
    error: faceErr.message,
  });
}

    if (!faces || faces.length === 0) {
      // Clean up the uploaded image if no face detected
      await deleteFaceImage(publicId);
      return res.status(400).json({
        success: false,
        error: 'No face detected in the image. Please upload a clear photo of your face.',
      });
    }

    if (faces.length > 1) {
      // Clean up the uploaded image if multiple faces detected
      await deleteFaceImage(publicId);
      return res.status(400).json({
        success: false,
        error: 'Multiple faces detected. Please upload a photo with only your face.',
      });
    }

    const encoding = faces[0].encoding;

    // Step 3: Upsert FaceProfile (delete old Cloudinary image if replacing)
    const existingProfile = await FaceProfile.findOne({ userId: req.user.id });
    if (existingProfile && existingProfile.cloudinaryPublicId) {
      await deleteFaceImage(existingProfile.cloudinaryPublicId);
    }

    const faceProfile = await FaceProfile.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        cloudinaryUrl: url,
        cloudinaryPublicId: publicId,
        faceEncoding: encoding,
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Step 4: Update user's photo with Cloudinary URL
    await User.findByIdAndUpdate(req.user.id, { photo: url });

    console.log(`[Profile] Face profile updated for user "${req.user.name || req.user.id}".`);

    return res.json({
      success: true,
      data: {
        message: 'Face profile uploaded successfully.',
        faceProfileId: faceProfile._id,
        cloudinaryUrl: url,
      },
    });
  } catch (err) {
    console.error('[Profile] Upload face error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

module.exports = { getProfile, updateProfile, getMyAttendance, uploadFace };
