'use strict';

const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },
    checkInTime: {
      type: String, // HH:MM:SS
      default: null,
    },
    checkOutTime: {
      type: String, // HH:MM:SS
      default: null,
    },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent'],
      default: 'Present',
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
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true }); // one record per user per day
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ userId: 1 });
attendanceSchema.index({ status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
