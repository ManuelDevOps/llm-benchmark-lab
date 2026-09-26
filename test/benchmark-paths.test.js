"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  resolveBenchmarkSourceDir
} = require("../src/benchmark-paths");

test("resolves a relative sourceDir from the manifest directory", () => {
  const manifestPath = path.resolve(
    "fixtures",
    "benchmarks",
    "cart-total-v1.json"
  );

  const actual = resolveBenchmarkSourceDir(
    "packs/cart-total-v1",
    manifestPath
  );

  const expected = path.resolve(
    path.dirname(manifestPath),
    "packs/cart-total-v1"
  );

  assert.equal(actual, expected);
});

test("preserves and normalizes an absolute sourceDir", () => {
  const absoluteSourceDir = path.resolve(
    "fixtures",
    "packs",
    "cart-total-v1"
  );

  const manifestPath = path.resolve(
    "fixtures",
    "benchmarks",
    "cart-total-v1.json"
  );

  const actual = resolveBenchmarkSourceDir(
    absoluteSourceDir,
    manifestPath
  );

  assert.equal(actual, path.normalize(absoluteSourceDir));
});

test("rejects an empty sourceDir", () => {
  const manifestPath = path.resolve(
    "fixtures",
    "benchmarks",
    "cart-total-v1.json"
  );

  assert.throws(
    () => resolveBenchmarkSourceDir("", manifestPath),
    {
      name: "TypeError",
      message: "Benchmark sourceDir must be a non-empty string"
    }
  );
});

test("rejects an empty manifestPath", () => {
  assert.throws(
    () => resolveBenchmarkSourceDir("packs/cart-total-v1", ""),
    {
      name: "TypeError",
      message: "Benchmark manifestPath must be a non-empty string"
    }
  );
});
