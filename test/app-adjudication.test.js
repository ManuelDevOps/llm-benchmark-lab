"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../public/app.js"), "utf8"
);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(data, status = 200) {
  return {
    ok: status === 200, status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

async function frontend() {
  // Only the DOM operations used by app.js; no browser or network is involved.
  const elements = new Map();
  function element(tag = "div") {
    const classes = new Set();
    const node = {
      tag, children: [], value: "0", textContent: "", disabled: false,
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name)
      },
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      addEventListener() {},
      querySelectorAll(selector) {
        const tags = selector.split(",").map(value => value.trim());
        return this.children.flatMap(child => [
          ...(tags.includes(child.tag) ? [child] : []),
          ...child.querySelectorAll(selector)
        ]);
      }
    };
    Object.defineProperty(node, "id", {
      set(id) { elements.set(id, node); }
    });
    Object.defineProperty(node, "innerHTML", {
      set() { this.children = []; this.value = "0"; }
    });
    return node;
  }
  const document = {
    createElement: element,
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }
  };
  document.getElementById("adjudicationCard").children.push(
    document.getElementById("diagnosisFields"),
    document.getElementById("patchDisciplineFields")
  );
  const runs = ["A", "B"].map(runId => ({
    runId, benchmarkId: "bugfix-v1", model: "mock-model", total: null
  }));
  const requests = [];
  const pending = deferred();
  let refreshPending = null;
  const context = vm.createContext({
    document, console: { error() {} },
    fetch(url, options) {
      requests.push({ url, options });
      if (url === "/api/models") return Promise.resolve(response({
        models: [{ name: "mock-model" }]
      }));
      if (url === "/api/benchmarks") return Promise.resolve(response({
        benchmarks: [{ id: "bugfix-v1", name: "Bugfix", available: true }]
      }));
      if (url === "/api/runs") {
        return refreshPending ? refreshPending.promise : Promise.resolve(response({ runs }));
      }
      if (url === "/api/adjudicate-bugfix" || url === "/api/run-benchmark") {
        return pending.promise;
      }
      throw new Error(`Unexpected mocked request: ${url}`);
    }
  });
  const evaluate = code => vm.runInContext(code, context);
  evaluate(source);
  await new Promise(resolve => setImmediate(resolve));
  evaluate(`latestBenchmarkResult = {
    benchmarkId: "bugfix-v1", runId: "A", model: "mock-model",
    evaluation: { total: null }
  }; showAdjudicationForResult(latestBenchmarkResult);`);
  for (const node of document.getElementById("adjudicationCard").querySelectorAll("textarea")) {
    node.value = "Reviewed evidence";
  }
  requests.length = 0;
  return {
    evaluate, elements, requests, pending,
    holdRefresh() { refreshPending = deferred(); return refreshPending; },
    result() { return JSON.parse(evaluate("JSON.stringify(latestBenchmarkResult)")); },
    switchToB(benchmarkId = "bugfix-v1", runId = "B") {
      evaluate(`latestBenchmarkResult = ${JSON.stringify({ benchmarkId, runId, evaluation: { total: 23 } })};`);
      elements.get("resultOutput").textContent = "B result";
      elements.get("adjudicationStatus").textContent = "B status";
      elements.get("adjudicateButton").textContent = "B button";
      elements.get("adjudicateButton").disabled = false;
    }
  };
}

function assertOtherResultUntouched(app) {
  assert.equal(app.result().evaluation.total, 23);
  assert.equal(app.elements.get("resultOutput").textContent, "B result");
  assert.equal(app.elements.get("adjudicationStatus").textContent, "B status");
  assert.equal(app.elements.get("adjudicateButton").textContent, "B button");
  assert.equal(app.elements.get("adjudicateButton").disabled, false);
}

test("adjudication captures identity, blocks actions through refresh, and restores buttons", async () => {
  const app = await frontend();
  app.elements.get("savedRunSelect").value = "1";
  const refresh = app.holdRefresh();
  const saving = app.evaluate("adjudicateBugfix()");
  assert.equal(JSON.parse(app.requests[0].options.body).runId, "A");
  assert.equal(app.elements.get("runButton").disabled, true);
  assert.equal(app.elements.get("loadRunButton").disabled, true);
  await app.evaluate("runBenchmark()");
  await app.evaluate("loadSelectedRun()");
  await app.evaluate("adjudicateBugfix()");
  assert.equal(app.requests.length, 1);
  app.pending.resolve(response({ runId: "A", evaluation: { total: 80 } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.result().runId, "A");
  assert.equal(app.result().evaluation.total, 80);
  assert.equal(JSON.parse(app.elements.get("resultOutput").textContent).evaluation.total, 80);
  assert.equal(app.evaluate("adjudicationInProgress"), true);
  assert.equal(app.elements.get("runButton").disabled, true);
  assert.equal(app.elements.get("loadRunButton").disabled, true);
  refresh.resolve(response({ runs: [
    { benchmarkId: "bugfix-v1", runId: "B" },
    { benchmarkId: "bugfix-v1", runId: "A", total: 80 }
  ] }));
  await saving;
  assert.equal(app.evaluate("getSelectedSavedRun().runId"), "B");
  assert.equal(app.evaluate("adjudicationInProgress"), false);
  assert.equal(app.elements.get("runButton").disabled, false);
  assert.equal(app.elements.get("loadRunButton").disabled, false);
  assert.equal(app.elements.get("adjudicateButton").disabled, true);
  assert.deepEqual(app.requests.map(item => item.url), ["/api/adjudicate-bugfix", "/api/runs"]);
});

for (const flag of ["runInProgress", "loadRunInProgress"]) {
  test(`adjudication cannot start during ${flag}`, async () => {
    const app = await frontend();
    app.evaluate(`${flag} = true`);
    await app.evaluate("adjudicateBugfix()");
    assert.equal(app.requests.length, 0);
    assert.equal(app.evaluate("adjudicationInProgress"), false);
  });
}

for (const [benchmarkId, runId] of [["bugfix-v1", "B"], ["cart-total-v1", "A"]]) {
  test(`delayed success cannot update ${benchmarkId}/${runId} and still refreshes history`, async () => {
    const app = await frontend();
    const saving = app.evaluate("adjudicateBugfix()");
    app.switchToB(benchmarkId, runId);
    app.pending.resolve(response({ runId: "A", evaluation: { total: 80 } }));
    await saving;
    assertOtherResultUntouched(app);
    assert.equal(app.requests.filter(item => item.url === "/api/runs").length, 1);
    assert.equal(app.evaluate("adjudicationInProgress"), false);
  });
}

test("mismatched response identity is rejected without changing the evaluation", async () => {
  const app = await frontend();
  app.elements.get("resultOutput").textContent = "A original";
  const saving = app.evaluate("adjudicateBugfix()");
  app.pending.resolve(response({ runId: "B", evaluation: { total: 80 } }));
  await saving;
  assert.equal(app.result().evaluation.total, null);
  assert.equal(app.elements.get("resultOutput").textContent, "A original");
  assert.match(app.elements.get("adjudicationStatus").textContent, /runId does not match/);
  assert.equal(app.elements.get("adjudicateButton").disabled, false);
  assert.equal(app.elements.get("runButton").disabled, false);
  assert.equal(app.elements.get("loadRunButton").disabled, false);
  assert.equal(app.evaluate("adjudicationInProgress"), false);
  assert.equal(app.requests.length, 1);
});

test("delayed failure cannot overwrite another run's adjudication UI", async () => {
  const app = await frontend();
  const saving = app.evaluate("adjudicateBugfix()");
  app.switchToB();
  app.pending.reject(new Error("Mock connection failure"));
  await saving;
  assertOtherResultUntouched(app);
  assert.equal(app.evaluate("adjudicationInProgress"), false);
  assert.equal(app.elements.get("runButton").disabled, false);
  assert.equal(app.elements.get("loadRunButton").disabled, false);
  assert.equal(app.requests.length, 1);
});

test("failed save restores retry controls and respects other busy state", async () => {
  const app = await frontend();
  const saving = app.evaluate("adjudicateBugfix()");
  app.evaluate("loadRunInProgress = true");
  app.pending.resolve(response({ error: "Mock save failure" }, 500));
  await saving;
  assert.match(app.elements.get("adjudicationStatus").textContent, /Mock save failure/);
  assert.equal(app.elements.get("adjudicateButton").disabled, false);
  assert.equal(app.evaluate("adjudicationInProgress"), false);
  assert.equal(app.elements.get("runButton").disabled, true);
  assert.equal(app.elements.get("loadRunButton").disabled, true);
});

test("benchmark completion still refreshes saved runs with mocked execution", async () => {
  const app = await frontend();
  const running = app.evaluate("runBenchmark()");
  app.pending.resolve(response({ benchmarkId: "bugfix-v1", runId: "C", model: "mock-model" }));
  await running;
  assert.deepEqual(app.requests.map(item => item.url), ["/api/run-benchmark", "/api/runs"]);
  assert.equal(app.evaluate("runInProgress"), false);
});
