const test = require("node:test");
const assert = require("node:assert/strict");
const { renderTemplate } = require("../../src/utils/templateRenderer");

test("renderTemplate interpolates variables into subject and body", () => {
  const result = renderTemplate(
    {
      subject: "Hello {{recipient.firstName}}",
      body: "Event {{metadata.eventName}} starts soon",
      html: "<p>{{metadata.eventName}}</p>"
    },
    {
      recipient: { firstName: "Mayuk" },
      metadata: { eventName: "EventZen Summit" }
    }
  );

  assert.equal(result.subject, "Hello Mayuk");
  assert.equal(result.body, "Event EventZen Summit starts soon");
  assert.equal(result.html, "<p>EventZen Summit</p>");
});
