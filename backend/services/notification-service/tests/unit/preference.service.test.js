const test = require("node:test");
const assert = require("node:assert/strict");
const { isChannelEnabled } = require("../../src/services/preferenceService");

test("isChannelEnabled returns false when a channel is disabled globally", () => {
  const preferences = {
    email: { enabled: false, eventTypes: [] }
  };

  assert.equal(isChannelEnabled(preferences, "EMAIL", "registration.confirmed"), false);
});

test("isChannelEnabled honors per-event allow lists", () => {
  const preferences = {
    inApp: { enabled: true, eventTypes: ["budget.alert.threshold"] }
  };

  assert.equal(isChannelEnabled(preferences, "IN_APP", "budget.alert.threshold"), true);
  assert.equal(isChannelEnabled(preferences, "IN_APP", "event.reminder.24h"), false);
});
