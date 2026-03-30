/**
 * Integration tests – Newsletter Subscription API
 * IDs: NTF-IT-032 to NTF-IT-034
 *
 * Uses an in-memory MongoDB instance and patches env.smtpHost to empty string
 * so that sendEmail falls back to the built-in mock provider (no real SMTP).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { connectTestDatabase, disconnectTestDatabase } = require("./support/testDatabase");

let databaseState;

// Patch the env module to disable SMTP so sendEmail uses the mock provider.
// Must be done before app modules are first required in this process.
let savedSmtpHost;

test.before(async () => {
  databaseState = await connectTestDatabase("newsletter");

  // Blank SMTP host so isEmailConfigured() returns false → mock email path.
  // Works whether env.js is freshly loaded or already cached from a prior test.
  const envModule = require("../../src/config/env");
  savedSmtpHost = envModule.smtpHost;
  envModule.smtpHost = "";
});

test.after(async () => {
  // Restore original SMTP host so other tests are not affected.
  const envModule = require("../../src/config/env");
  envModule.smtpHost = savedSmtpHost;

  await disconnectTestDatabase(databaseState);
});

test("NTF-IT-032: new subscriber receives success message", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/newsletter/subscribe")
    .send({ email: "newsletter-test@eventzen.test" });

  assert.equal(response.status, 200);
  assert.ok(
    response.body.message.toLowerCase().includes("subscribed"),
    `Expected subscription confirmation message, got: ${response.body.message}`
  );
});

test("NTF-IT-033: duplicate subscription returns graceful 200 without re-sending email", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  // Second request for the same email — already subscribed from NTF-IT-032
  const response = await request(app)
    .post("/api/v1/notifications/newsletter/subscribe")
    .send({ email: "newsletter-test@eventzen.test" });

  assert.equal(response.status, 200);
  assert.ok(
    response.body.message.toLowerCase().includes("already"),
    `Expected 'already subscribed' message, got: ${response.body.message}`
  );
});

test("NTF-IT-034: invalid email address returns 400 validation error", async () => {
  const { createApp } = require("../../src/app");
  const app = createApp();

  const response = await request(app)
    .post("/api/v1/notifications/newsletter/subscribe")
    .send({ email: "not-an-email" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "VALIDATION_ERROR");
});
