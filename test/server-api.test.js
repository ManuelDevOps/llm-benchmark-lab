"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

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
