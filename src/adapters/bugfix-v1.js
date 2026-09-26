"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const EXACT_FINDINGS_MARKER =
  "=== FINDINGS ===";

const EXACT_PATCH_MARKER =
  "=== PATCH ===";

const REQUIRED_OLD_HEADER =
  "--- a/buggy-v1.js";

const REQUIRED_NEW_HEADER =
  "+++ b/buggy-v1.js";

/*
 * These names are frozen by scoring-rubric-v1.md.
 *
 * Functional tests contribute to A.
 * Regression tests contribute to B.
 */
const FUNCTIONAL_TESTS = {
  "reserveInventory does not modify stock or order lines": 8,

  "reserveInventory rejects combined duplicate quantity above available stock atomically": 8,

  "calculateOrderTotal rounds discount once from the complete merchandise subtotal": 8,

  "calculateOrderTotal gives free shipping at exactly 5000 pence after discount": 4,

  "calculateOrderTotal accepts both discount boundaries": 4,

  "selectDispatchBatch skips an overweight order and continues with later orders": 8,

  "selectDispatchBatch includes an order that exactly reaches the weight limit": 4,

  "selectDispatchBatch supports zero capacity and zero-weight orders": 4
};

const REGRESSION_TESTS = [
  "reserveInventory subtracts requested stock and preserves unrelated SKUs",

  "reserveInventory combines duplicate SKUs before checking availability",

  "reserveInventory rejects an unknown SKU and leaves stock unchanged",

  "reserveInventory rejects invalid order-line data",

  "calculateOrderTotal calculates subtotal, discount, shipping and total",

  "calculateOrderTotal charges shipping below 5000 pence after discount",

  "calculateOrderTotal rejects discount percentages outside the allowed range",

  "calculateOrderTotal rejects invalid order-line data",

  "selectDispatchBatch does not modify its input array or order objects",

  "selectDispatchBatch rejects invalid orders even when they occur later in the array",

  "selectDispatchBatch rejects an invalid maximum weight"
];

function writeText(filePath, text) {
  fs.writeFileSync(
    filePath,
    text,
    {
      encoding: "utf8"
    }
  );
}

function writeJson(filePath, value) {
  writeText(
    filePath,
    JSON.stringify(value, null, 2) + "\n"
  );
}

function normalizeNewlines(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function countOccurrences(text, needle) {
  let count = 0;
  let position = 0;

  while (true) {
    const index =
      text.indexOf(
        needle,
        position
      );

    if (index === -1) {
      return count;
    }

    count += 1;
    position =
      index + needle.length;
  }
}

/*
 * Exact frozen extraction.
 *
 * No fallback is used here. Adding a new fallback after the benchmark
 * was frozen would change E5 semantics and historical comparability.
 */
function extractExactSections(responseText) {
  if (typeof responseText !== "string") {
    throw new TypeError(
      "responseText must be a string"
    );
  }

  const text =
    normalizeNewlines(responseText);

  const findingsCount =
    countOccurrences(
      text,
      EXACT_FINDINGS_MARKER
    );

  const patchCount =
    countOccurrences(
      text,
      EXACT_PATCH_MARKER
    );

  if (
    findingsCount !== 1 ||
    patchCount !== 1
  ) {
    return {
      success: false,
      reason:
        "Exact frozen section markers were not present exactly once",
      findings: null,
      patch: null
    };
  }

  const findingsIndex =
    text.indexOf(
      EXACT_FINDINGS_MARKER
    );

  const patchIndex =
    text.indexOf(
      EXACT_PATCH_MARKER
    );

  if (patchIndex <= findingsIndex) {
    return {
      success: false,
      reason:
        "Exact frozen section markers were not in the required order",
      findings: null,
      patch: null
    };
  }

  const findings =
    text
      .slice(
        findingsIndex +
          EXACT_FINDINGS_MARKER.length,
        patchIndex
      )
      .trim();

  const patch =
    text
      .slice(
        patchIndex +
          EXACT_PATCH_MARKER.length
      )
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");

  return {
    success: true,
    reason: null,
    findings,
    patch
  };
}

/*
 * E2 permits one point when both sections are clearly present but
 * their marker strings differ.
 *
 * This detection is used only for E2. It is NOT a fallback extraction
 * mechanism and therefore cannot make E5 non-zero.
 */
/*
 * Historical patch extraction observed in the documented pilot and
 * reproduced by the first official run.
 *
 * When exact FINDINGS/PATCH markers are unavailable, the proposed
 * unified diff is taken mechanically from the first required diff
 * header through the end of the model response.
 *
 * This reproduces historical evaluation behaviour. It does NOT award
 * E5 fallback credit because the frozen benchmark does not define this
 * operation as a generic fallback rule.
 */
function extractHistoricalPatchFallback(
  responseText
) {
  if (typeof responseText !== "string") {
    throw new TypeError(
      "responseText must be a string"
    );
  }

  const text =
    normalizeNewlines(responseText);

  const pattern =
    /^--- a\/buggy-v1\.js\n\+\+\+ b\/buggy-v1\.js(?:\n|$)/m;

  const match =
    pattern.exec(text);

  if (!match) {
    return {
      success: false,
      reason:
        "Required unified-diff headers were not found",
      patch: null
    };
  }

  return {
    success: true,
    reason: null,
    patch:
      text
        .slice(match.index)
        .replace(/\n+$/, "")
  };
}

function detectClearlyPresentSections(
  responseText
) {
  const text =
    normalizeNewlines(responseText);

  const findingsPresent =
    /^(?:#{1,6}\s*)?FINDINGS\s*$/mi
      .test(text);

  const patchPresent =
    /^(?:#{1,6}\s*)?PATCH\s*$/mi
      .test(text);

  return {
    findingsPresent,
    patchPresent
  };
}

function inspectOutputUsability({
  responseText,
  exactExtraction,
  gitApplyCheckPassed
}) {
  const text =
    normalizeNewlines(responseText);

  const clearSections =
    detectClearlyPresentSections(text);

  let e2 = 0;

  if (exactExtraction.success) {
    e2 = 2;
  } else if (
    clearSections.findingsPresent &&
    clearSections.patchPresent
  ) {
    e2 = 1;
  }

  const e1 =
    gitApplyCheckPassed === true
      ? 4
      : 0;

  /*
   * E3 can be determined from the returned response even when exact
   * section extraction failed.
   */
  const hasOldHeader =
    text.includes(
      REQUIRED_OLD_HEADER
    );

  const hasNewHeader =
    text.includes(
      REQUIRED_NEW_HEADER
    );

  const e3 =
    hasOldHeader &&
    hasNewHeader
      ? 1
      : 0;

  /*
   * Any Markdown fence contaminating the proposed patch response
   * loses E4.
   */
  const hasMarkdownFence =
    /```/.test(text);

  const e4 =
    hasMarkdownFence
      ? 0
      : 1;

  /*
   * The frozen benchmark does not document a generic fallback
   * extraction rule.
   *
   * Therefore:
   * - exact frozen extraction succeeds: 2
   * - otherwise: 0
   *
   * We deliberately do not invent a post-hoc one-point fallback.
   */
  const e5 =
    exactExtraction.success
      ? 2
      : 0;

  return {
    E1: {
      score: e1,
      maximum: 4,
      gitApplyCheckPassed:
        gitApplyCheckPassed === true
    },

    E2: {
      score: e2,
      maximum: 2,
      exactMarkers:
        exactExtraction.success,
      findingsClearlyPresent:
        clearSections.findingsPresent,
      patchClearlyPresent:
        clearSections.patchPresent
    },

    E3: {
      score: e3,
      maximum: 1,
      oldHeaderPresent:
        hasOldHeader,
      newHeaderPresent:
        hasNewHeader
    },

    E4: {
      score: e4,
      maximum: 1,
      markdownFencePresent:
        hasMarkdownFence
    },

    E5: {
      score: e5,
      maximum: 2,
      exactMechanicalExtraction:
        exactExtraction.success,
      documentedFallbackUsed: false
    },

    score:
      e1 + e2 + e3 + e4 + e5,

    maximum: 10
  };
}

function runProcess(
  command,
  args,
  options = {}
) {
  return spawnSync(
    command,
    args,
    {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer:
        10 * 1024 * 1024,
      ...options
    }
  );
}

function runGitApplyCheck({
  patchPath,
  workspaceDir
}) {
  const result =
    runProcess(
      "git",
      [
        "apply",
        "--check",
        patchPath
      ],
      {
        cwd: workspaceDir
      }
    );

  return {
    passed:
      result.status === 0,
    exitCode:
      result.status,
    stdout:
      result.stdout || "",
    stderr:
      result.stderr || ""
  };
}

function applyPatch({
  patchPath,
  workspaceDir
}) {
  return runProcess(
    "git",
    [
      "apply",
      patchPath
    ],
    {
      cwd: workspaceDir
    }
  );
}

function parseTapResults(output) {
  const normalized =
    normalizeNewlines(output);

  const results = new Map();

  for (
    const line of normalized.split("\n")
  ) {
    const match =
      line.match(
        /^(not )?ok\s+\d+\s+-\s+(.+?)(?:\s+#.*)?$/
      );

    if (!match) {
      continue;
    }

    results.set(
      match[2].trim(),
      {
        passed:
          !match[1]
      }
    );
  }

  return results;
}

function scoreHiddenTests(
  testResults
) {
  let functional = 0;

  const functionalDetail = {};

  for (
    const [
      name,
      points
    ] of Object.entries(
      FUNCTIONAL_TESTS
    )
  ) {
    const result =
      testResults.get(name);

    const passed =
      result?.passed === true;

    const awarded =
      passed
        ? points
        : 0;

    functional += awarded;

    functionalDetail[name] = {
      passed,
      awarded,
      maximum: points
    };
  }

  let regressionPasses = 0;

  const regressionDetail = {};

  for (
    const name of REGRESSION_TESTS
  ) {
    const result =
      testResults.get(name);

    const passed =
      result?.passed === true;

    if (passed) {
      regressionPasses += 1;
    }

    regressionDetail[name] = {
      passed,
      awarded:
        passed ? 1 : 0,
      maximum: 1
    };
  }

  const regressionBonus =
    regressionPasses ===
      REGRESSION_TESTS.length
      ? 1
      : 0;

  return {
    A: {
      score: functional,
      maximum: 48,
      tests: functionalDetail
    },

    B: {
      score:
        regressionPasses +
        regressionBonus,

      maximum: 12,

      passingRegressionTests:
        regressionPasses,

      preservationBonus:
        regressionBonus,

      tests: regressionDetail
    }
  };
}

function evaluateBugfix({
  responseText,
  manifest,
  runDir,
  diagnosisAdjudication = null,
  patchDisciplineAdjudication = null
}) {
  if (
    !manifest ||
    manifest.id !== "bugfix-v1"
  ) {
    throw new Error(
      "bugfix-v1 adapter received the wrong benchmark manifest"
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

  const sourceDir =
    manifest.sourceDir;

  const buggySource =
    path.join(
      sourceDir,
      "buggy-v1.js"
    );

  const hiddenTests =
    path.join(
      sourceDir,
      "hidden-tests-v1.test.js"
    );

  if (
    !fs.existsSync(buggySource) ||
    !fs.existsSync(hiddenTests)
  ) {
    throw new Error(
      "Frozen bugfix-v1 source artefacts are missing"
    );
  }

  const exactExtraction =
    extractExactSections(
      responseText
    );

  const fallbackExtraction =
    exactExtraction.success
      ? {
          success: false,
          reason:
            "Not needed because exact extraction succeeded",
          patch: null
        }
      : extractHistoricalPatchFallback(
          responseText
        );

  const patchForEvaluation =
    exactExtraction.success
      ? exactExtraction.patch
      : fallbackExtraction.success
        ? fallbackExtraction.patch
        : null;

  const evaluation = {
    benchmarkId:
      "bugfix-v1",

    extraction: {
      ...exactExtraction,

      historicalPatchFallback:
        fallbackExtraction
    },

    patch: {
      written: false,
      extractionMethod: null,
      gitApplyCheck: null,
      applied: false
    },

    syntax: {
      checked: false,
      passed: false
    },

    hiddenTests: {
      ran: false,
      rawOutputFile: null,
      parsedTests: 0
    },

    scores: {
      A: {
        score: 0,
        maximum: 48
      },

      B: {
        score: 0,
        maximum: 12
      },

      C: {
        score:
          diagnosisAdjudication?.score ??
          null,
        maximum: 18,
        source:
          diagnosisAdjudication
            ? "external-adjudication"
            : null
      },

      D: {
        score:
          patchDisciplineAdjudication?.score ??
          null,
        maximum: 12,
        source:
          patchDisciplineAdjudication
            ? "external-adjudication"
            : null
      },

      E: null
    },

    total: null
  };

  const workspaceDir =
    path.join(
      runDir,
      "workspace"
    );

  fs.mkdirSync(
    workspaceDir,
    {
      recursive: true
    }
  );

  const workspaceBuggy =
    path.join(
      workspaceDir,
      "buggy-v1.js"
    );

  const workspaceReference =
    path.join(
      workspaceDir,
      "reference-v1.js"
    );

  const workspaceTests =
    path.join(
      workspaceDir,
      "hidden-tests-v1.test.js"
    );

  fs.copyFileSync(
    buggySource,
    workspaceBuggy
  );

  fs.copyFileSync(
    hiddenTests,
    workspaceTests
  );

  let gitApplyCheckPassed = false;

  if (patchForEvaluation !== null) {
    const patchPath =
      path.join(
        runDir,
        "patch-verbatim.diff"
      );

    writeText(
      patchPath,
      patchForEvaluation
    );

    evaluation.patch.written =
      true;

    evaluation.patch.extractionMethod =
      exactExtraction.success
        ? "exact-frozen-markers"
        : "historical-first-diff-header";

    const gitCheck =
      runGitApplyCheck({
        patchPath,
        workspaceDir
      });

    evaluation.patch.gitApplyCheck = {
      passed:
        gitCheck.passed,
      exitCode:
        gitCheck.exitCode
    };

    writeText(
      path.join(
        runDir,
        "git-apply-check.txt"
      ),
      [
        gitCheck.stdout,
        gitCheck.stderr
      ].join("")
    );

    gitApplyCheckPassed =
      gitCheck.passed;

    if (gitCheck.passed) {
      const applied =
        applyPatch({
          patchPath,
          workspaceDir
        });

      writeText(
        path.join(
          runDir,
          "git-apply.txt"
        ),
        [
          applied.stdout || "",
          applied.stderr || ""
        ].join("")
      );

      if (applied.status === 0) {
        evaluation.patch.applied =
          true;

        fs.copyFileSync(
          workspaceBuggy,
          workspaceReference
        );

        const syntax =
          runProcess(
            process.execPath,
            [
              "--check",
              workspaceReference
            ],
            {
              cwd: workspaceDir
            }
          );

        evaluation.syntax.checked =
          true;

        evaluation.syntax.passed =
          syntax.status === 0;

        writeText(
          path.join(
            runDir,
            "syntax-check.txt"
          ),
          [
            syntax.stdout || "",
            syntax.stderr || ""
          ].join("")
        );

        if (syntax.status === 0) {
          const tests =
            runProcess(
              process.execPath,
              [
                "--test",
                "--test-reporter=tap",
                workspaceTests
              ],
              {
                cwd: workspaceDir
              }
            );

          const testOutput =
            [
              tests.stdout || "",
              tests.stderr || ""
            ].join("");

          const testOutputPath =
            path.join(
              runDir,
              "hidden-tests-output.txt"
            );

          writeText(
            testOutputPath,
            testOutput
          );

          const parsed =
            parseTapResults(
              testOutput
            );

          evaluation.hiddenTests = {
            ran: true,
            exitCode:
              tests.status,
            rawOutputFile:
              testOutputPath,
            parsedTests:
              parsed.size
          };

          const hiddenScores =
            scoreHiddenTests(
              parsed
            );

          evaluation.scores.A =
            hiddenScores.A;

          evaluation.scores.B =
            hiddenScores.B;
        }
      }
    }
  }

  evaluation.scores.E =
    inspectOutputUsability({
      responseText,
      exactExtraction,
      gitApplyCheckPassed
    });

  const c =
    evaluation.scores.C.score;

  const d =
    evaluation.scores.D.score;

  if (
    Number.isFinite(c) &&
    Number.isFinite(d)
  ) {
    evaluation.total =
      evaluation.scores.A.score +
      evaluation.scores.B.score +
      c +
      d +
      evaluation.scores.E.score;
  }

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
  FUNCTIONAL_TESTS,
  REGRESSION_TESTS,
  extractExactSections,
  extractHistoricalPatchFallback,
  detectClearlyPresentSections,
  inspectOutputUsability,
  parseTapResults,
  scoreHiddenTests,
  evaluateBugfix
};