const errorCodes = require("../constants/errorCodes");

const notFound = (req, _res, next) => {
  next({
    status: 404,
    error: "NOT_FOUND",
    code: errorCodes.NOT_FOUND,
    message: `Route ${req.method} ${req.originalUrl} was not found`
  });
};

module.exports = { notFound };
