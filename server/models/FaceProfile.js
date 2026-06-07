'use strict';

const mongoose = require('mongoose');

const faceProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cloudinaryUrl: {
      type: String,
      default: null,
    },
    cloudinaryPublicId: {
      type: String,
      default: null,
    },
    faceEncoding: {
  type: [Number],
  required: true,
  validate: {
    validator(v) {
      return Array.isArray(v) && v.length === 512;
    },
    message: 'Face encoding must contain exactly 512 values.'
  }
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
faceProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('FaceProfile', faceProfileSchema);
