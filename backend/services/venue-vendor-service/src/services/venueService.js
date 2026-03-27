const { Venue } = require("../models/Venue");
const { VenueBooking } = require("../models/VenueBooking");
const { ApiError } = require("../utils/apiError");
const errorCodes = require("../constants/errorCodes");
const { buildPagination } = require("../utils/pagination");
const { ROLE } = require("../constants/roles");

const uniq = (items) => [...new Set((items || []).filter(Boolean))];

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

  const actorRoles = actor?.roles || [];
  const isAdmin = actorRoles.includes(ROLE.ADMIN);
  if (!isAdmin && actor?.id) {
    filters.$or = [{ createdBy: actor.id }, { vendorId: actor.id }];
  }

  const [items, total] = await Promise.all([
    VenueBooking.find(filters)
      .sort({ bookingStart: 1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    VenueBooking.countDocuments(filters)
  ]);

  return {
    items,
    page: pagination.page,
    limit: pagination.limit,
    total
  };
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
  vendorId
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

  return VenueBooking.create({
    venueId,
    eventId,
    bookingStart,
    bookingEnd,
    hallIds: normalizedHallIds,
    createdBy,
    vendorId
  });
};

module.exports = {
  createVenue,
  getVenueById,
  listVenues,
  listVenueBookings,
  updateVenue,
  deactivateVenue,
  checkAvailability,
  createBooking
};
