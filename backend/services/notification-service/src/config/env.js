const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined) {
    return fallback;
  }
  return String(value).toLowerCase() === "true";
};

module.exports = {
  appName: process.env.SERVICE_NAME || "notification-service",
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 8086),
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/eventzen_notifications",
  jwtSecret:
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "change-me-change-me-change-me-change-me-1234567890",
  jwtIssuer: process.env.AUTH_JWT_ISSUER || "eventzen-auth-service",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  enableRequestLogs: toBoolean(process.env.ENABLE_REQUEST_LOGS, true),
  defaultLocale: process.env.DEFAULT_NOTIFICATION_LOCALE || "en",
  retentionDays: toNumber(process.env.NOTIFICATION_RETENTION_DAYS, 90),
  internalServiceKey:
    process.env.INTERNAL_SERVICE_KEY || process.env.NOTIFICATION_INTERNAL_SERVICE_KEY || "eventzen-internal-key",
  smtpHost: process.env.NOTIFICATION_SMTP_HOST || process.env.AUTH_SMTP_HOST || "",
  smtpPort: toNumber(process.env.NOTIFICATION_SMTP_PORT || process.env.AUTH_SMTP_PORT, 587),
  smtpUsername: process.env.NOTIFICATION_SMTP_USERNAME || process.env.AUTH_SMTP_USERNAME || "",
  smtpPassword: process.env.NOTIFICATION_SMTP_PASSWORD || process.env.AUTH_SMTP_PASSWORD || "",
  smtpAuth: toBoolean(process.env.NOTIFICATION_SMTP_AUTH || process.env.AUTH_SMTP_AUTH, true),
  smtpStartTls: toBoolean(process.env.NOTIFICATION_SMTP_STARTTLS || process.env.AUTH_SMTP_STARTTLS, true),
  mailFromEmail:
    process.env.NOTIFICATION_MAIL_FROM_EMAIL ||
    process.env.AUTH_MAIL_FROM_EMAIL ||
    process.env.NOTIFICATION_SMTP_USERNAME ||
    process.env.AUTH_SMTP_USERNAME ||
    "no-reply@eventzen.local",
  mailFromName: process.env.NOTIFICATION_MAIL_FROM_NAME || process.env.AUTH_MAIL_FROM_NAME || "EventZen",
  firebaseProjectId: process.env.NOTIFICATION_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.NOTIFICATION_FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: (process.env.NOTIFICATION_FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  enableKafka: toBoolean(process.env.ENABLE_KAFKA, false),
  kafkaBrokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map((item) => item.trim()).filter(Boolean),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || "eventzen-notification-service",
  kafkaConsumerGroup: process.env.KAFKA_CONSUMER_GROUP || "eventzen-notification-service",
  kafkaTopics: (process.env.KAFKA_TOPICS || "").split(",").map((item) => item.trim()).filter(Boolean),
  enableBullMq: toBoolean(process.env.ENABLE_BULLMQ, false),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  enableSocketIo: toBoolean(process.env.ENABLE_SOCKET_IO, true),
  seedDefaultTemplates: toBoolean(process.env.SEED_DEFAULT_TEMPLATES, true)
};
