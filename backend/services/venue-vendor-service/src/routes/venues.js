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
  createBookingSchema
} = require("../validators/venueValidators");
const {
  createVenue,
  getVenueById,
  listVenues,
  listVenueBookings,
  updateVenue,
  deactivateVenue,
  checkAvailability,
  createBooking
} = require("../services/venueService");
const { sendInAppNotification } = require("../services/notificationClient");

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
      vendorId: req.body.vendorId
    });

    await sendInAppNotification({
      userId: req.user.id,
      email: req.user.email,
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
        vendorId: req.body.vendorId
      }
    });

    res.status(201).json(booking);
  })
);

module.exports = router;
