'use strict';

const express = require('express');
const { authenticateToken, requireStudent } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  getMyAttendance,
  uploadFace,
} = require('../controllers/profileController');

const router = express.Router();

// ── All profile routes require authentication + student role ────────────────
router.use(authenticateToken, requireStudent);

// ─── GET / — Get own profile ────────────────────────────────────────────────
router.get('/', getProfile);

// ─── PUT / — Update own profile (name, department) ──────────────────────────
router.put('/', updateProfile);

// ─── GET /attendance — Get own attendance history ───────────────────────────
router.get('/attendance', getMyAttendance);

// ─── POST /face — Upload face image and create face profile ─────────────────
router.post('/face', uploadFace);

module.exports = router;
