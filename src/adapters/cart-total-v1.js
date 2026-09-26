"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function writeText(filePath, text) {
  fs.writeFileSync(
    filePath,
    text,
    {
      encoding: "utf8",
      flag: "w"
    }
  );
}

function writeJson(filePath, value) {
  writeText(
    filePath,
    JSON.stringify(value, null, 2)
  );
}

/*
 * Mechanically extract the first:
 *
 * function calculateCartTotal(...)
 *
 * declaration from the model response.
 *
 * This mirrors the historical cart-total-v1 evaluation
 * procedure. Braces inside strings and comments are ignored
 * so they cannot terminate the extracted function early.
 */
function extractCalculateCartTotal(responseText) {
  if (
    typeof responseText !== "string" ||
    responseText.length === 0
  ) {
    throw new Error(
      "Model response is empty"
    );
  }

  const marker =
    "function calculateCartTotal";

  const start =
    responseText.indexOf(marker);

  if (start < 0) {
    throw new Error(
      "Could not find function calculateCartTotal in model response"
    );
  }

  const openBrace =
    responseText.indexOf("{", start);

  if (openBrace < 0) {
    throw new Error(
      "Could not find opening brace for calculateCartTotal"
    );
  }

  let depth = 0;
  let state = "code";
  let escaped = false;
  let end = -1;

  for (
    let i = openBrace;
    i < responseText.length;
    i += 1
  ) {
    const current =
      responseText[i];

    const next =
      i + 1 < responseText.length
        ? responseText[i + 1]
        : "";

    if (state === "line-comment") {
      if (
        current === "\n" ||
        current === "\r"
      ) {
        state = "code";
      }

      continue;
    }

    if (state === "block-comment") {
      if (
        current === "*" &&
        next === "/"
      ) {
        state = "code";
        i += 1;
      }

      continue;
    }

    if (state === "single-quote") {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === "\\") {
        escaped = true;
        continue;
      }

      if (current === "'") {
        state = "code";
      }

      continue;
    }

    if (state === "double-quote") {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === "\\") {
        escaped = true;
        continue;
      }

      if (current === '"') {
        state = "code";
      }

      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (current === "\\") {
        escaped = true;
        continue;
      }

      if (current === "`") {
        state = "code";
      }

      continue;
    }

    if (
      current === "/" &&
      next === "/"
    ) {
      state = "line-comment";
      i += 1;
      continue;
    }

    if (
      current === "/" &&
      next === "*"
    ) {
      state = "block-comment";
      i += 1;
      continue;
    }

    if (current === "'") {
      state = "single-quote";
      escaped = false;
      continue;
    }

    if (current === '"') {
      state = "double-quote";
      escaped = false;
      continue;
    }

    if (current === "`") {
      state = "template";
      escaped = false;
      continue;
    }

    if (current === "{") {
      depth += 1;
      continue;
    }

    if (current === "}") {
      depth -= 1;

      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(
      "Could not find complete closing brace for calculateCartTotal"
    );
  }

  const functionText =
    responseText.slice(
      start,
      end + 1
    );

  const implementation =
    functionText +
    "\r\n\r\n" +
    "module.exports = { calculateCartTotal };\r\n";

  return {
    start,
    end,
    functionText,
    implementation
  };
}

function parseHiddenSummary(stdout) {
  if (typeof stdout !== "string") {
    return null;
  }

  const marker =
    "=== SUMMARY ===";

  const markerIndex =
    stdout.lastIndexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const afterMarker =
    stdout
      .slice(
        markerIndex + marker.length
      )
      .trim();

  const firstBrace =
    afterMarker.indexOf("{");

  if (firstBrace < 0) {
    return null;
  }

  const jsonText =
    afterMarker
      .slice(firstBrace)
      .trim();

  try {
    const parsed =
      JSON.parse(jsonText);

    if (
      !parsed ||
      !parsed.A ||
      !parsed.B
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function runNode(args) {
  return spawnSync(
    process.execPath,
    args,
    {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    }
  );
}

function evaluateCartTotal({
  responseText,
  manifest,
  runDir
}) {
  if (
    !manifest ||
    manifest.id !== "cart-total-v1"
  ) {
    throw new Error(
      "cart-total-v1 adapter received the wrong benchmark manifest"
    );
  }

  if (
    typeof runDir !== "string" ||
    runDir.length === 0
  ) {
    throw new Error(
      "Evaluation run directory is required"
    );
  }

  fs.mkdirSync(
    runDir,
    {
      recursive: true
    }
  );

  const evaluation = {
    benchmarkId:
      "cart-total-v1",

    extraction: {
      success: false
    },

    syntax: {
      checked: false,
      passed: false
    },

    hiddenTests: {
      ran: false,
      summary: null
    }
  };

  let extracted;

  try {
    extracted =
      extractCalculateCartTotal(
        responseText
      );

    evaluation.extraction = {
      success: true,
      start:
        extracted.start,
      end:
        extracted.end,
      functionLength:
        extracted.functionText.length
    };
  } catch (error) {
    evaluation.extraction = {
      success: false,
      error:
        error.message
    };

    writeJson(
      path.join(
        runDir,
        "evaluation.json"
      ),
      evaluation
    );

    return evaluation;
  }

  const candidatePath =
    path.join(
      runDir,
      "candidate.js"
    );

  writeText(
    candidatePath,
    extracted.implementation
  );

  const syntaxResult =
    runNode([
      "--check",
      candidatePath
    ]);

  const syntaxOutput = [
    syntaxResult.stdout || "",
    syntaxResult.stderr || ""
  ].join("");

  writeText(
    path.join(
      runDir,
      "syntax-check.txt"
    ),
    syntaxOutput
  );

  evaluation.syntax = {
    checked: true,
    passed:
      syntaxResult.status === 0 &&
      !syntaxResult.error,

    exitCode:
      syntaxResult.status,

    signal:
      syntaxResult.signal || null,

    error:
      syntaxResult.error
        ? syntaxResult.error.message
        : null
  };

  if (!evaluation.syntax.passed) {
    writeJson(
      path.join(
        runDir,
        "evaluation.json"
      ),
      evaluation
    );

    return evaluation;
  }

  const hiddenRunnerPath =
    path.join(
      manifest.sourceDir,
      "hidden-runner-v1.js"
    );

  if (!fs.existsSync(hiddenRunnerPath)) {
    throw new Error(
      `Frozen hidden runner not found: ${hiddenRunnerPath}`
    );
  }

  const hiddenResult =
    runNode([
      hiddenRunnerPath,
      candidatePath
    ]);

  const hiddenStdout =
    hiddenResult.stdout || "";

  const hiddenStderr =
    hiddenResult.stderr || "";

  writeText(
    path.join(
      runDir,
      "hidden-tests-output.txt"
    ),
    hiddenStdout + hiddenStderr
  );

  const summary =
    parseHiddenSummary(
      hiddenStdout
    );

  evaluation.hiddenTests = {
    ran: true,

    exitCode:
      hiddenResult.status,

    signal:
      hiddenResult.signal || null,

    processError:
      hiddenResult.error
        ? hiddenResult.error.message
        : null,

    summaryParsed:
      summary !== null,

    summary,

    explicitRequirements:
      summary
        ? {
            passed:
              summary.A.passed,
            total:
              summary.A.total
          }
        : null,

    engineeringRobustness:
      summary
        ? {
            passed:
              summary.B.passed,
            total:
              summary.B.total
          }
        : null
  };

  /*
   * Deliberately do not infer an overall PASS from
   * hiddenResult.status.
   *
   * The frozen hidden runner sets its process exit code
   * from section A only. Sections A and B therefore remain
   * separate benchmark results.
   */

  writeJson(
    path.join(
      runDir,
      "evaluation.json"
    ),
    evaluation
  );

  return evaluation;
}

module.exports = {
  extractCalculateCartTotal,
  parseHiddenSummary,
  evaluateCartTotal
};