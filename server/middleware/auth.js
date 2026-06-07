'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'face-attendance-super-secret-key-2024';

/**
 * Express middleware that verifies a JWT token from:
 *   1. The `token` cookie (preferred)
 *   2. The `Authorization: Bearer <token>` header
 *
 * On success, attaches the decoded payload to `req.user`.
 * On failure, responds with 401 JSON.
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Try cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 2. Fall back to Authorization header
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.',
    });
  }
}

/**
 * Middleware factory: require one of the specified roles.
 * Must be used AFTER authenticateToken.
 *
 * Usage: router.get('/admin-only', authenticateToken, requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
}

/** Shorthand: admin-only middleware */
const requireAdmin = requireRole('admin');

/** Shorthand: student-only middleware */
const requireStudent = requireRole('student');

module.exports = { authenticateToken, requireRole, requireAdmin, requireStudent };
