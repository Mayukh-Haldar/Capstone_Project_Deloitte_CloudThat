/**
 * Unit tests – preferenceService.isChannelEnabled extended cases
 * IDs: NTF-UT-027 to NTF-UT-030
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { isChannelEnabled } = require("../../src/services/preferenceService");

test("NTF-UT-027: isChannelEnabled returns true for an unrecognised channel key", () => {
  // "SMS" has no mapping — default to allowed
  assert.equal(isChannelEnabled({}, "SMS", "payment.received"), true);
});

test("NTF-UT-028: isChannelEnabled returns true when preferences object is null", () => {
  assert.equal(isChannelEnabled(null, "EMAIL", "user.registered"), true);
});

test("NTF-UT-029: isChannelEnabled returns true when eventTypes list is empty (allow all)", () => {
  const prefs = { email: { enabled: true, eventTypes: [] } };

  assert.equal(isChannelEnabled(prefs, "EMAIL", "any.event.type"), true);
});

test("NTF-UT-030: isChannelEnabled blocks events not present in the eventTypes allow-list", () => {
  const prefs = { push: { enabled: true, eventTypes: ["event.reminder.1h"] } };

  assert.equal(isChannelEnabled(prefs, "PUSH", "payment.received"), false);
  assert.equal(isChannelEnabled(prefs, "PUSH", "event.reminder.1h"), true);
});
