'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDatabase } = require('./config/db');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

// ─── App setup ──────────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

// ─── Security ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ─── Rate limiting ──────────────────────────────────────────────────────────
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/auth', authLimiter);

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// ─── Static files ───────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ─── API routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

// ─── SPA catch-all ──────────────────────────────────────────────────────────
const fs = require('fs');
const indexPath = path.join(publicDir, 'index.html');

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).json({ success: false, error: 'Not found.' });
});

// ─── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Connect to MongoDB first
    await connectDatabase();

    app.listen(PORT, () => {
      console.log('══════════════════════════════════════════════');
      console.log('  Face Attendance System — Server Running');
      console.log(`  http://localhost:${PORT}`);
      console.log('  Database: MongoDB Atlas');
      console.log('══════════════════════════════════════════════');
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();

// ─── Graceful shutdown ──────────────────────────────────────────────────────
const { disconnectDatabase } = require('./config/db');

process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] SIGTERM received, shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

module.exports = app;
