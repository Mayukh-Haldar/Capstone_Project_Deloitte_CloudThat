const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const venueRoutes = require("./routes/venues");
const vendorRoutes = require("./routes/vendors");
const eventRoutes = require("./routes/events");
const contractRoutes = require("./routes/contracts");
const healthRoutes = require("./routes/health");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");
const { metricsHandler, metricsMiddleware } = require("./observability/metrics");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",")
  })
);
app.use(express.json({ limit: "2mb" }));

if (env.enableRequestLogs) {
  app.use(morgan("dev"));
}

app.use(metricsMiddleware);
app.get("/metrics", metricsHandler);
app.use("/api/v1", healthRoutes);
app.use("/api/v1/venues", venueRoutes);
app.use("/api/v1/vendors", vendorRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/contracts", contractRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
