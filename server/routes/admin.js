'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getStats,
  getRecentActivity,
  getMonthlyStats,
  getDepartmentStats,
} = require('../controllers/adminController');

const router = express.Router();

// All admin routes require authentication
router.use(authenticateToken);

// ─── GET /stats — Dashboard statistics ──────────────────────────────────────
router.get('/stats', getStats);

// ─── GET /recent-activity — Recent attendance records ───────────────────────
router.get('/recent-activity', getRecentActivity);

// ─── GET /stats/monthly — Monthly trends ────────────────────────────────────
router.get('/stats/monthly', getMonthlyStats);

// ─── GET /stats/departments — Department-wise stats ─────────────────────────
router.get('/stats/departments', getDepartmentStats);

module.exports = router;
