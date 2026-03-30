/**
 * Unit tests – template renderer extended edge cases
 * IDs: NTF-UT-023 to NTF-UT-026
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { renderTemplate } = require("../../src/utils/templateRenderer");

test("NTF-UT-023: renderTemplate returns null html when template html property is null", () => {
  const result = renderTemplate({ subject: "Hi", body: "Hello", html: null }, {});

  assert.equal(result.html, null);
});

test("NTF-UT-024: renderTemplate renders static content when variables map is empty", () => {
  const result = renderTemplate(
    { subject: "Static subject", body: "Static body", html: "<p>Static</p>" },
    {}
  );

  assert.equal(result.subject, "Static subject");
  assert.equal(result.body, "Static body");
  assert.equal(result.html, "<p>Static</p>");
});

test("NTF-UT-025: renderTemplate applies the registered uppercase Handlebars helper", () => {
  const result = renderTemplate(
    { subject: "{{uppercase eventType}}", body: "no-op", html: null },
    { eventType: "registration.confirmed" }
  );

  assert.equal(result.subject, "REGISTRATION.CONFIRMED");
});

test("NTF-UT-026: renderTemplate renders missing variable placeholders as empty string", () => {
  const result = renderTemplate(
    { subject: "Hello {{name}}", body: "Welcome {{company}}", html: null },
    {}
  );

  assert.equal(result.subject, "Hello ");
  assert.equal(result.body, "Welcome ");
});
