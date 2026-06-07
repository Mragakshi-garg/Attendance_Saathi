'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  mark,
  list,
  getToday,
  exportCSV,
} = require('../controllers/attendanceController');

const router = express.Router();

// ─── POST /mark — Public (called by face-recognition service) ───────────────
router.post('/mark', mark);

// ── All routes below require authentication ─────────────────────────────────
router.use(authenticateToken);

// ─── GET / — Filtered list with pagination ──────────────────────────────────
router.get('/', list);

// ─── GET /today — Today's summary ──────────────────────────────────────────
router.get('/today', getToday);

// ─── GET /export — CSV export ───────────────────────────────────────────────
router.get('/export', exportCSV);

module.exports = router;
