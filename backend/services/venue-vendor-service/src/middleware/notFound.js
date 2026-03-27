const errorCodes = require("../constants/errorCodes");
const { ApiError } = require("../utils/apiError");

const notFound = (req, _res, next) => {
  next(
    new ApiError(
      404,
      "NOT_FOUND",
      errorCodes.NOT_FOUND,
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
};

module.exports = { notFound };
