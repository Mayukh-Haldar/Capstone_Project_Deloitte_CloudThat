const crypto = require("crypto");

const requestContext = (req, res, next) => {
  const traceId = req.header("x-trace-id") || crypto.randomUUID();
  req.traceId = traceId;
  res.setHeader("x-trace-id", traceId);
  next();
};

module.exports = { requestContext };
