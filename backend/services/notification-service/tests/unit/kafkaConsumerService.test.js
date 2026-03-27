const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeKafkaEvent } = require("../../src/services/kafkaConsumerService");

test("normalizeKafkaEvent maps topic and JSON payload into notification input", () => {
  const payload = {
    recipient: {
      userId: "user-1",
      email: "user@example.com"
    },
    metadata: {
      eventName: "EventZen Summit"
    }
  };

  const result = normalizeKafkaEvent({
    topic: "registration.confirmed",
    message: {
      value: Buffer.from(JSON.stringify(payload), "utf8"),
      headers: {
        "x-correlation-id": Buffer.from("corr-123", "utf8")
      }
    }
  });

  assert.equal(result.eventType, "registration.confirmed");
  assert.equal(result.correlationId, "corr-123");
  assert.equal(result.recipients.length, 1);
  assert.equal(result.recipients[0].email, "user@example.com");
  assert.equal(result.metadata.eventName, "EventZen Summit");
});
