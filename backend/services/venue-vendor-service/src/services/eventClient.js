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

module.exports = { notifyVenueBookingCancelled };
