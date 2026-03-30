/**
 * Unit tests – auth middleware helper functions (normalizeRole, extractRoles)
 * IDs: NTF-UT-017 to NTF-UT-022
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRole, extractRoles } = require("../../src/middleware/auth");

test("NTF-UT-017: normalizeRole strips the ROLE_ prefix and uppercases", () => {
  assert.equal(normalizeRole("ROLE_ADMIN"), "ADMIN");
  assert.equal(normalizeRole("role_admin"), "ADMIN");
  assert.equal(normalizeRole("ROLE_ORGANIZER"), "ORGANIZER");
});

test("NTF-UT-018: normalizeRole returns null for falsy input", () => {
  assert.equal(normalizeRole(null), null);
  assert.equal(normalizeRole(""), null);
  assert.equal(normalizeRole(undefined), null);
});

test("NTF-UT-019: normalizeRole uppercases role strings without the prefix", () => {
  assert.equal(normalizeRole("attendee"), "ATTENDEE");
  assert.equal(normalizeRole("Organizer"), "ORGANIZER");
  assert.equal(normalizeRole("VENDOR"), "VENDOR");
});

test("NTF-UT-020: extractRoles reads from the roles claim array", () => {
  const claims = { roles: ["ADMIN", "ORGANIZER"] };

  assert.deepEqual(extractRoles(claims), ["ADMIN", "ORGANIZER"]);
});

test("NTF-UT-021: extractRoles falls back to the authorities claim array and strips prefix", () => {
  const claims = { authorities: ["ROLE_ATTENDEE", "ROLE_VENDOR"] };

  assert.deepEqual(extractRoles(claims), ["ATTENDEE", "VENDOR"]);
});

test("NTF-UT-022: extractRoles returns empty array when both claims are absent or invalid", () => {
  assert.deepEqual(extractRoles({}), []);
  assert.deepEqual(extractRoles({ roles: null }), []);
  assert.deepEqual(extractRoles({ roles: "ADMIN" }), []); // not an array
});
