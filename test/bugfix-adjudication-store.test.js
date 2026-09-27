"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  resolveBugfixRunDir,
  writeBugfixAdjudication
} = require("../src/bugfix-adjudication-store");

function createValidAdjudication() {
  return {
    diagnosis: {
      "BF-01": {
        identification: 1,
        cause: 1,
        impact: 0.5,
        severityRationale: 0.5,
        reason: "Supported diagnosis for BF-01."
      },
      "BF-02": {
        identification: 1,
        cause: 1,
        impact: 0,
        severityRationale: 0,
        reason: "Supported diagnosis for BF-02."
      },
      "BF-03": {
        identification: 0,
        cause: 0,
        impact: 0,
        severityRationale: 0,
        reason: "Not diagnosed."
      },
      "BF-04": {
        identification: 0,
        cause: 0,
        impact: 0,
        severityRationale: 0,
        reason: "Not diagnosed."
      },
      "BF-05": {
        identification: 0,
        cause: 0,
        impact: 0,
        severityRationale: 0,
        reason: "Not diagnosed."
      },
      "BF-06": {
        identification: 0,
        cause: 0,
        impact: 0,
        severityRationale: 0,
        reason: "Not diagnosed."
      }
    },

    patchDiscipline: {
      D1: {
        score: 2,
        reason: "Noticeable unnecessary or duplicative changes."
      },
      D2: {
        score: 4,
        reason: "Public contract is preserved."
      },
      D3: {
        score: 2,
        reason: "Legitimate but incomplete repair."
      }
    }
  };
}

function createMechanicalEvaluation() {
  return {
    benchmarkId: "bugfix-v1",
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
        score: null,
        maximum: 18,
        source: null
      },
      D: {
        score: null,
        maximum: 12,
        source: null
      },
      E: {
        score: 2,
        maximum: 10
      }
    },
    total: null
  };
}

function createTemporaryRun() {
  const resultsDir =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "llm-benchmark-lab-"
      )
    );

  const runId =
    "2026-09-26T18-45-41-396Z__bugfix-v1__qwen2.5-coder_7b";

  const runDir =
    path.join(
      resultsDir,
      "bugfix-v1",
      runId
    );

  fs.mkdirSync(
    runDir,
    {
      recursive: true
    }
  );

  const evaluation =
    createMechanicalEvaluation();

  fs.writeFileSync(
    path.join(
      runDir,
      "evaluation.json"
    ),
    JSON.stringify(
      evaluation,
      null,
      2
    ),
    "utf8"
  );

  return {
    resultsDir,
    runId,
    runDir,
    evaluation
  };
}

test("resolves a valid bugfix run inside the results directory", () => {
  const resultsDir =
    path.join(
      os.tmpdir(),
      "llm-benchmark-lab-results"
    );

  const runId =
    "2026-09-26T18-45-41-396Z__bugfix-v1__qwen2.5-coder_7b";

  const actual =
    resolveBugfixRunDir(
      resultsDir,
      runId
    );

  assert.equal(
    actual,
    path.resolve(
      resultsDir,
      "bugfix-v1",
      runId
    )
  );
});

test("rejects path traversal in a run id", () => {
  assert.throws(
    () =>
      resolveBugfixRunDir(
        "C:\\safe\\results",
        "..\\outside"
      ),
    /runId/i
  );
});

test("rejects an empty run id", () => {
  assert.throws(
    () =>
      resolveBugfixRunDir(
        "C:\\safe\\results",
        ""
      ),
    /runId/i
  );
});

test("writes adjudication and final evaluation without changing evaluation.json", () => {
  const {
    resultsDir,
    runId,
    runDir,
    evaluation
  } = createTemporaryRun();

  const result =
    writeBugfixAdjudication({
      resultsDir,
      runId,
      adjudication:
        createValidAdjudication()
    });

  const originalAfter =
    JSON.parse(
      fs.readFileSync(
        path.join(
          runDir,
          "evaluation.json"
        ),
        "utf8"
      )
    );

  const storedAdjudication =
    JSON.parse(
      fs.readFileSync(
        path.join(
          runDir,
          "adjudication.json"
        ),
        "utf8"
      )
    );

  const finalEvaluation =
    JSON.parse(
      fs.readFileSync(
        path.join(
          runDir,
          "evaluation-final.json"
        ),
        "utf8"
      )
    );

  assert.deepEqual(
    originalAfter,
    evaluation
  );

  assert.equal(
    storedAdjudication.C.score,
    5
  );

  assert.equal(
    storedAdjudication.D.score,
    8
  );

  assert.equal(
    finalEvaluation.total,
    15
  );

  assert.equal(
    result.total,
    15
  );
});

test("refuses to overwrite an existing adjudication", () => {
  const {
    resultsDir,
    runId
  } = createTemporaryRun();

  writeBugfixAdjudication({
    resultsDir,
    runId,
    adjudication:
      createValidAdjudication()
  });

  assert.throws(
    () =>
      writeBugfixAdjudication({
        resultsDir,
        runId,
        adjudication:
          createValidAdjudication()
      }),
    /already exists/i
  );
});
