"use strict";

const DIAGNOSIS_IDS = [
  "BF-01",
  "BF-02",
  "BF-03",
  "BF-04",
  "BF-05",
  "BF-06"
];

const PATCH_DISCIPLINE_IDS = [
  "D1",
  "D2",
  "D3"
];

function requireObject(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      `${label} must be an object`
    );
  }
}

function requireReason(value, label) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new TypeError(
      `${label} reason must be a non-empty string`
    );
  }

  return value.trim();
}

function requireAllowedScore(
  value,
  allowed,
  label
) {
  if (
    !Number.isFinite(value) ||
    !allowed.includes(value)
  ) {
    throw new RangeError(
      `${label} score is outside the frozen rubric`
    );
  }

  return value;
}

function validateDiagnosisEntry(
  defectId,
  entry
) {
  requireObject(
    entry,
    `${defectId} diagnosis`
  );

  const identification =
    requireAllowedScore(
      entry.identification,
      [0, 1],
      `${defectId} identification`
    );

  const cause =
    requireAllowedScore(
      entry.cause,
      [0, 1],
      `${defectId} cause`
    );

  const impact =
    requireAllowedScore(
      entry.impact,
      [0, 0.5],
      `${defectId} impact`
    );

  const severityRationale =
    requireAllowedScore(
      entry.severityRationale,
      [0, 0.5],
      `${defectId} severityRationale`
    );

  const reason =
    requireReason(
      entry.reason,
      defectId
    );

  const score =
    identification +
    cause +
    impact +
    severityRationale;

  return {
    identification,
    cause,
    impact,
    severityRationale,
    reason,
    score,
    maximum: 3
  };
}

function validatePatchDisciplineEntry(
  criterionId,
  entry
) {
  requireObject(
    entry,
    `${criterionId} patch discipline`
  );

  const score =
    requireAllowedScore(
      entry.score,
      [0, 1, 2, 3, 4],
      criterionId
    );

  const reason =
    requireReason(
      entry.reason,
      criterionId
    );

  return {
    score,
    maximum: 4,
    reason
  };
}

function rejectUnexpectedKeys(
  object,
  allowedKeys,
  label
) {
  for (const key of Object.keys(object)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(
        `${label} contains unexpected criterion: ${key}`
      );
    }
  }
}

function validateBugfixAdjudication(
  adjudication
) {
  requireObject(
    adjudication,
    "Bugfix adjudication"
  );

  requireObject(
    adjudication.diagnosis,
    "diagnosis"
  );

  requireObject(
    adjudication.patchDiscipline,
    "patchDiscipline"
  );

  rejectUnexpectedKeys(
    adjudication.diagnosis,
    DIAGNOSIS_IDS,
    "diagnosis"
  );

  rejectUnexpectedKeys(
    adjudication.patchDiscipline,
    PATCH_DISCIPLINE_IDS,
    "patchDiscipline"
  );

  const defects = {};
  let diagnosisScore = 0;

  for (const defectId of DIAGNOSIS_IDS) {
    if (
      !Object.prototype.hasOwnProperty.call(
        adjudication.diagnosis,
        defectId
      )
    ) {
      throw new Error(
        `Missing diagnosis criterion ${defectId}`
      );
    }

    const validated =
      validateDiagnosisEntry(
        defectId,
        adjudication.diagnosis[defectId]
      );

    defects[defectId] =
      validated;

    diagnosisScore +=
      validated.score;
  }

  const criteria = {};
  let patchDisciplineScore = 0;

  for (
    const criterionId
    of PATCH_DISCIPLINE_IDS
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        adjudication.patchDiscipline,
        criterionId
      )
    ) {
      throw new Error(
        `Missing patch-discipline criterion ${criterionId}`
      );
    }

    const validated =
      validatePatchDisciplineEntry(
        criterionId,
        adjudication.patchDiscipline[
          criterionId
        ]
      );

    criteria[criterionId] =
      validated;

    patchDisciplineScore +=
      validated.score;
  }

  return {
    C: {
      score: diagnosisScore,
      maximum: 18,
      defects
    },

    D: {
      score: patchDisciplineScore,
      maximum: 12,
      criteria
    }
  };
}

function requireMechanicalScore(
  section,
  maximum
) {
  requireObject(
    section,
    "Mechanical score section"
  );

  if (
    !Number.isFinite(section.score) ||
    section.score < 0 ||
    section.score > maximum
  ) {
    throw new RangeError(
      `Mechanical score must be between 0 and ${maximum}`
    );
  }

  return section.score;
}

function finalizeBugfixEvaluation(
  mechanicalEvaluation,
  adjudication
) {
  requireObject(
    mechanicalEvaluation,
    "Mechanical evaluation"
  );

  if (
    mechanicalEvaluation.benchmarkId !==
    "bugfix-v1"
  ) {
    throw new Error(
      "Final evaluation must belong to bugfix-v1"
    );
  }

  requireObject(
    mechanicalEvaluation.scores,
    "Mechanical evaluation scores"
  );

  const a =
    requireMechanicalScore(
      mechanicalEvaluation.scores.A,
      48
    );

  const b =
    requireMechanicalScore(
      mechanicalEvaluation.scores.B,
      12
    );

  const e =
    requireMechanicalScore(
      mechanicalEvaluation.scores.E,
      10
    );

  const validated =
    validateBugfixAdjudication(
      adjudication
    );

  const finalEvaluation =
    structuredClone(
      mechanicalEvaluation
    );

  finalEvaluation.scores.C = {
    ...validated.C,
    source: "external-adjudication"
  };

  finalEvaluation.scores.D = {
    ...validated.D,
    source: "external-adjudication"
  };

  finalEvaluation.total =
    a +
    b +
    validated.C.score +
    validated.D.score +
    e;

  return finalEvaluation;
}
module.exports = {
  DIAGNOSIS_IDS,
  PATCH_DISCIPLINE_IDS,
  validateBugfixAdjudication,
  finalizeBugfixEvaluation
};
