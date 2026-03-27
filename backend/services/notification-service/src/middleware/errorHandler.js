const errorCodes = require("../constants/errorCodes");

const errorHandler = (error, req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    error: error.error || "INTERNAL_SERVER_ERROR",
    code: error.code || errorCodes.INTERNAL_ERROR,
    message: error.message || "Unexpected server error",
    details: error.details || null,
    traceId: req.traceId || null,
    timestamp: new Date().toISOString()
  });
};

module.exports = { errorHandler };
