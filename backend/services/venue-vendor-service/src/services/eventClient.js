const env = require("../config/env");

const notifyVenueBookingCancelled = async ({
  bookingId,
  reason
}) => {
  if (!bookingId || !env.eventServiceBaseUrl) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      await fetch(`${env.eventServiceBaseUrl.replace(/\/$/, "")}/api/v1/events/internal/venue-bookings/${bookingId}/cancelled`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-key": env.internalServiceKey
        },
        body: JSON.stringify({
          reason
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (_error) {
    // Event sync is best-effort and must not break venue cancellation itself.
  }
};

const getEventBookingOwner = async (eventId) => {
  if (!eventId || !env.eventServiceBaseUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(`${env.eventServiceBaseUrl.replace(/\/$/, "")}/api/v1/internal/events/${eventId}/booking-owner`, {
        method: "GET",
        headers: {
          "x-internal-service-key": env.internalServiceKey
        },
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  } catch (_error) {
    return null;
  }
};

module.exports = { notifyVenueBookingCancelled, getEventBookingOwner };
