'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  register,
  sendOTP,
  verifyOTP,
  login,
  logout,
  verifyToken,
} = require('../controllers/authController');

const router = express.Router();

// ─── POST /register — Student self-registration ────────────────────────────
router.post('/register', register);

// ─── POST /send-otp — Resend OTP ───────────────────────────────────────────
router.post('/send-otp', sendOTP);

// ─── POST /verify-otp — Verify email OTP ────────────────────────────────────
router.post('/verify-otp', verifyOTP);

// ─── POST /login ────────────────────────────────────────────────────────────
router.post('/login', login);

// ─── POST /logout ───────────────────────────────────────────────────────────
router.post('/logout', logout);

// ─── GET /verify — Check token validity ─────────────────────────────────────
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;
