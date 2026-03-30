/**
 * Unit tests – HMAC signature utility
 * IDs: NTF-UT-004 to NTF-UT-007
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createSignature } = require("../../src/utils/signature");

test("NTF-UT-004: createSignature returns a sha256= prefixed hex string", () => {
  const result = createSignature("test-secret", '{"event":"test"}');

  assert.ok(result.startsWith("sha256="), "must start with sha256=");
  // "sha256=" (7 chars) + 64 hex chars = 71
  assert.equal(result.length, 71);
});

test("NTF-UT-005: createSignature is deterministic for identical inputs", () => {
  const result1 = createSignature("my-secret", "hello world");
  const result2 = createSignature("my-secret", "hello world");

  assert.equal(result1, result2);
});

test("NTF-UT-006: createSignature matches a manual HMAC-SHA256 computation", () => {
  const secret = "abc123";
  const payload = "test-payload";
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex");

  assert.equal(createSignature(secret, payload), expected);
});

test("NTF-UT-007: createSignature produces different digests for different secrets", () => {
  const payload = "same-payload";

  assert.notEqual(
    createSignature("secret-a", payload),
    createSignature("secret-b", payload)
  );
});
