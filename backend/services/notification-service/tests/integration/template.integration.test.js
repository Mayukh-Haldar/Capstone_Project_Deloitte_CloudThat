/**
 * Integration tests – Notification Template API
 * IDs: NTF-IT-006 to NTF-IT-011
 *
 * Uses an in-memory MongoDB instance and supertest to drive the HTTP layer.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;
let templateId;

const ADMIN_HEADERS = {
  "x-user-id": "admin-1",
  "x-user-email": "admin@eventzen.test",
  "x-user-roles": "ADMIN"
};

const ATTENDEE_HEADERS = {
  "x-user-id": "attendee-1",
  "x-user-email": "attendee@eventzen.test",
  "x-user-roles": "ATTENDEE"
};

const NEW_TEMPLATE = {
  templateKey: "test.event.EMAIL",
  eventType: "test.event",
  channel: "EMAIL",
  locale: "en",
  subject: "Hello {{recipient.name}}",
  body: "Your event {{metadata.eventName}} has been confirmed.",
  html: "<p>Event: <strong>{{metadata.eventName}}</strong></p>",
  variables: ["recipient.name", "metadata.eventName"]
};

test.before(async () => {
  databaseState = await connectTestDatabase("template");
});

test.after(async () => {
  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-006: admin lists templates returns empty array initially", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/templates")
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.equal(response.body.length, 0);
});

test("NTF-IT-007: admin creates a new notification template", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/templates")
    .set(ADMIN_HEADERS)
    .send(NEW_TEMPLATE);

  assert.equal(response.status, 201);
  assert.equal(response.body.templateKey, NEW_TEMPLATE.templateKey);
  assert.equal(response.body.channel, "EMAIL");
  assert.ok(response.body._id);

  templateId = response.body._id;
});

test("NTF-IT-008: admin updates the template subject and body", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .put(`/api/v1/notifications/templates/${templateId}`)
    .set(ADMIN_HEADERS)
    .send({ subject: "Updated: {{metadata.eventName}}" });

  assert.equal(response.status, 200);
  assert.equal(response.body.subject, "Updated: {{metadata.eventName}}");
  assert.equal(response.body.versions.length, 2); // original + update
});

test("NTF-IT-009: admin previews a template with runtime variables", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post(`/api/v1/notifications/templates/${templateId}/preview`)
    .set(ADMIN_HEADERS)
    .send({
      variables: {
        recipient: { name: "Alice" },
        metadata: { eventName: "EventZen Summit" }
      }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.subject, "Updated: EventZen Summit");
  assert.ok(response.body.body.includes("EventZen Summit"));
});

test("NTF-IT-010: non-admin cannot create a template (403)", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/templates")
    .set(ATTENDEE_HEADERS)
    .send(NEW_TEMPLATE);

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "AUTHORIZATION_ERROR");
});

test("NTF-IT-011: created template appears in subsequent admin list", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/templates")
    .set(ADMIN_HEADERS);

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].templateKey, NEW_TEMPLATE.templateKey);
});
