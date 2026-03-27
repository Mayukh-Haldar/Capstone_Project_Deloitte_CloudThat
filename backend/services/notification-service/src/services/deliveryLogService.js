const { DeliveryLog } = require("../models/DeliveryLog");

const createDeliveryLog = async ({
  notificationId,
  correlationId,
  userId,
  eventType,
  channel,
  provider,
  status,
  responseCode,
  responseMessage,
  attemptNumber,
  metadata
}) =>
  DeliveryLog.create({
    notificationId,
    correlationId,
    userId,
    eventType,
    channel,
    provider,
    status,
    responseCode,
    responseMessage,
    attemptNumber,
    metadata
  });

module.exports = { createDeliveryLog };
