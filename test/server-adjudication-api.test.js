"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  server,
  HOST
} = require("../src/server");

const {
  RESULTS_DIR
} = require("../src/benchmark-runner");

let baseUrl;

const runId =
  `test-bugfix-adjudication-${process.pid}`;

const runDir =
  path.join(
    RESULTS_DIR,
    "bugfix-v1",
    runId
  );

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

function writeMechanicalEvaluation() {
  fs.mkdirSync(
    runDir,
    {
      recursive: true
    }
  );

  const evaluation = {
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

  return evaluation;
}

test.before(async () => {
  fs.rmSync(
    runDir,
    {
      recursive: true,
      force: true
    }
  );

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = () => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);

    server.listen(
      0,
      HOST
    );
  });

  const address =
    server.address();

  assert.ok(address);
  assert.equal(
    typeof address,
    "object"
  );

  baseUrl =
    `http://${HOST}:${address.port}`;
});

test.after(async () => {
  fs.rmSync(
    runDir,
    {
      recursive: true,
      force: true
    }
  );

  if (!server.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

test("POST /api/adjudicate-bugfix completes a bugfix evaluation", async () => {
  const original =
    writeMechanicalEvaluation();

  const response =
    await fetch(
      `${baseUrl}/api/adjudicate-bugfix`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          runId,
          adjudication:
            createValidAdjudication()
        })
      }
    );

  assert.equal(
    response.status,
    200
  );

  const body =
    await response.json();

  assert.equal(
    body.runId,
    runId
  );

  assert.equal(
    body.evaluation.scores.C.score,
    5
  );

  assert.equal(
    body.evaluation.scores.D.score,
    8
  );

  assert.equal(
    body.evaluation.total,
    15
  );

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

  assert.deepEqual(
    originalAfter,
    original
  );

  assert.equal(
    fs.existsSync(
      path.join(
        runDir,
        "adjudication.json"
      )
    ),
    true
  );

  assert.equal(
    fs.existsSync(
      path.join(
        runDir,
        "evaluation-final.json"
      )
    ),
    true
  );
});

test("POST /api/adjudicate-bugfix rejects path traversal", async () => {
  const response =
    await fetch(
      `${baseUrl}/api/adjudicate-bugfix`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          runId: "../outside",
          adjudication:
            createValidAdjudication()
        })
      }
    );

  assert.equal(
    response.status,
    400
  );
});
