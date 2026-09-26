"use strict";

const path = require("node:path");

function resolveBenchmarkSourceDir(
  sourceDir,
  manifestPath
) {
  if (
    typeof sourceDir !== "string" ||
    sourceDir.trim() === ""
  ) {
    throw new TypeError(
      "Benchmark sourceDir must be a non-empty string"
    );
  }

  if (
    typeof manifestPath !== "string" ||
    manifestPath.trim() === ""
  ) {
    throw new TypeError(
      "Benchmark manifestPath must be a non-empty string"
    );
  }

  if (path.isAbsolute(sourceDir)) {
    return path.normalize(sourceDir);
  }

  return path.resolve(
    path.dirname(manifestPath),
    sourceDir
  );
}

module.exports = {
  resolveBenchmarkSourceDir
};