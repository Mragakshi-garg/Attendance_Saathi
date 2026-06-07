'use strict';

const express = require('express');
const { detectAndEncode, compareFace, encodeFromPhoto, checkHealth } = require('../services/faceService');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── GET /health — Check Python face service health ─────────────────────────
router.get('/health', async (_req, res) => {
  try {
    const data = await checkHealth();
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(503).json({ success: false, error: err.message });
  }
});

// ─── POST /detect — Detect faces in a base64 image ─────────────────────────
router.post('/detect', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ success: false, error: 'Missing image' });
    }

    const faces = await detectAndEncode(image);

    return res.json({
      success: true,
      faces: faces || [],
    });
  } catch (err) {
    console.error('[Face] Detect error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /compare — Compare a face encoding against known encodings ────────
router.post('/compare', async (req, res) => {
  try {
    const { encoding, known_encodings, known_ids } = req.body;

    if (!encoding || !known_encodings || !known_ids) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await compareFace(encoding, known_encodings, known_ids);
    return res.json(result);
  } catch (err) {
    console.error('[Face] Compare error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /encode — Encode a face from an uploaded photo ────────────────────
router.post('/encode', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No photo uploaded' });
    }

    const result = await encodeFromPhoto(req.file.buffer);
    return res.json(result);
  } catch (err) {
    console.error('[Face] Encode error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
