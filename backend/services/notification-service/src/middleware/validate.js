const errorCodes = require("../constants/errorCodes");
const { ApiError } = require("../utils/apiError");

const validate = (schema, target = "body") => (req, _res, next) => {
  const result = schema.safeParse(req[target]);
  if (!result.success) {
    next(
      new ApiError(
        400,
        "VALIDATION_ERROR",
        errorCodes.VALIDATION_ERROR,
        "Validation failed",
        result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      )
    );
    return;
  }

  req[target] = result.data;
  next();
};

module.exports = { validate };
