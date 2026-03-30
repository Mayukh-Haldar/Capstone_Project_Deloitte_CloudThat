/**
 * Integration tests – Webhook Subscription API
 * IDs: NTF-IT-020 to NTF-IT-024
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;
let webhookId;

const ADMIN_HEADERS = {
  "x-user-id": "admin-wh-1",
  "x-user-email": "admin.wh@eventzen.test",
  "x-user-roles": "ADMIN"
};

const ATTENDEE_HEADERS = {
  "x-user-id": "attendee-wh-1",
  "x-user-email": "attendee.wh@eventzen.test",
  "x-user-roles": "ATTENDEE"
};

const SAMPLE_SUBSCRIPTION = {
  eventType: "payment.received",
  url: "https://hooks.example.com/payment",
  secret: "super-secret-key-123"
};

test.before(async () => {
  databaseState = await connectTestDatabase("webhook");
});

test.after(async () => {
  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-020: admin creates a webhook subscription", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/webhook-subscriptions")
    .set(ADMIN_HEADERS)
    .send(SAMPLE_SUBSCRIPTION);

  assert.equal(response.status, 201);
  assert.equal(response.body.eventType, SAMPLE_SUBSCRIPTION.eventType);
  assert.equal(response.body.url, SAMPLE_SUBSCRIPTION.url);
  assert.ok(response.body._id);

  webhookId = response.body._id;
});

test("NTF-IT-021: admin lists webhook subscriptions and sees the created one", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/webhook-subscriptions")
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].eventType, SAMPLE_SUBSCRIPTION.eventType);
});

test("NTF-IT-022: admin deletes a webhook subscription", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .delete(`/api/v1/notifications/webhook-subscriptions/${webhookId}`)
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 204);
});

test("NTF-IT-023: deleted subscription is no longer in the list", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/webhook-subscriptions")
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 0);
});

test("NTF-IT-024: attendee cannot create a webhook subscription (403)", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/webhook-subscriptions")
    .set(ATTENDEE_HEADERS)
    .send(SAMPLE_SUBSCRIPTION);

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "AUTHORIZATION_ERROR");
});
