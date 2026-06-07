'use strict';

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/faceattend';

/**
 * Connect to MongoDB Atlas (or local MongoDB).
 * Returns a promise that resolves when connected.
 */
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] Connected to MongoDB successfully.');
  } catch (err) {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected. Attempting reconnection...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
  });
}

/**
 * Gracefully close the MongoDB connection.
 */
async function disconnectDatabase() {
  await mongoose.disconnect();
  console.log('[DB] MongoDB connection closed.');
}

module.exports = { connectDatabase, disconnectDatabase };
