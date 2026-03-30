/**
 * Unit tests – pagination helpers
 * IDs: NTF-UT-008 to NTF-UT-013
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePagination, buildPage } = require("../../src/utils/pagination");

test("NTF-UT-008: parsePagination applies default page=0 size=20 for empty query", () => {
  const { page, size, skip } = parsePagination({});

  assert.equal(page, 0);
  assert.equal(size, 20);
  assert.equal(skip, 0);
});

test("NTF-UT-009: parsePagination parses numeric page and size and computes skip", () => {
  const { page, size, skip } = parsePagination({ page: "2", size: "10" });

  assert.equal(page, 2);
  assert.equal(size, 10);
  assert.equal(skip, 20);
});

test("NTF-UT-010: parsePagination clamps size to 100 maximum", () => {
  const { size } = parsePagination({ size: "500" });

  assert.equal(size, 100);
});

test("NTF-UT-011: parsePagination clamps page to 0 minimum", () => {
  const { page } = parsePagination({ page: "-3" });

  assert.equal(page, 0);
});

test("NTF-UT-012: buildPage calculates totalPages and maps content fields", () => {
  const items = [{ id: 1 }, { id: 2 }];
  const result = buildPage({ items, page: 0, size: 20, totalElements: 45 });

  assert.equal(result.totalPages, 3);
  assert.equal(result.totalElements, 45);
  assert.equal(result.page, 0);
  assert.equal(result.size, 20);
  assert.deepEqual(result.content, items);
});

test("NTF-UT-013: buildPage returns totalPages=0 when there are no elements", () => {
  const result = buildPage({ items: [], page: 0, size: 20, totalElements: 0 });

  assert.equal(result.totalPages, 0);
  assert.deepEqual(result.content, []);
});
