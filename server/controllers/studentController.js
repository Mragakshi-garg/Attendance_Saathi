'use strict';

const User = require('../models/User');
const FaceProfile = require('../models/FaceProfile');
const Attendance = require('../models/Attendance');
const { sanitizeInput } = require('../utils/helpers');

// ─── GET /all/list — Public lightweight list ────────────────────────────────
async function listAll(_req, res) {
  
  try {
    console.log("NEW LISTALL RUNNING");
    const faceProfiles = await FaceProfile.find({})
      .populate('userId', 'name rollNumber')
      .lean();

    const data = faceProfiles.map((fp) => ({
      id: fp.userId?._id,
      name: fp.userId?.name || 'Unknown',
      roll_number: fp.userId?.rollNumber || '',
      encoding: fp.faceEncoding || [],
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[Students] List all error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error.',
    });
  }
}

// ─── GET / — Paginated list with search ─────────────────────────────────────
async function list(req, res) {
  try {
    const { q } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const filter = { role: 'student' };

    if (q && q.trim()) {
      const search = q.trim();
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { rollNumber: regex },
        { email: regex },
        { department: regex },
      ];
    }

    const [total, students] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Transform to match old response format
    const data = students.map((s) => ({
      id: s._id,
      name: s.name,
      roll_number: s.rollNumber,
      email: s.email,
      department: s.department,
      photo: s.photo,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }));

    return res.json({
      success: true,
      data: {
        students: data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Students] List error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /:id ───────────────────────────────────────────────────────────────
async function getById(req, res) {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' })
      .select('-password')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const data = {
      id: student._id,
      name: student.name,
      roll_number: student.rollNumber,
      email: student.email,
      department: student.department,
      photo: student.photo,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
    };

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Students] Get error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST / — Create student ────────────────────────────────────────────────
async function create(req, res) {
  try {
    const { name, roll_number, email, department, photo, encoding } = req.body;

    // Validate required fields
    const missing = [];
    if (!name) missing.push('name');
    if (!roll_number) missing.push('roll_number');
    if (!email) missing.push('email');
    if (!department) missing.push('department');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // Check for duplicate email
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'A user with this email already exists.',
      });
    }

    // Check for duplicate roll number
    const existingRoll = await User.findOne({ rollNumber: roll_number });
    if (existingRoll) {
      return res.status(409).json({
        success: false,
        error: 'A student with this roll number already exists.',
      });
    }

    // Create the student user
    const student = new User({
      name: sanitizeInput(name),
      email: email.toLowerCase().trim(),
      password: roll_number, // default password = roll number (changeable later)
      department: sanitizeInput(department),
      rollNumber: sanitizeInput(roll_number),
      role: 'student',
      verified: true, // admin-created students are auto-verified
      photo: photo || null,
    });

    await student.save();

    // If encoding is provided, create a FaceProfile
    if (encoding) {
      let faceEncoding;

      if (typeof encoding === 'string') {
        // Try parsing as JSON array first, then as base64 buffer
        try {
          faceEncoding = JSON.parse(encoding);
        } catch {
          // base64-encoded encoding — decode to float array
          const buf = Buffer.from(encoding, 'base64');
          faceEncoding = [];
          for (let i = 0; i < buf.length; i += 8) {
            faceEncoding.push(buf.readDoubleLE(i));
          }
        }
      } else if (Array.isArray(encoding)) {
        faceEncoding = encoding;
      }

      if (faceEncoding && faceEncoding.length === 512) {
        await FaceProfile.create({
          userId: student._id,
          faceEncoding,
        });
      }
    }

    const data = {
      id: student._id,
      name: student.name,
      roll_number: student.rollNumber,
      email: student.email,
      department: student.department,
      photo: student.photo,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
    };

    console.log(`[Students] Created student "${name}" (roll: ${roll_number})`);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0];
      return res.status(409).json({
        success: false,
        error: `Duplicate value for ${field}.`,
      });
    }
    console.error('[Students] Create error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── PUT /:id — Update student ──────────────────────────────────────────────
async function update(req, res) {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const allowedFields = ['name', 'email', 'department', 'photo'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = sanitizeInput(req.body[field]);
      }
    }

    // Handle roll_number separately (maps to rollNumber)
    if (req.body.roll_number !== undefined) {
      updates.rollNumber = sanitizeInput(req.body.roll_number);
    }

    if (Object.keys(updates).length === 0 && !req.body.encoding) {
      return res.status(400).json({ success: false, error: 'No fields to update.' });
    }

    Object.assign(student, updates);
    await student.save();

    // Update face encoding if provided
    if (req.body.encoding !== undefined) {
      let faceEncoding;

      if (req.body.encoding === null || req.body.encoding === '') {
        // Remove face profile
        await FaceProfile.deleteOne({ userId: student._id });
      } else {
        const encoding = req.body.encoding;

        if (typeof encoding === 'string') {
          try {
            faceEncoding = JSON.parse(encoding);
          } catch {
            const buf = Buffer.from(encoding, 'base64');
            faceEncoding = [];
            for (let i = 0; i < buf.length; i += 8) {
              faceEncoding.push(buf.readDoubleLE(i));
            }
          }
        } else if (Array.isArray(encoding)) {
          faceEncoding = encoding;
        }

        if (faceEncoding && faceEncoding.length === 512) {
          await FaceProfile.findOneAndUpdate(
            { userId: student._id },
            { faceEncoding },
            { upsert: true, new: true }
          );
        }
      }
    }

    const data = {
      id: student._id,
      name: student.name,
      roll_number: student.rollNumber,
      email: student.email,
      department: student.department,
      photo: student.photo,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
    };

    console.log(`[Students] Updated student id=${req.params.id}`);
    return res.json({ success: true, data });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0];
      return res.status(409).json({
        success: false,
        error: `A student with this ${field === 'rollNumber' ? 'roll number' : field} already exists.`,
      });
    }
    console.error('[Students] Update error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── DELETE /:id ────────────────────────────────────────────────────────────
async function remove(req, res) {
  try {
    const student = await User.findOne({ _id: req.params.id, role: 'student' });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    // Cascade delete: face profile + attendance records + user
    await Promise.all([
      FaceProfile.deleteOne({ userId: student._id }),
      Attendance.deleteMany({ userId: student._id }),
      User.deleteOne({ _id: student._id }),
    ]);

    console.log(`[Students] Deleted student "${student.name}" (id=${req.params.id})`);
    return res.json({
      success: true,
      data: { message: `Student "${student.name}" deleted successfully.` },
    });
  } catch (err) {
    console.error('[Students] Delete error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

module.exports = { listAll, list, getById, create, update, remove };
