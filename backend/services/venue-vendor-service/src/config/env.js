const dotenv = require("dotenv");

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  appName: process.env.SERVICE_NAME || "venue-vendor-service",
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 8083),
  mongoUri:
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/eventzen_venue_vendor",
  jwtSecret:
    process.env.AUTH_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "change-me-change-me-change-me-change-me-1234567890",
  jwtIssuer: process.env.AUTH_JWT_ISSUER || "eventzen-auth-service",
  notificationServiceBaseUrl: process.env.NOTIFICATION_SERVICE_BASE_URL || "http://localhost:8086",
  notificationInternalServiceKey:
    process.env.NOTIFICATION_INTERNAL_SERVICE_KEY ||
    "eventzen-internal-key",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  enableRequestLogs: process.env.ENABLE_REQUEST_LOGS !== "false"
};
