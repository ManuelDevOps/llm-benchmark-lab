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
  `test-run-history-${process.pid}`;

const runDir =
  path.join(
    RESULTS_DIR,
    "bugfix-v1",
    runId
  );

test.before(async () => {
  fs.rmSync(
    runDir,
    {
      recursive: true,
      force: true
    }
  );

  fs.mkdirSync(
    runDir,
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    path.join(
      runDir,
      "run-start.json"
    ),
    JSON.stringify({
      runId,
      benchmarkId: "bugfix-v1",
      model: "test-model:1b",
      startedAt:
        "2026-09-28T00:00:00.000Z"
    }),
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      runDir,
      "runtime.json"
    ),
    JSON.stringify({
      runId,
      benchmarkId: "bugfix-v1",
      model: "test-model:1b",
      completedAt:
        "2026-09-28T00:01:00.000Z",
      validation: {
        valid: true
      },
      performance: {
        totalSeconds: 60
      }
    }),
    "utf8"
  );

  fs.writeFileSync(
    path.join(
      runDir,
      "evaluation.json"
    ),
    JSON.stringify({
      benchmarkId: "bugfix-v1",
      scores: {},
      total: 42
    }),
    "utf8"
  );

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off(
        "listening",
        onListening
      );

      reject(error);
    };

    const onListening = () => {
      server.off(
        "error",
        onError
      );

      resolve();
    };

    server.once(
      "error",
      onError
    );

    server.once(
      "listening",
      onListening
    );

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

test("GET /api/runs lists persisted official benchmark runs", async () => {
  const response =
    await fetch(
      `${baseUrl}/api/runs`
    );

  assert.equal(
    response.status,
    200
  );

  const body =
    await response.json();

  assert.ok(
    Array.isArray(body.runs)
  );

  const run =
    body.runs.find(
      (entry) =>
        entry.runId === runId
    );

  assert.deepEqual(
    run,
    {
      runId,
      benchmarkId:
        "bugfix-v1",
      model:
        "test-model:1b",
      completedAt:
        "2026-09-28T00:01:00.000Z",
      total: 42,
      hasFinalEvaluation:
        false
    }
  );
});

test("POST /api/load-run reconstructs a persisted public benchmark result", async () => {
  const response =
    await fetch(
      `${baseUrl}/api/load-run`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          benchmarkId:
            "bugfix-v1",
          runId
        })
      }
    );

  assert.equal(
    response.status,
    200
  );

  const body =
    await response.json();

  assert.deepEqual(
    body,
    {
      runId,
      benchmarkId:
        "bugfix-v1",
      model:
        "test-model:1b",
      validation: {
        valid: true
      },
      performance: {
        totalSeconds: 60
      },
      evaluation: {
        benchmarkId:
          "bugfix-v1",
        scores: {},
        total: 42
      },
      evaluationError:
        null
    }
  );
});

test("GET /api/runs ignores runs with mismatched runtime metadata", async () => {
  const mismatchedRunId =
    `test-run-history-mismatch-${process.pid}`;

  const mismatchedRunDir =
    path.join(
      RESULTS_DIR,
      "bugfix-v1",
      mismatchedRunId
    );

  try {
    fs.mkdirSync(
      mismatchedRunDir,
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      path.join(
        mismatchedRunDir,
        "run-start.json"
      ),
      JSON.stringify({
        runId:
          mismatchedRunId,
        benchmarkId:
          "bugfix-v1",
        model:
          "test-model:1b"
      }),
      "utf8"
    );

    fs.writeFileSync(
      path.join(
        mismatchedRunDir,
        "runtime.json"
      ),
      JSON.stringify({
        runId:
          "different-run-id",
        benchmarkId:
          "bugfix-v1",
        model:
          "test-model:1b",
        completedAt:
          "2026-09-28T00:01:00.000Z"
      }),
      "utf8"
    );

    fs.writeFileSync(
      path.join(
        mismatchedRunDir,
        "evaluation.json"
      ),
      JSON.stringify({
        benchmarkId:
          "bugfix-v1",
        total: 99
      }),
      "utf8"
    );

    const response =
      await fetch(
        `${baseUrl}/api/runs`
      );

    assert.equal(
      response.status,
      200
    );

    const body =
      await response.json();

    const run =
      body.runs.find(
        (entry) =>
          entry.runId ===
          mismatchedRunId
      );

    assert.equal(
      run,
      undefined
    );
  } finally {
    fs.rmSync(
      mismatchedRunDir,
      {
        recursive: true,
        force: true
      }
    );
  }
});
test("POST /api/load-run rejects path traversal", async () => {
  const response =
    await fetch(
      `${baseUrl}/api/load-run`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          benchmarkId:
            "bugfix-v1",
          runId:
            "../outside"
        })
      }
    );

  assert.equal(
    response.status,
    400
  );

  const body =
    await response.json();

  assert.equal(
    body.error,
    "Unable to load benchmark run"
  );
});