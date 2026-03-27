const { randomUUID } = require("node:crypto");
const errorCodes = require("../constants/errorCodes");

const errorHandler = (error, req, res, _next) => {
  const status = error.status || 500;
  const traceId = req.header("x-trace-id") || randomUUID();

  const payload = {
    timestamp: new Date().toISOString(),
    status,
    error: error.error || (status >= 500 ? "SYSTEM_ERROR" : "REQUEST_ERROR"),
    code: error.code || errorCodes.SYSTEM_ERROR,
    message: error.message || "An unexpected error occurred",
    path: req.originalUrl,
    traceId,
    details: Array.isArray(error.details) ? error.details : []
  };

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(error);
  }

  res.status(status).json(payload);
};

module.exports = { errorHandler };
