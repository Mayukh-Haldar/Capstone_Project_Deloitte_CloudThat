const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
  process.env.NODE_ENV = "test";
  process.env.SEED_DEFAULT_TEMPLATES = "true";
  const { seedDefaultTemplates } = require("../../src/seeds/seedDefaultTemplates");
  await mongoose.connect(process.env.MONGO_URI);
  await seedDefaultTemplates();
});

test.after(async () => {
  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test("notification send creates records and user can mark one as read", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const sendResponse = await request(app)
    .post("/api/v1/notifications/send")
    .set("x-internal-service-key", "eventzen-internal-key")
    .send({
      eventType: "registration.confirmed",
      recipients: [
        {
          userId: "user-123",
          email: "user@example.com",
          phone: "+911234567890"
        }
      ],
      variables: {
        metadata: {
          eventName: "EventZen Summit",
          ticketCode: "EZ-1001"
        }
      }
    });

  assert.equal(sendResponse.status, 202);
  assert.equal(sendResponse.body.notifications.length, 2);

  const listResponse = await request(app)
    .get("/api/v1/notifications")
    .set("x-user-id", "user-123")
    .set("x-user-email", "user@example.com")
    .set("x-user-roles", "ATTENDEE");

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.totalElements, 2);

  const notificationId = listResponse.body.content[0]._id;

  const markReadResponse = await request(app)
    .patch(`/api/v1/notifications/${notificationId}/read`)
    .set("x-user-id", "user-123")
    .set("x-user-email", "user@example.com")
    .set("x-user-roles", "ATTENDEE")
    .send({ read: true });

  assert.equal(markReadResponse.status, 200);
  assert.equal(markReadResponse.body.status, "READ");
});

test("admin can list delivery logs", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .get("/api/v1/notifications/delivery-logs")
    .set("x-user-id", "admin-1")
    .set("x-user-email", "admin@example.com")
    .set("x-user-roles", "ADMIN");

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.content));
});
