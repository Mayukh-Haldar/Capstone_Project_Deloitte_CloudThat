const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRoles } = require("../middleware/auth");
const { ROLE } = require("../constants/roles");
const {
  listVenuesSchema,
  listVenueBookingsSchema,
  createVenueSchema,
  updateVenueSchema,
  venueIdParamSchema,
  checkAvailabilitySchema,
  createBookingSchema,
  confirmVenueBookingPaymentSchema,
  cancelVenueBookingSchema
} = require("../validators/venueValidators");
const {
  createVenue,
  getVenueById,
  listVenues,
  listVenueBookings,
  updateVenue,
  deactivateVenue,
  checkAvailability,
  createBooking,
  confirmVenueBookingPayment,
  cancelVenueBooking
} = require("../services/venueService");
const { sendInAppNotification } = require("../services/notificationClient");
const { notifyVenueBookingCancelled } = require("../services/eventClient");
const env = require("../config/env");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(createVenueSchema),
  asyncHandler(async (req, res) => {
    const venue = await createVenue(req.body);
    res.status(201).json(venue);
  })
);

router.get(
  "/",
  validate(listVenuesSchema),
  asyncHandler(async (req, res) => {
    const result = await listVenues(req.query);
    res.json(result);
  })
);

router.get(
  "/bookings",
  requireAuth,
  requireRoles([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.VENDOR]),
  validate(listVenueBookingsSchema),
  asyncHandler(async (req, res) => {
    const result = await listVenueBookings(req.query, req.user);
    res.json(result);
  })
);

router.get(
  "/:id",
  validate(venueIdParamSchema),
  asyncHandler(async (req, res) => {
    const venue = await getVenueById(req.params.id);
    res.json(venue);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(updateVenueSchema),
  asyncHandler(async (req, res) => {
    const venue = await updateVenue(req.params.id, req.body);
    res.json(venue);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRoles([ROLE.ADMIN]),
  validate(venueIdParamSchema),
  asyncHandler(async (req, res) => {
    const venue = await deactivateVenue(req.params.id);
    res.json(venue);
  })
);

router.get(
  "/:id/availability",
  requireAuth,
  validate(checkAvailabilitySchema),
  asyncHandler(async (req, res) => {
    const hallIds = req.query.hallIds
      ? req.query.hallIds
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    const result = await checkAvailability({
      venueId: req.params.id,
      start: req.query.start,
      end: req.query.end,
      hallIds
    });
    res.json(result);
  })
);

router.post(
  "/:id/book",
  requireAuth,
  requireRoles([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.VENDOR]),
  validate(createBookingSchema),
  asyncHandler(async (req, res) => {
    const booking = await createBooking({
      venueId: req.params.id,
      eventId: req.body.eventId,
      bookingStart: req.body.bookingStart,
      bookingEnd: req.body.bookingEnd,
      hallIds: req.body.hallIds || [],
      createdBy: req.user.id,
      createdByEmail: req.user.email,
      vendorId: req.body.vendorId,
      bookingOwnerId: req.body.bookingOwnerId,
      bookingOwnerEmail: req.body.bookingOwnerEmail
    });

    if (booking.paymentStatus === "PENDING") {
      await sendInAppNotification({
        userId: booking.bookingOwnerId || req.user.id,
        email: booking.bookingOwnerEmail || req.user.email,
        eventType: "event.updated",
        title: "Venue booking created - payment pending",
        body: `Your booking for venue ${req.params.id} is reserved from ${req.body.bookingStart} to ${req.body.bookingEnd}. Complete the payment to confirm the venue.`,
        metadata: {
          venueId: req.params.id,
          eventId: req.body.eventId,
          bookingId: booking.bookingId,
          bookingStart: req.body.bookingStart,
          bookingEnd: req.body.bookingEnd,
          hallIds: req.body.hallIds || [],
          paymentAmount: booking.paymentAmount,
          paymentCurrency: booking.paymentCurrency
        }
      });
    } else {
      await sendInAppNotification({
        userId: booking.bookingOwnerId || req.user.id,
        email: booking.bookingOwnerEmail || req.user.email,
        eventType: "venue.booking.confirmed",
        title: "Venue booking confirmed",
        body: `Your booking for venue ${req.params.id} is confirmed from ${req.body.bookingStart} to ${req.body.bookingEnd}.`,
        metadata: {
          venueId: req.params.id,
          eventId: req.body.eventId,
          bookingId: booking.bookingId,
          bookingStart: req.body.bookingStart,
          bookingEnd: req.body.bookingEnd,
          hallIds: req.body.hallIds || [],
          paymentAmount: booking.paymentAmount,
          paymentCurrency: booking.paymentCurrency
        }
      });
    }

    res.status(201).json(booking);
  })
);

router.post(
  "/internal/bookings/:bookingId/confirm-payment",
  validate(confirmVenueBookingPaymentSchema),
  asyncHandler(async (req, res) => {
    const internalServiceKey = req.header("x-internal-service-key");
    if (!internalServiceKey || internalServiceKey !== env.internalServiceKey) {
      return res.status(403).json({
        code: "AUTH-1003",
        message: "Invalid internal service key"
      });
    }

    const booking = await confirmVenueBookingPayment({
      bookingId: req.params.bookingId,
      paymentId: req.body.paymentId,
      paymentReference: req.body.paymentReference,
      invoiceNumber: req.body.invoiceNumber,
      invoiceUrl: req.body.invoiceUrl,
      amount: req.body.amount,
      currency: req.body.currency
    });

    await sendInAppNotification({
      userId: booking.bookingOwnerId,
      email: booking.bookingOwnerEmail,
      eventType: "venue.booking.confirmed",
      title: "Venue booking confirmed",
      body: `Your payment has been received. Booking ${booking.bookingId} is now confirmed for venue ${booking.venueId}.`,
      metadata: {
        venueId: booking.venueId,
        eventId: booking.eventId,
        bookingId: booking.bookingId,
        paymentId: booking.paymentId,
        paymentReference: booking.paymentReference,
        invoiceNumber: booking.invoiceNumber,
        invoiceUrl: booking.invoiceUrl
      }
    });

    res.json(booking);
  })
);

router.post(
  "/bookings/:bookingId/cancel",
  requireAuth,
  requireRoles([ROLE.ADMIN, ROLE.ORGANIZER, ROLE.VENDOR]),
  validate(cancelVenueBookingSchema),
  asyncHandler(async (req, res) => {
    const booking = await cancelVenueBooking({
      bookingId: req.params.bookingId,
      actor: req.user,
      reason: req.body.reason
    });

    await sendInAppNotification({
      userId: booking.bookingOwnerId || req.user.id,
      email: booking.bookingOwnerEmail || req.user.email,
      eventType: "event.updated",
      title: "Venue booking cancelled",
      body: `Booking ${booking.bookingId} for venue ${booking.venueId} has been cancelled.${booking.cancellationReason ? " Reason: " + booking.cancellationReason : ""}`,
      metadata: {
        venueId: booking.venueId,
        eventId: booking.eventId,
        bookingId: booking.bookingId,
        bookingStatus: booking.bookingStatus,
        cancelledAt: booking.cancelledAt,
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason
      }
    });

    await notifyVenueBookingCancelled({
      bookingId: booking.bookingId,
      reason: booking.cancellationReason
    });

    res.json(booking);
  })
);

module.exports = router;
