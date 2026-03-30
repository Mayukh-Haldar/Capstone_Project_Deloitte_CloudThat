/**
 * Integration tests – Notification management (get single, delete, filters, auth guards)
 * IDs: NTF-IT-025 to NTF-IT-031
 *
 * Seeds one notification via the internal send endpoint before running individual tests.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;
let notificationId;

const OWNER_HEADERS = {
  "x-user-id": "user-mgmt-1",
  "x-user-email": "owner@eventzen.test",
  "x-user-roles": "ATTENDEE"
};
const OTHER_USER_HEADERS = {
  "x-user-id": "user-mgmt-2",
  "x-user-email": "other@eventzen.test",
  "x-user-roles": "ATTENDEE"
};
const ADMIN_HEADERS = {
  "x-user-id": "admin-mgmt-1",
  "x-user-email": "admin@eventzen.test",
  "x-user-roles": "ADMIN"
};

const SEND_PAYLOAD = {
  eventType: "event.published",
  channels: ["IN_APP"],
  recipients: [{ userId: "user-mgmt-1", email: "owner@eventzen.test" }],
  title: "Your event is live",
  body: "EventZen Summit has been published.",
  metadata: {}
};

test.before(async () => {
  databaseState = await connectTestDatabase("notification_management");

  // Seed one notification so subsequent tests have data to work with
  const { createApp } = require("../../src/app");
  const app = createApp();

  const seedResponse = await request(app)
    .post("/api/v1/notifications/send")
    .set("x-internal-service-key", "eventzen-internal-key")
    .send(SEND_PAYLOAD);

  notificationId = seedResponse.body.notifications[0]._id;
});

test.after(async () => {
  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-025: owner retrieves a single notification by ID", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get(`/api/v1/notifications/${notificationId}`)
    .set(OWNER_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body._id, notificationId);
  assert.ok(Array.isArray(response.body.deliveryLogs));
});

test("NTF-IT-026: a different user cannot access someone else's notification (403)", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get(`/api/v1/notifications/${notificationId}`)
    .set(OTHER_USER_HEADERS);

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "AUTHORIZATION_ERROR");
});

test("NTF-IT-027: admin can access any user's notification", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get(`/api/v1/notifications/${notificationId}`)
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body._id, notificationId);
});

test("NTF-IT-028: inbox supports filtering by channel", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const inAppResponse = await request(app)
    .get("/api/v1/notifications?channel=IN_APP")
    .set(OWNER_HEADERS);

  const emailResponse = await request(app)
    .get("/api/v1/notifications?channel=EMAIL")
    .set(OWNER_HEADERS);

  assert.equal(inAppResponse.status, 200);
  assert.equal(inAppResponse.body.totalElements, 1);

  assert.equal(emailResponse.status, 200);
  assert.equal(emailResponse.body.totalElements, 0);
});

test("NTF-IT-029: inbox returns only unread when unreadOnly=true", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications?unreadOnly=true")
    .set(OWNER_HEADERS);

  assert.equal(response.status, 200);
  assert.ok(response.body.totalElements >= 1);
  for (const item of response.body.content) {
    assert.notEqual(item.status, "READ");
  }
});

test("NTF-IT-030: owner can soft-delete own notification", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const deleteResponse = await request(app)
    .delete(`/api/v1/notifications/${notificationId}`)
    .set(OWNER_HEADERS);

  assert.equal(deleteResponse.status, 204);

  // Deleted notification must not appear in inbox
  const listResponse = await request(app)
    .get("/api/v1/notifications")
    .set(OWNER_HEADERS);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.totalElements, 0);
});

test("NTF-IT-031: unauthenticated inbox request returns 401", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  const response = await request(app)
    .get("/api/v1/notifications");

  process.env.NODE_ENV = original;

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "AUTHENTICATION_ERROR");
});
