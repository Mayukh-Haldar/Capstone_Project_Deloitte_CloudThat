const client = require("prom-client");

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "eventzen_notification_" });

const httpDuration = new client.Histogram({
  name: "eventzen_notification_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register]
});

const metricsMiddleware = (req, res, next) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: String(res.statusCode)
    });
  });
  next();
};

const metricsHandler = async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};

module.exports = { metricsMiddleware, metricsHandler };
