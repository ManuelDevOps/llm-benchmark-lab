"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  validateBugfixAdjudication,
  finalizeBugfixEvaluation
} = require("./bugfix-adjudication");

function resolveBugfixRunDir(
  resultsDir,
  runId
) {
  if (
    typeof resultsDir !== "string" ||
    resultsDir.trim() === ""
  ) {
    throw new TypeError(
      "resultsDir must be a non-empty string"
    );
  }

  if (
    typeof runId !== "string" ||
    runId.trim() === ""
  ) {
    throw new TypeError(
      "runId must be a non-empty string"
    );
  }

  const normalizedRunId =
    runId.trim();

  if (
    normalizedRunId === "." ||
    normalizedRunId === ".." ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
      normalizedRunId
    )
  ) {
    throw new Error(
      "runId contains invalid path characters"
    );
  }

  const benchmarkRoot =
    path.resolve(
      resultsDir,
      "bugfix-v1"
    );

  const runDir =
    path.resolve(
      benchmarkRoot,
      normalizedRunId
    );

  const relative =
    path.relative(
      benchmarkRoot,
      runDir
    );

  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "runId resolves outside the bugfix results directory"
    );
  }

  return runDir;
}

function readJson(filePath) {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf8"
    )
  );
}

function writeJsonExclusive(
  filePath,
  value
) {
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    {
      encoding: "utf8",
      flag: "wx"
    }
  );
}

function writeBugfixAdjudication({
  resultsDir,
  runId,
  adjudication
}) {
  const runDir =
    resolveBugfixRunDir(
      resultsDir,
      runId
    );

  if (
    !fs.existsSync(runDir) ||
    !fs.statSync(runDir).isDirectory()
  ) {
    throw new Error(
      "Bugfix benchmark run does not exist"
    );
  }

  const evaluationPath =
    path.join(
      runDir,
      "evaluation.json"
    );

  if (!fs.existsSync(evaluationPath)) {
    throw new Error(
      "Mechanical evaluation does not exist for this run"
    );
  }

  const adjudicationPath =
    path.join(
      runDir,
      "adjudication.json"
    );

  const finalEvaluationPath =
    path.join(
      runDir,
      "evaluation-final.json"
    );

  if (
    fs.existsSync(adjudicationPath) ||
    fs.existsSync(finalEvaluationPath)
  ) {
    throw new Error(
      "Adjudication already exists for this run"
    );
  }

  const mechanicalEvaluation =
    readJson(
      evaluationPath
    );

  const validatedAdjudication =
    validateBugfixAdjudication(
      adjudication
    );

  const finalEvaluation =
    finalizeBugfixEvaluation(
      mechanicalEvaluation,
      adjudication
    );

  writeJsonExclusive(
    adjudicationPath,
    validatedAdjudication
  );

  writeJsonExclusive(
    finalEvaluationPath,
    finalEvaluation
  );

  return finalEvaluation;
}

module.exports = {
  resolveBugfixRunDir,
  writeBugfixAdjudication
};
