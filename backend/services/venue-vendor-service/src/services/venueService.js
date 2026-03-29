const { Venue } = require("../models/Venue");
const { VenueBooking } = require("../models/VenueBooking");
const { ApiError } = require("../utils/apiError");
const errorCodes = require("../constants/errorCodes");
const { buildPagination } = require("../utils/pagination");
const { ROLE } = require("../constants/roles");
const { getEventBookingOwner } = require("./eventClient");

const uniq = (items) => [...new Set((items || []).filter(Boolean))];

const calculatePaymentAmount = (venue, bookingStart, bookingEnd) => {
  const durationMs = new Date(bookingEnd).getTime() - new Date(bookingStart).getTime();
  const dayCount = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));
  return Number((Number(venue.pricePerDay || 0) * dayCount).toFixed(2));
};

const getHallLookup = (venue) =>
  Object.fromEntries((venue.halls || []).map((hall) => [hall.hallId, hall]));

const getHallNames = (hallIds, hallLookup) =>
  uniq(hallIds)
    .map((hallId) => hallLookup[hallId]?.hallName)
    .filter(Boolean);

const analyzeHallCollision = (requestedHallIds, existingHallIds, venueHallIds) => {
  const normalizedRequested = uniq(requestedHallIds);
  const normalizedExisting = uniq(existingHallIds);
  const venueScopedHallIds = uniq(venueHallIds);

  if (normalizedRequested.length === 0 && normalizedExisting.length === 0) {
    return {
      collides: true,
      overlapScope: "WHOLE_VENUE",
      overlappingHallIds: venueScopedHallIds
    };
  }

  if (normalizedRequested.length === 0) {
    return {
      collides: true,
      overlapScope: "WHOLE_VENUE_REQUEST",
      overlappingHallIds: normalizedExisting
    };
  }

  if (normalizedExisting.length === 0) {
    return {
      collides: true,
      overlapScope: "WHOLE_VENUE_BOOKING",
      overlappingHallIds: normalizedRequested
    };
  }

  const existingSet = new Set(normalizedExisting);
  const overlappingHallIds = normalizedRequested.filter((hallId) =>
    existingSet.has(hallId)
  );

  return {
    collides: overlappingHallIds.length > 0,
    overlapScope: "PARTIAL_HALLS",
    overlappingHallIds
  };
};

const findOverlappingBookings = async ({
  venueId,
  bookingStart,
  bookingEnd
}) => {
  return VenueBooking.find({
    venueId,
    bookingStatus: { $ne: "CANCELLED" },
    bookingStart: { $lt: bookingEnd },
    bookingEnd: { $gt: bookingStart }
  }).lean();
};

const createVenue = async (payload) => {
  return Venue.create(payload);
};

const getVenueById = async (venueId) => {
  const venue = await Venue.findOne({ venueId }).lean();
  if (!venue) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.NOT_FOUND, "Venue not found");
  }
  return venue;
};

const listVenues = async (query) => {
  const pagination = buildPagination(query);
  const filters = { isActive: true };

  if (query.city) {
    filters.city = new RegExp(`^${query.city}$`, "i");
  }
  if (query.minCapacity) {
    filters.capacity = { $gte: query.minCapacity };
  }

  const [items, total] = await Promise.all([
    Venue.find(filters)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Venue.countDocuments(filters)
  ]);

  return {
    items,
    page: pagination.page,
    limit: pagination.limit,
    total
  };
};

const listVenueBookings = async (query, actor) => {
  const pagination = buildPagination(query);
  const filters = {};

  if (query.venueId) {
    filters.venueId = query.venueId;
  }

  if (query.eventId) {
    filters.eventId = query.eventId;
  }

  if (query.upcomingOnly) {
    filters.bookingEnd = { $gte: new Date() };
  }
  if (query.bookingStatus === "CANCELLED") {
    filters.bookingStatus = "CANCELLED";
  } else if (query.bookingStatus !== "ALL") {
    // Treat legacy bookings with no explicit status as active so they remain visible
    // and consistent with the availability checks until they are cancelled.
    filters.bookingStatus = { $ne: "CANCELLED" };
  }

  const actorRoles = actor?.roles || [];
  const isAdmin = actorRoles.includes(ROLE.ADMIN);
  const baseItems = await VenueBooking.find(filters)
    .sort({ bookingStart: 1, createdAt: -1 })
    .lean();

  const reconciledItems = await Promise.all(
    baseItems.map((booking) => reconcileLegacyBooking(booking))
  );

  const visibleItems = !isAdmin && actor?.id
    ? reconciledItems.filter((booking) =>
        booking.createdBy === actor.id
        || booking.vendorId === actor.id
        || booking.bookingOwnerId === actor.id
      )
    : reconciledItems;

  const total = visibleItems.length;
  const items = visibleItems.slice(pagination.skip, pagination.skip + pagination.limit);

  return {
    items,
    page: pagination.page,
    limit: pagination.limit,
    total
  };
};

const reconcileLegacyBooking = async (booking) => {
  if (!booking) {
    return booking;
  }

  const updates = {};
  let eventOwner = null;

  if ((!booking.bookingOwnerId || !booking.bookingOwnerEmail) && booking.eventId) {
    eventOwner = await getEventBookingOwner(booking.eventId);
    if (eventOwner?.organizerId && !booking.bookingOwnerId) {
      updates.bookingOwnerId = eventOwner.organizerId;
    }
    if (eventOwner?.organizerEmail && !booking.bookingOwnerEmail) {
      updates.bookingOwnerEmail = eventOwner.organizerEmail;
    }
  }

  if (!booking.bookingStatus) {
    updates.bookingStatus = "ACTIVE";
  }

  if (booking.paymentStatus == null || booking.paymentAmount == null || !booking.paymentCurrency) {
    const venue = await Venue.findOne({ venueId: booking.venueId }).lean();
    const computedAmount = venue
      ? calculatePaymentAmount(venue, booking.bookingStart, booking.bookingEnd)
      : Number(booking.paymentAmount || 0);
    updates.paymentAmount = Number.isFinite(computedAmount) ? computedAmount : 0;
    updates.paymentCurrency = booking.paymentCurrency || "INR";
    updates.paymentStatus = booking.paymentId || booking.paidAt || Number(updates.paymentAmount) === 0
      ? "PAID"
      : "PENDING";
  }

  if (Object.keys(updates).length === 0) {
    return booking;
  }

  await VenueBooking.updateOne({ bookingId: booking.bookingId }, { $set: updates });
  return { ...booking, ...updates };
};

const findVenueOrThrow = async (venueId) => {
  const venue = await Venue.findOne({ venueId, isActive: true });
  if (!venue) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.NOT_FOUND, "Venue not found");
  }
  return venue;
};

const validateAndNormalizeHallIds = (venue, hallIds = []) => {
  const normalizedHallIds = uniq(hallIds);

  if (normalizedHallIds.length === 0) {
    return normalizedHallIds;
  }

  if (!venue.halls.length) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      errorCodes.VALIDATION_ERROR,
      `Venue ${venue.venueId} does not define bookable halls`
    );
  }

  const venueHallIds = new Set(venue.halls.map((hall) => hall.hallId));
  for (const hallId of normalizedHallIds) {
    if (!venueHallIds.has(hallId)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        errorCodes.VALIDATION_ERROR,
        `Hall ${hallId} does not belong to venue ${venue.venueId}`
      );
    }
  }

  return normalizedHallIds;
};

const updateVenue = async (venueId, updates) => {
  const venue = await getVenueById(venueId);
  if (!venue.isActive) {
    throw new ApiError(409, "CONFLICT", errorCodes.CONFLICT, "Venue is inactive");
  }

  return Venue.findOneAndUpdate(
    { venueId },
    { $set: updates },
    { new: true, runValidators: true }
  );
};

const deactivateVenue = async (venueId) => {
  const venue = await getVenueById(venueId);
  if (!venue.isActive) {
    return venue;
  }

  return Venue.findOneAndUpdate(
    { venueId },
    { $set: { isActive: false } },
    { new: true }
  );
};

const checkAvailability = async ({ venueId, start, end, hallIds }) => {
  const venue = await findVenueOrThrow(venueId);
  const normalizedHallIds = validateAndNormalizeHallIds(venue, hallIds || []);
  const venueHallIds = venue.halls.map((hall) => hall.hallId);
  const hallLookup = getHallLookup(venue);
  const overlapping = await findOverlappingBookings({
    venueId,
    bookingStart: start,
    bookingEnd: end
  });
  const conflicts = [];
  let wholeVenueBlocked = false;
  const unavailableHallIds = new Set();

  for (const booking of overlapping) {
    const collision = analyzeHallCollision(
      normalizedHallIds,
      booking.hallIds || [],
      venueHallIds
    );

    if (!collision.collides) {
      continue;
    }

    if ((booking.hallIds || []).length === 0) {
      wholeVenueBlocked = true;
      venueHallIds.forEach((hallId) => unavailableHallIds.add(hallId));
    } else {
      (booking.hallIds || []).forEach((hallId) => unavailableHallIds.add(hallId));
    }

    conflicts.push({
      bookingId: booking.bookingId,
      eventId: booking.eventId,
      bookingStart: booking.bookingStart,
      bookingEnd: booking.bookingEnd,
      scope: (booking.hallIds || []).length === 0 ? "WHOLE_VENUE" : "HALLS",
      hallIds: uniq(booking.hallIds || []),
      hallNames: getHallNames(booking.hallIds || [], hallLookup),
      overlappingHallIds: collision.overlappingHallIds,
      overlappingHallNames: getHallNames(collision.overlappingHallIds, hallLookup)
    });
  }

  const unavailableHallIdList = wholeVenueBlocked ? venueHallIds : [...unavailableHallIds];
  const availableHallIds = venueHallIds.filter(
    (hallId) => !unavailableHallIdList.includes(hallId)
  );

  return {
    venueId,
    requestedWindow: {
      start,
      end
    },
    requestedHallIds: normalizedHallIds,
    requestedHallNames: getHallNames(normalizedHallIds, hallLookup),
    requestedScope: normalizedHallIds.length > 0 ? "PARTIAL_VENUE" : "WHOLE_VENUE",
    isAvailable: conflicts.length === 0,
    wholeVenueBlocked,
    unavailableHallIds: unavailableHallIdList,
    unavailableHallNames: getHallNames(unavailableHallIdList, hallLookup),
    availableHallIds,
    availableHallNames: getHallNames(availableHallIds, hallLookup),
    conflicts
  };
};

const createBooking = async ({
  venueId,
  eventId,
  bookingStart,
  bookingEnd,
  hallIds,
  createdBy,
  createdByEmail,
  vendorId,
  bookingOwnerId,
  bookingOwnerEmail,
  actor
}) => {
  const venue = await findVenueOrThrow(venueId);
  const normalizedHallIds = validateAndNormalizeHallIds(venue, hallIds);
  const venueHallIds = venue.halls.map((hall) => hall.hallId);

  const overlapping = await findOverlappingBookings({
    venueId,
    bookingStart,
    bookingEnd
  });
  const hallLookup = getHallLookup(venue);
  const conflicts = overlapping
    .map((booking) => {
      const collision = analyzeHallCollision(
        normalizedHallIds,
        booking.hallIds || [],
        venueHallIds
      );

      if (!collision.collides) {
        return null;
      }

      return {
        bookingId: booking.bookingId,
        eventId: booking.eventId,
        scope: (booking.hallIds || []).length === 0 ? "WHOLE_VENUE" : "HALLS",
        hallIds: uniq(booking.hallIds || []),
        hallNames: getHallNames(booking.hallIds || [], hallLookup),
        overlappingHallIds: collision.overlappingHallIds,
        overlappingHallNames: getHallNames(collision.overlappingHallIds, hallLookup)
      };
    })
    .filter(Boolean);

  if (conflicts.length > 0) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Venue slot is not available for requested window",
      conflicts
    );
  }

  const existingEventBooking = await VenueBooking.findOne({ eventId, venueId }).lean();
  if (existingEventBooking) {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Event already has a booking for this venue"
    );
  }

  const actorRoles = actor?.roles || [];
  const isAdminBooking = actorRoles.includes(ROLE.ADMIN);
  const paymentAmount = isAdminBooking ? 0 : calculatePaymentAmount(venue, bookingStart, bookingEnd);
  const normalizedOwnerId = bookingOwnerId || vendorId || createdBy;
  const normalizedOwnerEmail = bookingOwnerEmail || createdByEmail;

  return VenueBooking.create({
    venueId,
    eventId,
    bookingStart,
    bookingEnd,
    hallIds: normalizedHallIds,
    createdBy,
    createdByEmail,
    vendorId,
    bookingOwnerId: normalizedOwnerId,
    bookingOwnerEmail: normalizedOwnerEmail,
    paymentStatus: paymentAmount > 0 ? "PENDING" : "PAID",
    paymentAmount,
    paymentCurrency: "INR",
    paidAt: paymentAmount > 0 ? null : new Date()
  });
};

const confirmVenueBookingPayment = async ({
  bookingId,
  paymentId,
  paymentReference,
  invoiceNumber,
  invoiceUrl,
  amount,
  currency
}) => {
  const booking = await VenueBooking.findOne({ bookingId });
  if (!booking) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.NOT_FOUND, "Venue booking not found");
  }

  booking.paymentStatus = "PAID";
  booking.paymentId = paymentId;
  booking.paymentReference = paymentReference;
  booking.invoiceNumber = invoiceNumber;
  booking.invoiceUrl = invoiceUrl;
  booking.paidAt = new Date();
  if (typeof amount === "number" && Number.isFinite(amount)) {
    booking.paymentAmount = Number(amount.toFixed(2));
  }
  if (currency) {
    booking.paymentCurrency = currency;
  }

  await booking.save();
  return booking.toObject();
};

const cancelVenueBooking = async ({
  bookingId,
  actor,
  reason
}) => {
  const booking = await VenueBooking.findOne({ bookingId });
  if (!booking) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.NOT_FOUND, "Venue booking not found");
  }

  if (booking.bookingStatus === "CANCELLED") {
    throw new ApiError(409, "CONFLICT", errorCodes.CONFLICT, "Venue booking is already cancelled");
  }

  const actorRoles = actor?.roles || [];
  const isAdmin = actorRoles.includes(ROLE.ADMIN);
  const canManage = isAdmin
    || actor?.id === booking.createdBy
    || actor?.id === booking.bookingOwnerId
    || actor?.id === booking.vendorId;

  if (!canManage) {
    throw new ApiError(403, "FORBIDDEN", errorCodes.AUTHORIZATION_ERROR, "You do not have access to cancel this booking");
  }

  booking.bookingStatus = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.cancelledBy = actor.id;
  booking.cancellationReason = reason || null;
  await booking.save();
  return booking.toObject();
};

const deleteVenueBooking = async ({
  bookingId,
  actor
}) => {
  const booking = await VenueBooking.findOne({ bookingId });
  if (!booking) {
    throw new ApiError(404, "NOT_FOUND", errorCodes.NOT_FOUND, "Venue booking not found");
  }

  if (booking.bookingStatus !== "CANCELLED") {
    throw new ApiError(
      409,
      "CONFLICT",
      errorCodes.CONFLICT,
      "Only cancelled venue bookings can be removed permanently"
    );
  }

  const actorRoles = actor?.roles || [];
  const isAdmin = actorRoles.includes(ROLE.ADMIN);
  const canManage = isAdmin
    || actor?.id === booking.createdBy
    || actor?.id === booking.bookingOwnerId
    || actor?.id === booking.vendorId;

  if (!canManage) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      errorCodes.AUTHORIZATION_ERROR,
      "You do not have access to remove this booking"
    );
  }

  await VenueBooking.deleteOne({ bookingId });
  return booking.toObject();
};

module.exports = {
  createVenue,
  getVenueById,
  listVenues,
  listVenueBookings,
  updateVenue,
  deactivateVenue,
  checkAvailability,
  createBooking,
  confirmVenueBookingPayment,
  cancelVenueBooking,
  deleteVenueBooking
};
