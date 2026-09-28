"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generate, OLLAMA_URL } = require("../src/ollama-client");
const { validateGeneration } = require("../src/benchmark-runner");

const model = "mock-model";
const parsed = { model, response: "Completed answer", done: true, done_reason: "stop" };
const raw = JSON.stringify(parsed, null, 2) + "\n";
const preRunState = { models: [{ name: model }] };

function jsonResponse(data, status = 200) {
  return { ok: status === 200, status, json: async () => data };
}

function mockFetch(t, { post, failBefore, generationRaw = raw, generationStatus = 200 } = {}) {
  const paths = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const route = String(url).slice(OLLAMA_URL.length);
    assert.ok(String(url).startsWith(OLLAMA_URL));
    paths.push(route);
    if (route === failBefore && !paths.includes("/api/generate")) {
      throw new Error("Pre-run metadata unavailable");
    }
    if (route === "/api/version") return jsonResponse({ version: "mock-version" });
    if (route === "/api/show") return jsonResponse({ details: { family: "mock" } });
    if (route === "/api/generate") {
      return {
        ok: generationStatus === 200, status: generationStatus,
        text: async () => generationRaw
      };
    }
    if (route === "/api/ps") {
      if (!paths.includes("/api/generate")) return jsonResponse(preRunState);
      return post ? post() : jsonResponse({ models: [] });
    }
    throw new Error(`Unexpected mocked request: ${url}`);
  });
  return paths;
}

function assertAnswerPreserved(result) {
  assert.equal(result.rawResponse, raw);
  assert.deepEqual(result.response, parsed);
  assert.deepEqual(result.preRunState, preRunState);
  assert.deepEqual(result.ollamaVersion, { version: "mock-version" });
  assert.deepEqual(result.modelDetails, { details: { family: "mock" } });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.httpOk, true);
  assert.equal(validateGeneration(model, result).valid, true);
}

test("successful post-run metadata remains available with no error", async t => {
  const paths = mockFetch(t);
  const result = await generate(model, "Mock prompt", {});
  assertAnswerPreserved(result);
  assert.deepEqual(result.postRunState, { models: [] });
  assert.equal(result.postRunStateError, null);
  assert.deepEqual(paths, ["/api/version", "/api/show", "/api/ps", "/api/generate", "/api/ps"]);
});

for (const [label, post, expected] of [
  ["network failure", () => { throw new TypeError("Mock connection failure"); },
    { name: "TypeError", message: "Mock connection failure" }],
  ["HTTP failure", () => jsonResponse({}, 503),
    { name: "Error", message: "Ollama /api/ps failed with HTTP 503" }],
  ["JSON failure", () => ({ ok: true, status: 200, json: async () => {
    throw new SyntaxError("Mock invalid metadata JSON");
  } }), { name: "SyntaxError", message: "Mock invalid metadata JSON" }]
]) {
  test(`post-run ${label} preserves the answer and records the metadata error`, async t => {
    mockFetch(t, { post });
    const result = await generate(model, "Mock prompt", {});
    assertAnswerPreserved(result);
    assert.equal(result.postRunState, null);
    assert.deepEqual(result.postRunStateError, expected);
  });
}

for (const failBefore of ["/api/version", "/api/show", "/api/ps"]) {
  test(`${failBefore} failure before generation still rejects`, async t => {
    const paths = mockFetch(t, { failBefore });
    await assert.rejects(generate(model, "Mock prompt", {}), /Pre-run metadata unavailable/);
    assert.equal(paths.includes("/api/generate"), false);
  });
}

test("invalid generation JSON still rejects with raw evidence and skips post-run metadata", async t => {
  const paths = mockFetch(t, { generationRaw: "not JSON" });
  await assert.rejects(generate(model, "Mock prompt", {}), error => {
    assert.equal(error.rawResponse, "not JSON");
    assert.equal(error.httpStatus, 200);
    return /not valid JSON/.test(error.message);
  });
  assert.equal(paths.filter(route => route === "/api/ps").length, 1);
});

test("post-run failure does not turn an HTTP generation error into a valid result", async t => {
  mockFetch(t, {
    generationStatus: 500,
    post: () => { throw new Error("Metadata unavailable"); }
  });
  const result = await generate(model, "Mock prompt", {});
  assert.equal(result.rawResponse, raw);
  assert.deepEqual(result.response, parsed);
  assert.equal(result.httpStatus, 500);
  assert.equal(validateGeneration(model, result).valid, false);
  assert.equal(result.postRunState, null);
  assert.equal(result.postRunStateError.message, "Metadata unavailable");
});
