/**
 * Integration tests – Push Token API
 * IDs: NTF-IT-016 to NTF-IT-019
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;

const USER_HEADERS = {
  "x-user-id": "user-push-1",
  "x-user-email": "push.user@eventzen.test",
  "x-user-roles": "ATTENDEE"
};

// Well-formed push token (>= 16 chars as required by validator)
const SAMPLE_TOKEN = "fcm-token-abc123xyz456789";

test.before(async () => {
  databaseState = await connectTestDatabase("push_token");
});

test.after(async () => {
  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-016: user registers a push token", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/push-tokens")
    .set(USER_HEADERS)
    .send({ token: SAMPLE_TOKEN, platform: "web" });

  assert.equal(response.status, 201);
  assert.equal(response.body.token, SAMPLE_TOKEN);
  assert.equal(response.body.userId, USER_HEADERS["x-user-id"]);
  assert.equal(response.body.isActive, true);
});

test("NTF-IT-017: user lists active push tokens and sees the registered token", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/push-tokens")
    .set(USER_HEADERS);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].token, SAMPLE_TOKEN);
});

test("NTF-IT-018: user deactivates a push token", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .delete("/api/v1/notifications/push-tokens")
    .set(USER_HEADERS)
    .send({ token: SAMPLE_TOKEN });

  assert.equal(response.status, 204);
});

test("NTF-IT-019: deactivated token is no longer returned in the active tokens list", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/push-tokens")
    .set(USER_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 0);
});
