const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { extractRoles, normalizeRole } = require("../../src/middleware/auth");

test("normalizeRole strips ROLE_ prefix and uppercases", () => {
  assert.equal(normalizeRole("role_admin"), "ADMIN");
  assert.equal(normalizeRole("organizer"), "ORGANIZER");
});

test("extractRoles reads authorities claim from auth-service token payload", () => {
  const roles = extractRoles({
    authorities: ["ROLE_ADMIN", "ROLE_ORGANIZER"]
  });
  assert.deepEqual(roles, ["ADMIN", "ORGANIZER"]);
});

test("auth-service compatible token contains expected claims", () => {
  const secret = "change-me-change-me-change-me-change-me-1234567890";
  const token = jwt.sign(
    {
      type: "access",
      uid: "11111111-1111-1111-1111-111111111111",
      authorities: ["ROLE_ADMIN"]
    },
    secret,
    {
      issuer: "eventzen-auth-service",
      subject: "admin@eventzen.local",
      expiresIn: "15m"
    }
  );

  const claims = jwt.verify(token, secret, { issuer: "eventzen-auth-service" });
  assert.equal(claims.type, "access");
  assert.equal(claims.uid, "11111111-1111-1111-1111-111111111111");
});
