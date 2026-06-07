'use strict';

/**
 * Setup script — run once to connect to MongoDB and seed the default admin.
 * Usage: node server/setup.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { connectDatabase, disconnectDatabase } = require('./config/db');
const User = require('./models/User');

async function setup() {
  console.log('══════════════════════════════════════════════');
  console.log('  Face Attendance System — Database Setup');
  console.log('══════════════════════════════════════════════');
  console.log();

  // Connect to MongoDB
  await connectDatabase();

  // Seed default admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@faceattend.com';
  const adminName = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existing = await User.findOne({ email: adminEmail });

  if (!existing) {
    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      verified: true,
    });
    console.log(`  ✓ Default admin created — email: ${adminEmail}`);
  } else {
    console.log('  ✓ Default admin already exists — skipping seed.');
  }

  console.log();
  console.log('  Default admin credentials:');
  console.log(`    Email    : ${adminEmail}`);
  console.log(`    Password : ${adminPassword}`);
  console.log();
  console.log(`  Database   : MongoDB Atlas`);
  console.log();
  console.log('  Setup complete! Run "npm start" to launch the server.');
  console.log('══════════════════════════════════════════════');

  await disconnectDatabase();
  process.exit(0);
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
