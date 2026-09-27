"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateBugfixAdjudication,
  finalizeBugfixEvaluation
} = require("../src/bugfix-adjudication");

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

test("scores the historical adjudication as C=5 and D=8", () => {
  const result =
    validateBugfixAdjudication(
      createValidAdjudication()
    );

  assert.equal(result.C.score, 5);
  assert.equal(result.C.maximum, 18);

  assert.equal(result.D.score, 8);
  assert.equal(result.D.maximum, 12);
});

test("rejects diagnosis values outside the frozen rubric", () => {
  const adjudication =
    createValidAdjudication();

  adjudication.diagnosis["BF-01"].impact = 1;

  assert.throws(
    () =>
      validateBugfixAdjudication(
        adjudication
      ),
    /BF-01.*impact/i
  );
});

test("rejects patch-discipline scores outside 0 to 4", () => {
  const adjudication =
    createValidAdjudication();

  adjudication.patchDiscipline.D1.score = 5;

  assert.throws(
    () =>
      validateBugfixAdjudication(
        adjudication
      ),
    /D1.*score/i
  );
});

test("requires all frozen diagnosis and patch-discipline criteria", () => {
  const adjudication =
    createValidAdjudication();

  delete adjudication.diagnosis["BF-06"];

  assert.throws(
    () =>
      validateBugfixAdjudication(
        adjudication
      ),
    /BF-06/i
  );
});
test("builds a final evaluation without mutating the mechanical evaluation", () => {
  const mechanicalEvaluation = {
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

  const original =
    structuredClone(
      mechanicalEvaluation
    );

  const result =
    finalizeBugfixEvaluation(
      mechanicalEvaluation,
      createValidAdjudication()
    );

  assert.equal(result.scores.C.score, 5);
  assert.equal(result.scores.C.maximum, 18);
  assert.equal(
    result.scores.C.source,
    "external-adjudication"
  );

  assert.equal(result.scores.D.score, 8);
  assert.equal(result.scores.D.maximum, 12);
  assert.equal(
    result.scores.D.source,
    "external-adjudication"
  );

  assert.equal(result.total, 15);

  assert.deepEqual(
    mechanicalEvaluation,
    original
  );
});

test("rejects finalization for a non-bugfix evaluation", () => {
  const mechanicalEvaluation = {
    benchmarkId: "cart-total-v1",
    scores: {}
  };

  assert.throws(
    () =>
      finalizeBugfixEvaluation(
        mechanicalEvaluation,
        createValidAdjudication()
      ),
    /bugfix-v1/i
  );
});