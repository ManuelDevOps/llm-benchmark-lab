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
  `test-cart-history-${process.pid}`;

const runDir =
  path.join(
    RESULTS_DIR,
    "cart-total-v1",
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
      benchmarkId:
        "cart-total-v1",
      model:
        "test-model:1b",
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
      benchmarkId:
        "cart-total-v1",
      model:
        "test-model:1b",
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
      benchmarkId:
        "cart-total-v1",
      hiddenTests: {
        explicitRequirements: {
          passed: 10,
          total: 10
        },
        engineeringRobustness: {
          passed: 6,
          total: 11
        }
      }
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

test("GET /api/runs exposes separate cart-total A and B results", async () => {
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
        entry.runId === runId
    );

  assert.deepEqual(
    run,
    {
      runId,
      benchmarkId:
        "cart-total-v1",
      model:
        "test-model:1b",
      completedAt:
        "2026-09-28T00:01:00.000Z",
      total: null,
      hasFinalEvaluation:
        false,
      explicitRequirements: {
        passed: 10,
        total: 10
      },
      engineeringRobustness: {
        passed: 6,
        total: 11
      }
    }
  );
});