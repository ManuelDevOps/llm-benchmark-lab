"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { validateBugfixAdjudication } = require("../src/bugfix-adjudication");

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

function createPartialRun() {
  const run = createTemporaryRun();
  const adjudicationPath = path.join(run.runDir, "adjudication.json");
  const finalPath = path.join(run.runDir, "evaluation-final.json");
  const original = JSON.stringify(validateBugfixAdjudication(createValidAdjudication()));
  fs.writeFileSync(adjudicationPath, original);
  return { ...run, adjudicationPath, finalPath, original };
}

test("recovers adjudication-only state using persisted criteria without changing evidence", () => {
  const run = createPartialRun();
  const evaluationPath = path.join(run.runDir, "evaluation.json");
  const before = fs.readFileSync(evaluationPath, "utf8");
  const submitted = createValidAdjudication();
  // Key ordering and whitespace normalized by the validator are not changes.
  submitted.diagnosis = Object.fromEntries(Object.entries(submitted.diagnosis).reverse());
  submitted.diagnosis["BF-01"].reason += "  ";
  const result = writeBugfixAdjudication({ ...run, adjudication: submitted });
  assert.equal(result.total, 15);
  assert.deepEqual(JSON.parse(fs.readFileSync(run.finalPath, "utf8")), result);
  assert.equal(fs.readFileSync(run.adjudicationPath, "utf8"), run.original);
  assert.equal(fs.readFileSync(evaluationPath, "utf8"), before);
  assert.throws(() => writeBugfixAdjudication({ ...run, adjudication: submitted }), /already exists/i);
  assert.deepEqual(JSON.parse(fs.readFileSync(run.finalPath, "utf8")), result);
});

for (const change of ["score", "reason"]) {
  test(`recovery rejects different submitted ${change} without changing partial state`, () => {
    const run = createPartialRun();
    const submitted = createValidAdjudication();
    if (change === "score") submitted.patchDiscipline.D1.score = 3;
    else submitted.patchDiscipline.D1.reason = "Different judgement";
    assert.throws(() => writeBugfixAdjudication({ ...run, adjudication: submitted }), /differs.*recovery refused/i);
    assert.equal(fs.readFileSync(run.adjudicationPath, "utf8"), run.original);
    assert.equal(fs.existsSync(run.finalPath), false);
  });
}

test("rejects final evaluation without adjudication as inconsistent", () => {
  const run = createTemporaryRun();
  const finalPath = path.join(run.runDir, "evaluation-final.json");
  fs.writeFileSync(finalPath, "existing final evidence");
  assert.throws(() => writeBugfixAdjudication({
    ...run, adjudication: createValidAdjudication()
  }), /inconsistent.*without adjudication/i);
  assert.equal(fs.readFileSync(finalPath, "utf8"), "existing final evidence");
  assert.equal(fs.existsSync(path.join(run.runDir, "adjudication.json")), false);
});

for (const invalidSource of ["persisted", "submitted"]) {
  test(`recovery validates ${invalidSource} criteria before writing`, () => {
    const run = createPartialRun();
    const submitted = createValidAdjudication();
    if (invalidSource === "persisted") {
      const persisted = JSON.parse(run.original);
      persisted.D.criteria.D1.score = 99;
      fs.writeFileSync(run.adjudicationPath, JSON.stringify(persisted));
    } else submitted.patchDiscipline.D1.score = 99;
    const before = fs.readFileSync(run.adjudicationPath, "utf8");
    assert.throws(() => writeBugfixAdjudication({ ...run, adjudication: submitted }), /outside the frozen rubric/);
    assert.equal(fs.readFileSync(run.adjudicationPath, "utf8"), before);
    assert.equal(fs.existsSync(run.finalPath), false);
  });
}

test("recovery preserves concurrent final creation and authoritative adjudication", t => {
  const run = createPartialRun();
  const write = fs.writeFileSync;
  t.mock.method(fs, "writeFileSync", (file, data, options) => {
    assert.equal(file, run.finalPath);
    assert.equal(options.flag, "wx");
    write(file, "concurrent final");
    return write(file, data, options);
  });
  assert.throws(() => writeBugfixAdjudication({
    ...run, adjudication: createValidAdjudication()
  }), { code: "EEXIST" });
  assert.equal(fs.readFileSync(run.finalPath, "utf8"), "concurrent final");
  assert.equal(fs.readFileSync(run.adjudicationPath, "utf8"), run.original);
});

test("rolls back adjudication if final evaluation write fails", () => {
  const {
    resultsDir,
    runId,
    runDir
  } = createTemporaryRun();

  const adjudicationPath =
    path.join(runDir, "adjudication.json");

  const finalEvaluationPath =
    path.join(runDir, "evaluation-final.json");

  const originalWriteFileSync =
    fs.writeFileSync;

  fs.writeFileSync = function(filePath, ...args) {
    if (
      path.resolve(filePath) ===
      path.resolve(finalEvaluationPath)
    ) {
      throw new Error(
        "simulated final write failure"
      );
    }

    return originalWriteFileSync.call(
      fs,
      filePath,
      ...args
    );
  };

  try {
    assert.throws(
      () =>
        writeBugfixAdjudication({
          resultsDir,
          runId,
          adjudication:
            createValidAdjudication()
        }),
      /simulated final write failure/
    );
  } finally {
    fs.writeFileSync =
      originalWriteFileSync;
  }

  assert.equal(
    fs.existsSync(adjudicationPath),
    false
  );

  assert.equal(
    fs.existsSync(finalEvaluationPath),
    false
  );
});

test("does not delete an adjudication created concurrently by another writer", () => {
  const {
    resultsDir,
    runId,
    runDir
  } = createTemporaryRun();

  const adjudicationPath =
    path.join(
      runDir,
      "adjudication.json"
    );

  const originalWriteFileSync =
    fs.writeFileSync;

  fs.writeFileSync =
    function simulatedConcurrentWrite(
      filePath,
      ...args
    ) {
      if (
        path.resolve(filePath) ===
        path.resolve(adjudicationPath)
      ) {
        originalWriteFileSync.call(
          fs,
          adjudicationPath,
          "external writer\n",
          "utf8"
        );

        const error =
          new Error(
            "simulated concurrent adjudication"
          );

        error.code = "EEXIST";
        throw error;
      }

      return originalWriteFileSync.call(
        fs,
        filePath,
        ...args
      );
    };

  try {
    assert.throws(
      () =>
        writeBugfixAdjudication({
          resultsDir,
          runId,
          adjudication:
            createValidAdjudication()
        }),
      /simulated concurrent adjudication/
    );
  } finally {
    fs.writeFileSync =
      originalWriteFileSync;
  }

  assert.equal(
    fs.readFileSync(
      adjudicationPath,
      "utf8"
    ),
    "external writer\n"
  );
});
