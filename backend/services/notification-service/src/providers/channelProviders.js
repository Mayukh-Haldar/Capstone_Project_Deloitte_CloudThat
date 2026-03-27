const { CHANNEL } = require("../constants/channels");
const { createSignature } = require("../utils/signature");
const { sendEmail, isEmailConfigured } = require("./emailProvider");
const { sendPush, isPushConfigured } = require("./pushProvider");

const shouldForceFail = (notification, channel) => {
  const forced = notification.metadata?.forceFailChannels;
  return Array.isArray(forced) && forced.includes(channel);
};

const providers = {
  [CHANNEL.EMAIL]: async ({ notification }) => {
    if (shouldForceFail(notification, CHANNEL.EMAIL)) {
      throw new Error("Forced email delivery failure");
    }
    return sendEmail({
      to: notification.recipients.email,
      subject: notification.title,
      text: notification.body,
      html: notification.html,
      attachments: notification.attachments || []
    });
  },
  [CHANNEL.PUSH]: async ({ notification }) => {
    if (shouldForceFail(notification, CHANNEL.PUSH)) {
      throw new Error("Forced push delivery failure");
    }
    return sendPush({
      token: notification.recipients.pushToken,
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        eventType: notification.eventType,
        userId: notification.userId
      }
    });
  },
  [CHANNEL.IN_APP]: async ({ notification, io }) => {
    if (io) {
      io.to(`user:${notification.userId}`).emit("notification.received", {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        eventType: notification.eventType,
        createdAt: notification.createdAt
      });
    }

    return {
      provider: "SocketIO",
      status: "SUCCESS",
      responseCode: "200",
      responseMessage: "In-app notification stored and emitted",
      externalId: `in-app-${notification.id}`,
      metadata: {}
    };
  },
  [CHANNEL.WEBHOOK]: async ({ notification, subscription }) => {
    if (shouldForceFail(notification, CHANNEL.WEBHOOK)) {
      throw new Error("Forced webhook delivery failure");
    }
    return {
      provider: "WebhookDispatcher",
      status: "SUCCESS",
      responseCode: "200",
      responseMessage: "Webhook signed payload prepared",
      externalId: `webhook-${notification.id}`,
      metadata: {
        url: subscription?.url || notification.recipients.webhookUrl,
        signature: createSignature(subscription?.secret || "default-secret", JSON.stringify({
          notificationId: notification.id,
          eventType: notification.eventType
        }))
      }
    };
  }
};

module.exports = { providers, isEmailConfigured, isPushConfigured };
