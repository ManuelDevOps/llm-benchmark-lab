"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  MANIFESTS_DIR,
  runBenchmarkGeneration,
  evaluateBenchmarkResponse
} = require("../src/benchmark-runner");

const {
  server,
  HOST
} = require("../src/server");

let baseUrl;

test.before(async () => {
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
    server.listen(0, HOST);
  });

  const address = server.address();

  assert.ok(address);
  assert.equal(typeof address, "object");

  baseUrl = `http://${HOST}:${address.port}`;
});

test.after(async () => {
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

test("GET /api/benchmarks returns public benchmark metadata", async () => {
  const response = await fetch(`${baseUrl}/api/benchmarks`);

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.ok(Array.isArray(body.benchmarks));

  const byId = new Map(
    body.benchmarks.map((benchmark) => [benchmark.id, benchmark])
  );

  assert.deepEqual(byId.get("cart-total-v1"), {
    id: "cart-total-v1",
    name: "Cart Total v1",
    category: "code-generation",
    available: true
  });

  assert.deepEqual(byId.get("bugfix-v1"), {
    id: "bugfix-v1",
    name: "Bugfix v1",
    category: "debugging",
    available: true
  });

  const serialized = JSON.stringify(body);

  assert.equal(serialized.includes("sourceDir"), false);
  assert.equal(/[A-Za-z]:\\Users\\/i.test(serialized), false);
  assert.equal(/\/home\/[^/\s]+/i.test(serialized), false);
  assert.equal(/\/Users\/[^/\s]+/i.test(serialized), false);
});

test("discovery marks an otherwise valid benchmark without an evaluator unavailable", async t => {
  const readFileSync = fs.readFileSync;
  const readdirSync = fs.readdirSync;
  const unsupportedPath = path.join(MANIFESTS_DIR, "unsupported-test.json");
  const manifest = JSON.parse(readFileSync(
    path.join(MANIFESTS_DIR, "bugfix-v1.json"), "utf8"
  ));
  manifest.id = "unsupported-test";
  manifest.name = "Unsupported test";

  // Virtual manifest only: do not change the frozen benchmark directory.
  t.mock.method(fs, "readdirSync", (directory, ...args) => {
    const entries = readdirSync(directory, ...args);
    return directory === MANIFESTS_DIR
      ? [...entries, "unsupported-test.json"]
      : entries;
  });
  t.mock.method(fs, "readFileSync", (file, ...args) =>
    file === unsupportedPath
      ? JSON.stringify(manifest)
      : readFileSync(file, ...args)
  );

  const response = await fetch(`${baseUrl}/api/benchmarks`);
  assert.equal(response.status, 200);
  const { benchmarks } = await response.json();
  assert.deepEqual(benchmarks.find(item => item.id === manifest.id), {
    id: "unsupported-test", name: "Unsupported test",
    category: "debugging", available: false
  });
  for (const id of ["cart-total-v1", "bugfix-v1"]) {
    assert.equal(benchmarks.find(item => item.id === id).available, true);
  }
});

test("unsupported execution reads its manifest but rejects before prompt, fetch or run setup", async t => {
  const manifests = new Map(["unsupported-test", "toString"].map(id => [
    path.join(MANIFESTS_DIR, `${id}.json`),
    JSON.stringify({
      id, name: "Unsupported test", sourceDir: "packs/bugfix-v1",
      promptFile: "model-prompt-v1.txt", inference: {}
    })
  ]));
  const existsMock = t.mock.method(fs, "existsSync", file => {
    assert.ok(manifests.has(file), "Only the manifest may be checked");
    return true;
  });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request");
  });
  const readMock = t.mock.method(fs, "readFileSync", file => {
    assert.ok(manifests.has(file), "Only the manifest may be read");
    return manifests.get(file);
  });
  const resolve = path.resolve;
  t.mock.method(path, "resolve", (...args) => {
    assert.equal(args.includes("model-prompt-v1.txt"), false, "Prompt must not be resolved");
    return resolve(...args);
  });
  const mkdirMock = t.mock.method(fs, "mkdirSync", () => {
    throw new Error("Unexpected run directory creation");
  });

  for (const benchmarkId of ["unsupported-test", "toString"]) {
    await assert.rejects(
      runBenchmarkGeneration({ benchmarkId, model: "mock-model" }),
      { message: `No benchmark evaluator configured for: ${benchmarkId}` }
    );
    assert.throws(
      () => evaluateBenchmarkResponse({ benchmarkId }),
      { message: `No benchmark evaluator configured for: ${benchmarkId}` }
    );
  }
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(existsMock.mock.callCount(), 2);
  assert.equal(readMock.mock.callCount(), 2);
  assert.equal(mkdirMock.mock.callCount(), 0);
});

test("nonexistent benchmark preserves the manifest-not-found error before evaluator checking", async t => {
  const benchmarkId = "nonexistent-test";
  t.mock.method(fs, "existsSync", file => {
    assert.equal(file, path.join(MANIFESTS_DIR, `${benchmarkId}.json`));
    return false;
  });
  const readMock = t.mock.method(fs, "readFileSync", () => {
    throw new Error("Unexpected file read");
  });
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected network request");
  });
  const mkdirMock = t.mock.method(fs, "mkdirSync", () => {
    throw new Error("Unexpected run directory creation");
  });
  await assert.rejects(
    runBenchmarkGeneration({ benchmarkId, model: "mock-model" }),
    { message: `Benchmark manifest not found: ${benchmarkId}` }
  );
  assert.equal(readMock.mock.callCount(), 0);
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.equal(mkdirMock.mock.callCount(), 0);
});

test("unknown route returns 404", async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not found");
});

test("POST /api/run-benchmark rejects non-JSON content", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain"
    },
    body: "not-json"
  });

  assert.equal(response.status, 415);

  assert.deepEqual(await response.json(), {
    error: "Content-Type must be application/json"
  });
});

test("POST /api/run-benchmark rejects an empty body", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: ""
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: "Invalid benchmark request",
    detail: "Request body is empty"
  });
});

test("POST /api/run-benchmark rejects invalid JSON", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{"
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: "Invalid benchmark request",
    detail: "Request body is not valid JSON"
  });
});

test("POST /api/run-benchmark rejects non-object JSON", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "[]"
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: "Request body must be a JSON object"
  });
});

test("POST /api/run-benchmark requires benchmarkId", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "example-model"
    })
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: "benchmarkId must be a non-empty string"
  });
});

test("POST /api/run-benchmark requires model", async () => {
  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      benchmarkId: "cart-total-v1"
    })
  });

  assert.equal(response.status, 400);

  assert.deepEqual(await response.json(), {
    error: "model must be a non-empty string"
  });
});

test("POST /api/run-benchmark enforces the request body size limit", async () => {
  const oversized = JSON.stringify({
    benchmarkId: "cart-total-v1",
    model: "x".repeat(20 * 1024)
  });

  const response = await fetch(`${baseUrl}/api/run-benchmark`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: oversized
  });

  assert.equal(response.status, 413);

  assert.deepEqual(await response.json(), {
    error: "Invalid benchmark request",
    detail: "Request body exceeds allowed size"
  });
});
