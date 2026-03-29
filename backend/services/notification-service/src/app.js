const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { requestContext } = require("./middleware/requestContext");
const healthRoutes = require("./routes/health");
const { createNotificationRouter } = require("./routes/notifications");
const templateRoutes = require("./routes/templates");
const preferenceRoutes = require("./routes/preferences");
const webhookRoutes = require("./routes/webhooks");
const pushTokenRoutes = require("./routes/pushTokens");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { metricsHandler, metricsMiddleware } = require("./observability/metrics");
const { buildOpenApiDocument } = require("./openapi");

const createApp = ({ io = null } = {}) => {
  const app = express();
  app.locals.io = io;

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",")
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(requestContext);

  if (env.enableRequestLogs) {
    app.use(morgan("dev"));
  }

  app.use(metricsMiddleware);
  app.get("/metrics", metricsHandler);
  app.get("/openapi.json", (_req, res) => {
    res.json(buildOpenApiDocument());
  });
  app.use("/api/v1", healthRoutes);
  app.use("/api/v1/notifications/templates", templateRoutes);
  app.use("/api/v1/notifications/preferences", preferenceRoutes);
  app.use("/api/v1/notifications/webhook-subscriptions", webhookRoutes);
  app.use("/api/v1/notifications/push-tokens", pushTokenRoutes);
  app.use("/api/v1/notifications", createNotificationRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
