'use strict';

const fetch = require('node-fetch');
const FormData = require('form-data');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'https://face-attendance-python-1w3a.onrender.com';

// ─── POST /detect — Detect faces and return encodings ───────────────────────
async function detectAndEncode(base64Image) {
  const response = await fetch(`${PYTHON_SERVICE_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Face detection failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  return data.faces || [];
}

// ─── POST /compare — Compare encoding against known faces ───────────────────
async function compareFace(encoding, knownEncodings, knownIds) {
  const response = await fetch(`${PYTHON_SERVICE_URL}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encoding,
      known_encodings: knownEncodings,
      known_ids: knownIds,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Face comparison failed (${response.status}): ${errBody}`);
  }

  return response.json();
}

// ─── POST /encode — Encode face from photo buffer (multipart) ───────────────
async function encodeFromPhoto(photoBuffer) {
  const form = new FormData();
  form.append('photo', photoBuffer, {
    filename: 'photo.jpg',
    contentType: 'image/jpeg',
  });

  const response = await fetch(`${PYTHON_SERVICE_URL}/encode`, {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Face encoding failed (${response.status}): ${errBody}`);
  }

  return response.json();
}

// ─── GET /health — Check Python service health ─────────────────────────────
async function checkHealth() {
  const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
    method: 'GET',
    timeout: 5000,
  });

  if (!response.ok) {
    throw new Error(`Python service unhealthy (${response.status})`);
  }

  return response.json();
}

module.exports = { detectAndEncode, compareFace, encodeFromPhoto, checkHealth };
