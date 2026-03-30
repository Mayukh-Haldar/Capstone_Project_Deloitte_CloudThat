/**
 * Integration tests – Notification Preferences API
 * IDs: NTF-IT-012 to NTF-IT-015
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;

const USER_HEADERS = {
  "x-user-id": "user-pref-1",
  "x-user-email": "pref.user@eventzen.test",
  "x-user-roles": "ATTENDEE"
};

test.before(async () => {
  databaseState = await connectTestDatabase("preference");
});

test.after(async () => {
  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-012: get preferences auto-creates and returns defaults for a new user", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/preferences")
    .set(USER_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body.userId, USER_HEADERS["x-user-id"]);
  assert.equal(response.body.email.enabled, true);
  assert.equal(response.body.push.enabled, true);
  assert.equal(response.body.inApp.enabled, true);
});

test("NTF-IT-013: user updates preferences to mute the email channel", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/preferences")
    .set(USER_HEADERS)
    .send({ email: { enabled: false, eventTypes: [] } });

  assert.equal(response.status, 200);
  assert.equal(response.body.email.enabled, false);
});

test("NTF-IT-014: muted preference persists on a subsequent get", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/preferences")
    .set(USER_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body.email.enabled, false);
  assert.equal(response.body.push.enabled, true); // unchanged
});

test("NTF-IT-015: unauthenticated preference request returns 401", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  // Override NODE_ENV briefly so dev fallback is inactive
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const response = await request(app)
    .get("/api/v1/notifications/preferences");

  process.env.NODE_ENV = original;

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "AUTHENTICATION_ERROR");
});
