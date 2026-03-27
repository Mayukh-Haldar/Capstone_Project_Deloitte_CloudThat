const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidContractTransition
} = require("../../src/services/contractService");

test("contract status transitions follow PRD lifecycle", () => {
  assert.equal(isValidContractTransition("PENDING", "SIGNED"), true);
  assert.equal(isValidContractTransition("SIGNED", "ACTIVE"), true);
  assert.equal(isValidContractTransition("ACTIVE", "COMPLETED"), true);
});

test("invalid contract transitions are rejected", () => {
  assert.equal(isValidContractTransition("PENDING", "ACTIVE"), false);
  assert.equal(isValidContractTransition("SIGNED", "COMPLETED"), false);
  assert.equal(isValidContractTransition("COMPLETED", "ACTIVE"), false);
});
