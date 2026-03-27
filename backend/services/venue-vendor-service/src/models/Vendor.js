const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const { SERVICE_CATEGORIES } = require("../constants/domain");

const VendorReviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      default: () => randomUUID()
    },
    eventId: {
      type: String,
      required: true
    },
    reviewerId: {
      type: String,
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: {
      type: String,
      trim: true,
      default: ""
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const VendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true
    },
    vendorName: {
      type: String,
      required: true,
      trim: true
    },
    serviceType: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    reviews: {
      type: [VendorReviewSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

VendorSchema.index({ serviceType: 1, rating: -1 });
VendorSchema.index({ email: 1 }, { unique: true });

const Vendor = mongoose.model("Vendor", VendorSchema);

module.exports = { Vendor };
