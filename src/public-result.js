"use strict";

const path = require("node:path");

const OMITTED_KEYS = new Set([
  "runDir",
  "sourceDir",
  "manifestPath",
  "promptPath",
  "workspaceDir",
  "rawOutputFile"
]);

function containsAbsoluteLocalPath(value) {
  if (typeof value !== "string") {
    return false;
  }

  return (
    path.win32.isAbsolute(value) ||
    path.posix.isAbsolute(value) ||
    /[A-Za-z]:\\Users\\/i.test(value) ||
    /\/home\/[^/\s]+/i.test(value) ||
    /\/Users\/[^/\s]+/i.test(value)
  );
}

function sanitizePublicValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (containsAbsoluteLocalPath(value)) {
      return "[local path omitted]";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizePublicValue);
  }

  if (typeof value === "object") {
    const sanitized = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (OMITTED_KEYS.has(key)) {
        continue;
      }

      sanitized[key] =
        sanitizePublicValue(childValue);
    }

    return sanitized;
  }

  return value;
}

function createPublicBenchmarkResult(result) {
  if (
    !result ||
    typeof result !== "object" ||
    Array.isArray(result)
  ) {
    throw new TypeError(
      "Benchmark result must be an object"
    );
  }

  return sanitizePublicValue({
    runId: result.runId ?? null,
    benchmarkId: result.benchmarkId ?? null,
    model: result.model ?? null,
    validation: result.validation ?? null,
    performance: result.performance ?? null,
    evaluation: result.evaluation ?? null,
    evaluationError: result.evaluationError ?? null
  });
}

module.exports = {
  sanitizePublicValue,
  createPublicBenchmarkResult
};