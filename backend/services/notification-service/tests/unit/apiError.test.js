/**
 * Unit tests – ApiError utility class
 * IDs: NTF-UT-014 to NTF-UT-016
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { ApiError } = require("../../src/utils/apiError");

test("NTF-UT-014: ApiError stores status, error, code, and message properties", () => {
  const err = new ApiError(404, "NOT_FOUND", "GEN-1004", "Resource not found");

  assert.equal(err.status, 404);
  assert.equal(err.error, "NOT_FOUND");
  assert.equal(err.code, "GEN-1004");
  assert.equal(err.message, "Resource not found");
  assert.equal(err.details, undefined);
});

test("NTF-UT-015: ApiError stores a validation details array", () => {
  const details = [{ path: "email", message: "Invalid email" }];
  const err = new ApiError(400, "VALIDATION_ERROR", "GEN-1001", "Validation failed", details);

  assert.deepEqual(err.details, details);
});

test("NTF-UT-016: ApiError is an instance of the built-in Error class", () => {
  const err = new ApiError(500, "INTERNAL_SERVER_ERROR", "GEN-1500", "Unexpected error");

  assert.ok(err instanceof Error);
  assert.equal(err.message, "Unexpected error");
});
