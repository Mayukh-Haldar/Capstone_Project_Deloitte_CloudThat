const crypto = require("crypto");
const { Kafka, logLevel } = require("kafkajs");
const env = require("../config/env");
const { TOPIC_CHANNELS } = require("../constants/eventTopics");
const { createNotifications } = require("./notificationService");

const topicList = () => {
  if (env.kafkaTopics.length > 0) {
    return env.kafkaTopics;
  }

  return Object.keys(TOPIC_CHANNELS);
};

const parseMessage = (message) => {
  const rawValue = message.value ? message.value.toString("utf8") : "{}";
  try {
    return JSON.parse(rawValue);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error.message}`);
  }
};

const normalizeRecipients = (payload) => {
  if (Array.isArray(payload.recipients) && payload.recipients.length > 0) {
    return payload.recipients;
  }

  if (payload.recipient && typeof payload.recipient === "object") {
    return [payload.recipient];
  }

  throw new Error("Kafka message must include recipient or recipients");
};

const normalizeKafkaEvent = ({ topic, message }) => {
  const payload = parseMessage(message);
  const headers = Object.fromEntries(
    Object.entries(message.headers || {}).map(([key, value]) => [key, value ? value.toString("utf8") : ""])
  );

  return {
    correlationId: payload.correlationId || headers["x-correlation-id"] || crypto.randomUUID(),
    eventType: payload.eventType || topic,
    channels: payload.channels,
    recipients: normalizeRecipients(payload),
    templateKey: payload.templateKey,
    title: payload.title,
    body: payload.body,
    html: payload.html,
    metadata: payload.metadata || {},
    variables: payload.variables || {}
  };
};

const startKafkaConsumer = async ({ io } = {}) => {
  if (!env.enableKafka) {
    return {
      enabled: false,
      message: "Kafka consumer disabled",
      stop: async () => {}
    };
  }

  const kafka = new Kafka({
    clientId: env.kafkaClientId,
    brokers: env.kafkaBrokers,
    logLevel: logLevel.NOTHING
  });

  const consumer = kafka.consumer({
    groupId: env.kafkaConsumerGroup
  });

  await consumer.connect();

  const topics = topicList();
  for (const topic of topics) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const normalized = normalizeKafkaEvent({ topic, message });
      await createNotifications({
        payload: normalized,
        io
      });
    }
  });

  return {
    enabled: true,
    message: `Kafka consumer connected to ${env.kafkaBrokers.join(", ")} for topics: ${topics.join(", ")}`,
    stop: async () => {
      await consumer.disconnect();
    }
  };
};

module.exports = { startKafkaConsumer, normalizeKafkaEvent };
