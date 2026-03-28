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
    createdByEmail: {
      type: String
    },
    bookingOwnerId: {
      type: String,
      index: true
    },
    bookingOwnerEmail: {
      type: String
    },
    vendorId: {
      type: String,
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
      index: true
    },
    bookingStatus: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
      index: true
    },
    paymentAmount: {
      type: Number,
      default: 0
    },
    paymentCurrency: {
      type: String,
      default: "INR"
    },
    paymentId: {
      type: String,
      index: true
    },
    paymentReference: {
      type: String
    },
    invoiceNumber: {
      type: String
    },
    invoiceUrl: {
      type: String
    },
    paidAt: {
      type: Date
    },
    cancellationReason: {
      type: String
    },
    cancelledAt: {
      type: Date
    },
    cancelledBy: {
      type: String
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
