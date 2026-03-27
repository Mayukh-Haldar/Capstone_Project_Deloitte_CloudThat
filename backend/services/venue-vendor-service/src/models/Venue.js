const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

const VenueHallSchema = new mongoose.Schema(
  {
    hallId: {
      type: String,
      default: () => randomUUID()
    },
    hallName: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    }
  },
  { _id: false }
);

const VenueSchema = new mongoose.Schema(
  {
    venueId: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true
    },
    venueName: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    pricePerDay: {
      type: Number,
      required: true,
      min: 0
    },
    amenities: {
      type: [String],
      default: []
    },
    mediaGallery: {
      type: [String],
      default: []
    },
    halls: {
      type: [VenueHallSchema],
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

VenueSchema.index({ city: 1, capacity: 1 });

const Venue = mongoose.model("Venue", VenueSchema);

module.exports = { Venue };
