const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");

const startServer = () =>
  new Promise((resolve) => {
    const server = createApp().listen(0, () => resolve(server));
  });

test("GET /api/v1/health returns service status", async () => {
  const server = await startServer();
  const address = server.address();

  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "UP");
  assert.ok(payload.service);

  await new Promise((resolve) => server.close(resolve));
});

test("unknown route returns EventZen-style error payload", async () => {
  const server = await startServer();
  const address = server.address();

  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/missing-route`);
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.error, "NOT_FOUND");
  assert.ok(payload.traceId);

  await new Promise((resolve) => server.close(resolve));
});
