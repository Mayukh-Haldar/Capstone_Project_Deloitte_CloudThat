const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");

const VenueBookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true
    },
    eventId: {
      type: String,
      required: true,
      index: true
    },
    venueId: {
      type: String,
      required: true,
      index: true
    },
    hallIds: {
      type: [String],
      default: []
    },
    bookingStart: {
      type: Date,
      required: true
    },
    bookingEnd: {
      type: Date,
      required: true
    },
    createdBy: {
      type: String,
      required: true
    },
    vendorId: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

VenueBookingSchema.index({ venueId: 1, bookingStart: 1, bookingEnd: 1 });
VenueBookingSchema.index({ eventId: 1, venueId: 1 }, { unique: true });

const VenueBooking = mongoose.model("VenueBooking", VenueBookingSchema);

module.exports = { VenueBooking };
