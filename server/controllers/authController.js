'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const OTP = require('../models/OTP');
const { sendOTPEmail } = require('../services/mailService');

const JWT_SECRET = process.env.JWT_SECRET || 'face-attendance-super-secret-key-2024';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_LIMIT_MINUTES = 2; // min wait between resends

// ─── Helper: generate 6-digit OTP ──────────────────────────────────────────
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

// ─── POST /register ─────────────────────────────────────────────────────────
async function register(req, res) {
  try {
    const { name, email, password, department, roll_number } = req.body;

    // Validate required fields
    const missing = [];
    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if (!roll_number) missing.push('roll_number');
    if (!department) missing.push('department');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.',
      });
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    // Check duplicate roll number
    const existingRoll = await User.findOne({ rollNumber: roll_number });
    if (existingRoll) {
      return res.status(409).json({
        success: false,
        error: 'A student with this roll number already exists.',
      });
    }

    // Create unverified student
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      department: department.trim(),
      rollNumber: roll_number.trim(),
      role: 'student',
      verified: false,
    });

    // Generate & send OTP
    const otpCode = generateOTP();
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Remove any previous OTPs for this email
    await OTP.deleteMany({ email: user.email });

    await OTP.create({
      email: user.email,
      otp: hashedOTP,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await sendOTPEmail(user.email, otpCode);

    console.log(`[Auth] New registration: "${name}" (${email})`);

    return res.status(201).json({
      success: true,
      data: {
        message: 'Registration successful. Please verify your email with the OTP sent.',
        email: user.email,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0];
      return res.status(409).json({
        success: false,
        error: `An account with this ${field === 'rollNumber' ? 'roll number' : field} already exists.`,
      });
    }
    console.error('[Auth] Register error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /send-otp ─────────────────────────────────────────────────────────
async function sendOTP(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with this email.' });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, error: 'This account is already verified.' });
    }

    // Rate limiting: check last OTP sent
    const recentOTP = await OTP.findOne({
      email: email.toLowerCase(),
      createdAt: { $gte: new Date(Date.now() - OTP_RATE_LIMIT_MINUTES * 60 * 1000) },
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${OTP_RATE_LIMIT_MINUTES} minutes before requesting a new OTP.`,
      });
    }

    // Generate & send
    const otpCode = generateOTP();
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    await OTP.deleteMany({ email: email.toLowerCase() });

    await OTP.create({
      email: email.toLowerCase(),
      otp: hashedOTP,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await sendOTPEmail(email, otpCode);

    return res.json({
      success: true,
      data: { message: 'OTP sent successfully.', email: email.toLowerCase() },
    });
  } catch (err) {
    console.error('[Auth] Send OTP error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /verify-otp ───────────────────────────────────────────────────────
async function verifyOTP(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
    }

    const otpDoc = await OTP.findOne({ email: email.toLowerCase() });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        error: 'No OTP found. Please request a new one.',
      });
    }

    // Check expiry
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please request a new one.',
      });
    }

    // Check max attempts
    if (otpDoc.attempts >= OTP_MAX_ATTEMPTS) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    // Verify OTP
    const valid = await bcrypt.compare(otp.toString(), otpDoc.otp);

    if (!valid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({
        success: false,
        error: `Invalid OTP. ${OTP_MAX_ATTEMPTS - otpDoc.attempts} attempts remaining.`,
      });
    }

    // Mark user as verified
    await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { verified: true }
    );

    // Clean up OTP
    await OTP.deleteOne({ _id: otpDoc._id });

    console.log(`[Auth] Email verified: ${email}`);

    return res.json({
      success: true,
      data: { message: 'Email verified successfully! You can now log in.' },
    });
  } catch (err) {
    console.error('[Auth] Verify OTP error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /login ────────────────────────────────────────────────────────────
async function login(req, res) {
  try {
    const { username, password, email } = req.body;
    const loginId = email || username;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username/email and password are required.',
      });
    }

    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { name: loginId },
      ],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    // Check if student is verified
    if (user.role === 'student' && !user.verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: user.email,
      });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    console.log(`[Auth] User "${user.name}" (${user.role}) logged in.`);

    return res.json({
      success: true,
      data: {
        id: user._id,
        username: user.name,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /logout ───────────────────────────────────────────────────────────
async function logout(_req, res) {
  res.clearCookie('token');
  return res.json({ success: true, data: { message: 'Logged out successfully.' } });
}

// ─── GET /verify (token check) ──────────────────────────────────────────────
async function verifyToken(req, res) {
  return res.json({
    success: true,
    data: {
      id: req.user.id,
      username: req.user.name,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
}

module.exports = { register, sendOTP, verifyOTP, login, logout, verifyToken };
