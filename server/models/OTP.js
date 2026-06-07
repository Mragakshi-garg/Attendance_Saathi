'use strict';

const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String, // stored hashed
      required: true,
    },
    purpose: {
      type: String,
      enum: ['registration', 'password-reset'],
      default: 'registration',
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index — auto-deletes expired docs
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.otp; // never expose hashed OTP
        return ret;
      },
    },
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────
otpSchema.index({ email: 1 });

module.exports = mongoose.model('OTP', otpSchema);
