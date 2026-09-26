"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizePublicValue,
  createPublicBenchmarkResult
} = require("../src/public-result");

test("removes known local-path fields recursively", () => {
  const input = {
    runDir: "C:\\Users\\Example\\private\\run",
    nested: {
      rawOutputFile: "C:\\Users\\Example\\private\\output.txt",
      safe: "keep-me"
    }
  };

  assert.deepEqual(sanitizePublicValue(input), {
    nested: {
      safe: "keep-me"
    }
  });
});

test("replaces absolute local path strings", () => {
  const input = {
    windowsPath: "C:\\Users\\Example\\private\\file.txt",
    linuxPath: "/home/example/private/file.txt",
    macPath: "/Users/example/private/file.txt"
  };

  assert.deepEqual(sanitizePublicValue(input), {
    windowsPath: "[local path omitted]",
    linuxPath: "[local path omitted]",
    macPath: "[local path omitted]"
  });
});

test("preserves ordinary non-path strings and arrays", () => {
  const input = {
    url: "http://127.0.0.1:11434/api/tags",
    relativePath: "packs/cart-total-v1",
    values: ["safe", 42, true, null]
  };

  assert.deepEqual(sanitizePublicValue(input), input);
});

test("creates an allowlisted public benchmark result", () => {
  const result = {
    runId: "run-123",
    benchmarkId: "cart-total-v1",
    model: "example-model",
    validation: { ok: true },
    performance: { tokensPerSecond: 12.5 },
    evaluation: { passed: true },
    evaluationError: null,
    runDir: "C:\\Users\\Example\\private\\run",
    manifestPath: "C:\\Users\\Example\\private\\manifest.json",
    secretField: "must-not-escape"
  };

  assert.deepEqual(createPublicBenchmarkResult(result), {
    runId: "run-123",
    benchmarkId: "cart-total-v1",
    model: "example-model",
    validation: { ok: true },
    performance: { tokensPerSecond: 12.5 },
    evaluation: { passed: true },
    evaluationError: null
  });
});

test("rejects non-object benchmark results", () => {
  assert.throws(
    () => createPublicBenchmarkResult("invalid"),
    {
      name: "TypeError",
      message: "Benchmark result must be an object"
    }
  );
});
