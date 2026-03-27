const crypto = require("crypto");
const { TOPIC_CHANNELS } = require("../constants/eventTopics");
const { Notification } = require("../models/Notification");
const { WebhookSubscription } = require("../models/WebhookSubscription");
const { PushToken } = require("../models/PushToken");
const { providers } = require("../providers/channelProviders");
const { getPreferences, isChannelEnabled } = require("./preferenceService");
const { getTemplateByKey, getTemplateForEvent } = require("./templateService");
const { createDeliveryLog } = require("./deliveryLogService");
const { renderTemplate } = require("../utils/templateRenderer");

const resolveTemplate = async ({ templateKey, eventType, channel, locale, title, body, html, variables }) => {
  if (title && body) {
    return renderTemplate(
      {
        subject: title,
        body,
        html: html || null
      },
      variables || {}
    );
  }

  const template = templateKey
    ? await getTemplateByKey(templateKey)
    : await getTemplateForEvent({ eventType, channel, locale });

  return renderTemplate(template, variables || {});
};

const enrichRecipientForChannel = async ({ recipient, channel }) => {
  if (channel !== "PUSH" || recipient.pushToken) {
    return recipient;
  }

  const pushToken = await PushToken.findOne({
    userId: recipient.userId,
    isActive: true
  })
    .sort({ updatedAt: -1 })
    .lean();

  return {
    ...recipient,
    pushToken: pushToken?.token || null
  };
};

const appendDeliveryState = async ({
  notification,
  attemptNumber,
  result,
  failed = false,
  reason = null
}) => {
  notification.status = failed ? "FAILED" : "SENT";
  notification.deliveries.push({
    channel: notification.channel,
    status: failed ? "FAILED" : "SENT",
    provider: result?.provider || null,
    externalId: result?.externalId || null,
    sentAt: new Date(),
    failureReason: reason
  });
  await notification.save();
};

const performDeliveryAttempt = async ({ notificationId, io, attemptNumber = 1 }) => {
  const notification = await Notification.findById(notificationId);
  if (!notification || notification.deletedAt) {
    return null;
  }

  const subscription =
    notification.channel === "WEBHOOK"
      ? await WebhookSubscription.findOne({
          userId: notification.userId,
          eventType: notification.eventType,
          isActive: true
        })
      : null;

  try {
    const result = await providers[notification.channel]({
      notification,
      subscription,
      io
    });

    await createDeliveryLog({
      notificationId: notification.id,
      correlationId: notification.correlationId,
      userId: notification.userId,
      eventType: notification.eventType,
      channel: notification.channel,
      provider: result.provider,
      status: result.status,
      responseCode: result.responseCode,
      responseMessage: result.responseMessage,
      attemptNumber,
      metadata: result.metadata
    });

    await appendDeliveryState({
      notification,
      attemptNumber,
      result,
      failed: result.status !== "SUCCESS",
      reason: result.status === "SUCCESS" ? null : result.responseMessage
    });
  } catch (error) {
    await createDeliveryLog({
      notificationId: notification.id,
      correlationId: notification.correlationId,
      userId: notification.userId,
      eventType: notification.eventType,
      channel: notification.channel,
      provider: "ChannelProvider",
      status: "FAILED",
      responseCode: "500",
      responseMessage: error instanceof Error ? error.message : "Channel delivery failed",
      attemptNumber,
      metadata: {}
    });

    await appendDeliveryState({
      notification,
      attemptNumber,
      result: null,
      failed: true,
      reason: error instanceof Error ? error.message : "Channel delivery failed"
    });
  }

  return notification;
};

const markNotificationFailed = async ({ notificationId, attemptNumber, reason }) => {
  const notification = await Notification.findById(notificationId);
  if (!notification || notification.deletedAt) {
    return null;
  }

  await createDeliveryLog({
    notificationId: notification.id,
    correlationId: notification.correlationId,
    userId: notification.userId,
    eventType: notification.eventType,
    channel: notification.channel,
    provider: "BullMQWorker",
    status: "FAILED",
    responseCode: "500",
    responseMessage: reason,
    attemptNumber,
    metadata: {}
  });

  await appendDeliveryState({
    notification,
    attemptNumber,
    result: null,
    failed: true,
    reason
  });

  return notification;
};

const scheduleDelivery = async ({ notification, io }) => {
  const { enqueueDelivery, isQueueEnabledForChannel } = require("./queueService");
  if (isQueueEnabledForChannel(notification.channel)) {
    await enqueueDelivery({ notificationId: notification.id });
    return notification;
  }

  return performDeliveryAttempt({
    notificationId: notification.id,
    io,
    attemptNumber: 1
  });
};

const createNotifications = async ({ payload, io }) => {
  const channels = payload.channels?.length ? payload.channels : TOPIC_CHANNELS[payload.eventType] || ["IN_APP"];
  const correlationId = payload.correlationId || crypto.randomUUID();
  const created = [];

  for (const recipient of payload.recipients) {
    const preferences = await getPreferences(recipient.userId);

    for (const channel of channels) {
      if (!isChannelEnabled(preferences, channel, payload.eventType)) {
        continue;
      }

      const enrichedRecipient = await enrichRecipientForChannel({
        recipient,
        channel
      });

      if (channel === "PUSH" && !enrichedRecipient.pushToken) {
        continue;
      }

      const rendered = await resolveTemplate({
        templateKey: payload.templateKey,
        eventType: payload.eventType,
        channel,
        locale: enrichedRecipient.locale,
        title: payload.title,
        body: payload.body,
        html: payload.html,
        variables: {
          ...(payload.variables || {}),
          recipient: enrichedRecipient,
          metadata: payload.metadata || {}
        }
      });

      const notification = await Notification.create({
        correlationId,
        userId: recipient.userId,
        eventType: payload.eventType,
        channel,
        title: rendered.subject,
        body: rendered.body,
        html: rendered.html,
        attachments: payload.attachments || [],
        status: "PENDING",
        metadata: payload.metadata || {},
        recipients: {
          email: enrichedRecipient.email || null,
          phone: enrichedRecipient.phone || null,
          pushToken: enrichedRecipient.pushToken || null,
          webhookUrl: enrichedRecipient.webhookUrl || null
        }
      });

      created.push(await scheduleDelivery({ notification, io }));
    }
  }

  return {
    correlationId,
    notifications: created
  };
};

const listNotificationsForUser = async ({ userId, query }) => {
  const filters = {
    userId,
    deletedAt: null
  };

  if (query.status) {
    filters.status = query.status;
  }
  if (query.channel) {
    filters.channel = query.channel;
  }
  if (query.eventType) {
    filters.eventType = query.eventType;
  }
  if (query.unreadOnly) {
    filters.readAt = null;
  }

  return filters;
};

module.exports = {
  createNotifications,
  listNotificationsForUser,
  performDeliveryAttempt,
  markNotificationFailed
};
