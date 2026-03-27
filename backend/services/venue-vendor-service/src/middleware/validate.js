const { ZodError } = require("zod");
const errorCodes = require("../constants/errorCodes");
const { ApiError } = require("../utils/apiError");

const validate = (schema) => (req, _res, next) => {
  try {
    const result = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    req.body = result.body;
    req.params = result.params;
    req.query = result.query;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }));

      next(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          errorCodes.VALIDATION_ERROR,
          "Request validation failed",
          details
        )
      );
      return;
    }
    next(error);
  }
};

module.exports = { validate };
