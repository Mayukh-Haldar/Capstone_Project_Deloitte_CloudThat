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
      const response = await fetch(`${env.notificationServiceBaseUrl.replace(/\/$/, "")}/api/v1/notifications/send`, {
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

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`Notification service responded with ${response.status}${details ? `: ${details}` : ""}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    // Notification delivery is best-effort and must not break the booking flow.
    console.warn("Failed to deliver venue notification:", error.message);
  }
};

module.exports = { sendInAppNotification };
