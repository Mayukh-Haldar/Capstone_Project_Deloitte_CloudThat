const env = require("../config/env");

const sendInAppNotification = async ({
  userId,
  email,
  eventType,
  title,
  body,
  metadata
}) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      await fetch(`${env.notificationServiceBaseUrl.replace(/\/$/, "")}/api/v1/notifications/send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-key": env.notificationInternalServiceKey
        },
        body: JSON.stringify({
          eventType,
          recipients: [
            {
              userId,
              email
            }
          ],
          title,
          body,
          metadata
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (_error) {
    // Notification delivery is best-effort and must not break the booking flow.
  }
};

module.exports = { sendInAppNotification };
