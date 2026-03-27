class ApiError extends Error {
  constructor(status, error, code, message, details = []) {
    super(message);
    this.status = status;
    this.error = error;
    this.code = code;
    this.details = details;
  }
}

module.exports = { ApiError };
