'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  listAll,
  list,
  getById,
  create,
  update,
  remove,
} = require('../controllers/studentController');

const router = express.Router();

// ─── PUBLIC: GET /all/list — Lightweight list for dropdowns ─────────────────
router.get('/all/list', listAll);

// ── All routes below require authentication ─────────────────────────────────
router.use(authenticateToken);

// ─── GET / — Paginated list with search ─────────────────────────────────────
router.get('/', list);

// ─── GET /:id — Single student ──────────────────────────────────────────────
router.get('/:id', getById);

// ─── POST / — Create student ────────────────────────────────────────────────
router.post('/', create);

// ─── PUT /:id — Update student ──────────────────────────────────────────────
router.put('/:id', update);

// ─── DELETE /:id — Delete student ───────────────────────────────────────────
router.delete('/:id', remove);

module.exports = router;
