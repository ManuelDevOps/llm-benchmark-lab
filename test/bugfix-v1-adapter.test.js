"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractHistoricalPatchFallback
} = require("../src/adapters/bugfix-v1");

test("historical patch fallback preserves trailing Markdown fence", () => {
  const responseText = [
    "### PATCH",
    "```diff",
    "--- a/buggy-v1.js",
    "+++ b/buggy-v1.js",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "```"
  ].join("\n");

  const actual =
    extractHistoricalPatchFallback(
      responseText
    );

  assert.deepEqual(actual, {
    success: true,
    reason: null,
    patch: [
      "--- a/buggy-v1.js",
      "+++ b/buggy-v1.js",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "```"
    ].join("\n")
  });
});
