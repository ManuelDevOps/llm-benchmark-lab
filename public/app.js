"use strict";

const modelSelect = document.getElementById("modelSelect");
const modelDetails = document.getElementById("modelDetails");
const ollamaStatus = document.getElementById("ollamaStatus");

const modelParameters = document.getElementById("modelParameters");
const modelQuantization = document.getElementById("modelQuantization");
const modelSize = document.getElementById("modelSize");
const modelContext = document.getElementById("modelContext");
const modelCapabilities = document.getElementById("modelCapabilities");

const benchmarkSelect = document.getElementById("benchmarkSelect");
const runButton = document.getElementById("runButton");

const savedRunSelect = document.getElementById("savedRunSelect");
const savedRunStatus = document.getElementById("savedRunStatus");
const loadRunButton = document.getElementById("loadRunButton");

const resultStatus = document.getElementById("resultStatus");
const resultOutput = document.getElementById("resultOutput");

const adjudicationCard = document.getElementById("adjudicationCard");
const diagnosisFields = document.getElementById("diagnosisFields");
const patchDisciplineFields = document.getElementById(
  "patchDisciplineFields"
);
const adjudicationStatus = document.getElementById(
  "adjudicationStatus"
);
const adjudicateButton = document.getElementById(
  "adjudicateButton"
);

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

let models = [];
let benchmarks = [];
let savedRuns = [];
let runInProgress = false;
let loadRunInProgress = false;
let adjudicationInProgress = false;
let latestBenchmarkResult = null;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  const gib = bytes / (1024 ** 3);
  return `${gib.toFixed(1)} GiB`;
}

function getSelectedModel() {
  return models[Number(modelSelect.value)] ?? null;
}

function getSelectedBenchmark() {
  return benchmarks[Number(benchmarkSelect.value)] ?? null;
}

function getSelectedSavedRun() {
  return savedRuns[Number(savedRunSelect.value)] ?? null;
}

function updateLoadRunButtonState() {
  loadRunButton.disabled =
    loadRunInProgress ||
    adjudicationInProgress ||
    runInProgress ||
    !getSelectedSavedRun();
}

function updateRunButtonState() {
  const model = getSelectedModel();
  const benchmark = getSelectedBenchmark();

  runButton.disabled =
    runInProgress ||
    adjudicationInProgress ||
    loadRunInProgress ||
    !model ||
    !benchmark ||
    benchmark.available !== true;
}

function showModel(index) {
  const model = models[index];

  if (!model) {
    modelDetails.classList.add("hidden");
    return;
  }

  const details = model.details || {};

  modelParameters.textContent =
    details.parameter_size || "-";

  modelQuantization.textContent =
    details.quantization_level || "-";

  modelSize.textContent =
    formatBytes(model.size);

  modelContext.textContent =
    details.context_length?.toLocaleString() || "-";

  modelCapabilities.textContent =
    Array.isArray(model.capabilities) &&
    model.capabilities.length
      ? model.capabilities.join(", ")
      : "-";

  modelDetails.classList.remove("hidden");
}

function createSelect(
  id,
  labelText,
  values
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "adjudication-field";

  const label =
    document.createElement("label");

  label.htmlFor = id;
  label.textContent = labelText;

  const select =
    document.createElement("select");

  select.id = id;

  for (const value of values) {
    const option =
      document.createElement("option");

    option.value =
      String(value);

    option.textContent =
      String(value);

    select.appendChild(option);
  }

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  return wrapper;
}

function createReasonField(
  id,
  labelText
) {
  const wrapper =
    document.createElement("div");

  wrapper.className =
    "adjudication-reason";

  const label =
    document.createElement("label");

  label.htmlFor = id;
  label.textContent = labelText;

  const textarea =
    document.createElement("textarea");

  textarea.id = id;
  textarea.rows = 3;

  wrapper.appendChild(label);
  wrapper.appendChild(textarea);

  return wrapper;
}

function buildAdjudicationForm() {
  diagnosisFields.replaceChildren();
  patchDisciplineFields.replaceChildren();

  const diagnosisHeading =
    document.createElement("h3");

  diagnosisHeading.textContent =
    "C - Diagnosis quality";

  diagnosisFields.appendChild(
    diagnosisHeading
  );

  for (const defectId of DIAGNOSIS_IDS) {
    const section =
      document.createElement("div");

    section.className =
      "adjudication-section";

    const heading =
      document.createElement("h4");

    heading.textContent = defectId;

    section.appendChild(heading);

    const fields =
      document.createElement("div");

    fields.className =
      "adjudication-grid";

    fields.appendChild(
      createSelect(
        `${defectId}-identification`,
        "Identification / location",
        [0, 1]
      )
    );

    fields.appendChild(
      createSelect(
        `${defectId}-cause`,
        "Cause",
        [0, 1]
      )
    );

    fields.appendChild(
      createSelect(
        `${defectId}-impact`,
        "Impact",
        [0, 0.5]
      )
    );

    fields.appendChild(
      createSelect(
        `${defectId}-severity`,
        "Severity / rationale",
        [0, 0.5]
      )
    );

    section.appendChild(fields);

    section.appendChild(
      createReasonField(
        `${defectId}-reason`,
        "Reason"
      )
    );

    diagnosisFields.appendChild(
      section
    );
  }

  const disciplineHeading =
    document.createElement("h3");

  disciplineHeading.textContent =
    "D - Patch discipline";

  patchDisciplineFields.appendChild(
    disciplineHeading
  );

  for (
    const criterionId
    of PATCH_DISCIPLINE_IDS
  ) {
    const section =
      document.createElement("div");

    section.className =
      "adjudication-section";

    const heading =
      document.createElement("h4");

    heading.textContent =
      criterionId;

    section.appendChild(heading);

    section.appendChild(
      createSelect(
        `${criterionId}-score`,
        "Score",
        [0, 1, 2, 3, 4]
      )
    );

    section.appendChild(
      createReasonField(
        `${criterionId}-reason`,
        "Reason"
      )
    );

    patchDisciplineFields.appendChild(
      section
    );
  }
}

function resetAdjudicationForm() {
  for (const select of adjudicationCard.querySelectorAll("select")) {
    select.value = "0";
  }

  for (const textarea of adjudicationCard.querySelectorAll("textarea")) {
    textarea.value = "";
  }

  adjudicationStatus.textContent = "";
  adjudicationStatus.classList.add("hidden");

  adjudicateButton.disabled = false;
  adjudicateButton.textContent =
    "Save adjudication";
}

function collectAdjudication() {
  const diagnosis = {};

  for (const defectId of DIAGNOSIS_IDS) {
    const reason =
      document
        .getElementById(
          `${defectId}-reason`
        )
        .value
        .trim();

    if (!reason) {
      throw new Error(
        `${defectId} requires a reason`
      );
    }

    diagnosis[defectId] = {
      identification:
        Number(
          document.getElementById(
            `${defectId}-identification`
          ).value
        ),

      cause:
        Number(
          document.getElementById(
            `${defectId}-cause`
          ).value
        ),

      impact:
        Number(
          document.getElementById(
            `${defectId}-impact`
          ).value
        ),

      severityRationale:
        Number(
          document.getElementById(
            `${defectId}-severity`
          ).value
        ),

      reason
    };
  }

  const patchDiscipline = {};

  for (
    const criterionId
    of PATCH_DISCIPLINE_IDS
  ) {
    const reason =
      document
        .getElementById(
          `${criterionId}-reason`
        )
        .value
        .trim();

    if (!reason) {
      throw new Error(
        `${criterionId} requires a reason`
      );
    }

    patchDiscipline[criterionId] = {
      score:
        Number(
          document.getElementById(
            `${criterionId}-score`
          ).value
        ),

      reason
    };
  }

  return {
    diagnosis,
    patchDiscipline
  };
}

function populateAdjudicationFormFromEvaluation(
  evaluation
) {
  const defects =
    evaluation?.scores?.C?.defects;

  const criteria =
    evaluation?.scores?.D?.criteria;

  if (
    defects &&
    typeof defects === "object"
  ) {
    for (const defectId of DIAGNOSIS_IDS) {
      const defect =
        defects[defectId];

      if (!defect) {
        continue;
      }

      const values = {
        identification:
          defect.identification,
        cause:
          defect.cause,
        impact:
          defect.impact,
        severity:
          defect.severityRationale
      };

      for (const [field, value] of Object.entries(values)) {
        const select =
          document.getElementById(
            `${defectId}-${field}`
          );

        if (
          select &&
          Number.isFinite(value)
        ) {
          select.value =
            String(value);
        }
      }

      const reason =
        document.getElementById(
          `${defectId}-reason`
        );

      if (
        reason &&
        typeof defect.reason ===
          "string"
      ) {
        reason.value =
          defect.reason;
      }
    }
  }

  if (
    criteria &&
    typeof criteria === "object"
  ) {
    for (const criterionId of PATCH_DISCIPLINE_IDS) {
      const criterion =
        criteria[criterionId];

      if (!criterion) {
        continue;
      }

      const score =
        document.getElementById(
          `${criterionId}-score`
        );

      if (
        score &&
        Number.isFinite(
          criterion.score
        )
      ) {
        score.value =
          String(
            criterion.score
          );
      }

      const reason =
        document.getElementById(
          `${criterionId}-reason`
        );

      if (
        reason &&
        typeof criterion.reason ===
          "string"
      ) {
        reason.value =
          criterion.reason;
      }
    }
  }
}

function showAdjudicationForResult(
  result
) {
  const eligible =
    result?.benchmarkId ===
      "bugfix-v1" &&
    typeof result?.runId ===
      "string" &&
    result.runId.length > 0 &&
    result?.evaluation;

  if (!eligible) {
    adjudicationCard.classList.add(
      "hidden"
    );
    return;
  }

  resetAdjudicationForm();

  const finalized =
    result.evaluation?.scores?.C?.source ===
      "external-adjudication" &&
    result.evaluation?.scores?.D?.source ===
      "external-adjudication";

  for (
    const control of
    adjudicationCard.querySelectorAll(
      "select, textarea"
    )
  ) {
    control.disabled =
      finalized;
  }

  if (finalized) {
    populateAdjudicationFormFromEvaluation(
      result.evaluation
    );

    adjudicationStatus.textContent =
      `Adjudication already saved. Final score: ${result.evaluation.total}/100`;

    adjudicationStatus.classList.remove(
      "hidden"
    );

    adjudicateButton.textContent =
      "Adjudication saved";

    adjudicateButton.disabled =
      true;
  }

  adjudicationCard.classList.remove(
    "hidden"
  );
}

async function loadModels() {
  try {
    const response =
      await fetch("/api/models");

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    models =
      Array.isArray(data.models)
        ? data.models
        : [];

    if (models.length === 0) {
      throw new Error(
        "No Ollama models found"
      );
    }

    modelSelect.innerHTML = "";

    models.forEach(
      (model, index) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(index);

        option.textContent =
          model.name;

        modelSelect.appendChild(
          option
        );
      }
    );

    modelSelect.disabled = false;

    ollamaStatus.textContent =
      `Ollama online · ${models.length} models`;

    ollamaStatus.className =
      "status status-online";

    showModel(0);
    updateRunButtonState();
  } catch (error) {
    models = [];

    modelSelect.innerHTML =
      "<option>Unable to load models</option>";

    modelSelect.disabled = true;

    ollamaStatus.textContent =
      "Ollama unavailable";

    ollamaStatus.className =
      "status status-error";

    updateRunButtonState();

    console.error(error);
  }
}

async function loadBenchmarks() {
  try {
    const response =
      await fetch(
        "/api/benchmarks"
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    benchmarks =
      Array.isArray(data.benchmarks)
        ? data.benchmarks
        : [];

    benchmarkSelect.innerHTML = "";

    if (benchmarks.length === 0) {
      benchmarkSelect.innerHTML =
        "<option>No benchmarks found</option>";

      benchmarkSelect.disabled =
        true;

      updateRunButtonState();
      return;
    }

    benchmarks.forEach(
      (benchmark, index) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(index);

        option.textContent =
          `${benchmark.name} · ${benchmark.category}`;

        if (!benchmark.available) {
          option.disabled = true;

          option.textContent +=
            " · unavailable";
        }

        benchmarkSelect.appendChild(
          option
        );
      }
    );

    const firstAvailableIndex =
      benchmarks.findIndex(
        (benchmark) =>
          benchmark.available
      );

    if (
      firstAvailableIndex === -1
    ) {
      benchmarkSelect.disabled =
        true;

      updateRunButtonState();
      return;
    }

    benchmarkSelect.value =
      String(
        firstAvailableIndex
      );

    benchmarkSelect.disabled =
      false;

    updateRunButtonState();
  } catch (error) {
    benchmarks = [];

    benchmarkSelect.innerHTML =
      "<option>Unable to load benchmarks</option>";

    benchmarkSelect.disabled =
      true;

    updateRunButtonState();

    console.error(error);
  }
}

async function loadRuns() {
  try {
    const response =
      await fetch(
        "/api/runs"
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    const selectedRun =
      getSelectedSavedRun();

    savedRuns =
      Array.isArray(data.runs)
        ? data.runs
        : [];

    savedRunSelect.innerHTML =
      "";

    if (savedRuns.length === 0) {
      savedRunSelect.innerHTML =
        "<option>No saved runs found</option>";

      savedRunSelect.disabled =
        true;

      savedRunStatus.textContent =
        "No saved benchmark runs are available.";

      updateLoadRunButtonState();
      return;
    }

    savedRuns.forEach(
      (run, index) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(index);

        let score =
          Number.isFinite(run.total)
            ? `${run.total}/100`
            : "unscored";

        if (
          run.benchmarkId ===
            "cart-total-v1" &&
          run.explicitRequirements &&
          run.engineeringRobustness
        ) {
          score =
            `A ${run.explicitRequirements.passed}/${run.explicitRequirements.total}` +
            ` · B ${run.engineeringRobustness.passed}/${run.engineeringRobustness.total}`;
        }

        option.textContent =
          `${run.benchmarkId} · ${run.model || "unknown model"} · ${score} · ${run.runId}`;

        savedRunSelect.appendChild(
          option
        );
      }
    );

    const selectedIndex = savedRuns.findIndex(
      (run) =>
        run.benchmarkId === selectedRun?.benchmarkId &&
        run.runId === selectedRun?.runId
    );

    if (selectedIndex !== -1) {
      savedRunSelect.value = String(selectedIndex);
    }

    savedRunSelect.disabled =
      false;

    savedRunStatus.textContent =
      `${savedRuns.length} saved run${savedRuns.length === 1 ? "" : "s"} available.`;

    updateLoadRunButtonState();
  } catch (error) {
    savedRuns = [];

    savedRunSelect.innerHTML =
      "<option>Unable to load saved runs</option>";

    savedRunSelect.disabled =
      true;

    savedRunStatus.textContent =
      `Unable to load saved runs: ${error.message}`;

    updateLoadRunButtonState();

    console.error(error);
  }
}

async function loadSelectedRun() {
  const selectedRun =
    getSelectedSavedRun();

  if (
    loadRunInProgress ||
    adjudicationInProgress ||
    runInProgress ||
    !selectedRun
  ) {
    return;
  }

  loadRunInProgress =
    true;

  updateLoadRunButtonState();
  updateRunButtonState();

  resultStatus.textContent =
    "Loading saved benchmark run...";

  try {
    const response =
      await fetch(
        "/api/load-run",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            benchmarkId:
              selectedRun.benchmarkId,
            runId:
              selectedRun.runId
          })
        }
      );

    const responseText =
      await response.text();

    let data = null;

    try {
      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch {
      throw new Error(
        `Server returned non-JSON data with HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.error ||
        `HTTP ${response.status}`
      );
    }

    latestBenchmarkResult =
      data;

    resultStatus.textContent =
      `Loaded saved run: ${data.benchmarkId} with ${data.model || "unknown model"}`;

    resultOutput.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

    resultOutput.classList.remove(
      "hidden"
    );

    showAdjudicationForResult(
      data
    );
  } catch (error) {
    resultStatus.textContent =
      `Unable to load saved run: ${error.message}`;

    console.error(error);
  } finally {
    loadRunInProgress =
      false;

    updateLoadRunButtonState();
    updateRunButtonState();
  }
}

async function runBenchmark() {
  const model =
    getSelectedModel();

  const benchmark =
    getSelectedBenchmark();

  if (
    runInProgress ||
    adjudicationInProgress ||
    loadRunInProgress ||
    !model ||
    !benchmark ||
    benchmark.available !== true
  ) {
    return;
  }

  const modelName =
    model.name ||
    model.model;

  if (!modelName) {
    resultStatus.textContent =
      "Cannot run benchmark: selected model has no valid name.";

    return;
  }

  runInProgress = true;
  latestBenchmarkResult = null;

  adjudicationCard.classList.add(
    "hidden"
  );

  modelSelect.disabled = true;
  benchmarkSelect.disabled = true;

  runButton.textContent =
    "Running...";

  updateRunButtonState();
  updateLoadRunButtonState();

  resultStatus.textContent =
    `Running ${benchmark.name} with ${modelName}...`;

  resultOutput.textContent = "";
  resultOutput.classList.add(
    "hidden"
  );

  try {
    const response =
      await fetch(
        "/api/run-benchmark",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            benchmarkId:
              benchmark.id,
            model:
              modelName
          })
        }
      );

    const responseText =
      await response.text();

    let data = null;

    try {
      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch {
      throw new Error(
        `Server returned non-JSON data with HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.error ||
        `HTTP ${response.status}`
      );
    }

    latestBenchmarkResult =
      data;

    resultStatus.textContent =
      `Completed: ${benchmark.name} with ${modelName}`;

    resultOutput.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

    resultOutput.classList.remove(
      "hidden"
    );

    showAdjudicationForResult(
      data
    );

    await loadRuns();
  } catch (error) {
    resultStatus.textContent =
      `Benchmark failed: ${error.message}`;

    resultOutput.textContent =
      JSON.stringify(
        {
          error:
            error.message
        },
        null,
        2
      );

    resultOutput.classList.remove(
      "hidden"
    );

    console.error(error);
  } finally {
    runInProgress = false;

    modelSelect.disabled =
      models.length === 0;

    benchmarkSelect.disabled =
      !benchmarks.some(
        (benchmark) =>
          benchmark.available
      );

    runButton.textContent =
      "Run benchmark";

    updateRunButtonState();
    updateLoadRunButtonState();
  }
}

async function adjudicateBugfix() {
  if (
    adjudicationInProgress ||
    runInProgress ||
    loadRunInProgress ||
    !latestBenchmarkResult ||
    latestBenchmarkResult.benchmarkId !==
      "bugfix-v1" ||
    !latestBenchmarkResult.runId
  ) {
    return;
  }

  const submittedBenchmarkId = latestBenchmarkResult.benchmarkId;
  const submittedRunId = latestBenchmarkResult.runId;
  const isSubmittedRunCurrent = () =>
    latestBenchmarkResult?.benchmarkId === submittedBenchmarkId &&
    latestBenchmarkResult?.runId === submittedRunId;

  let adjudication;

  try {
    adjudication =
      collectAdjudication();
  } catch (error) {
    adjudicationStatus.textContent =
      error.message;

    adjudicationStatus.classList.remove(
      "hidden"
    );

    return;
  }

  adjudicationInProgress = true;
  updateRunButtonState();
  updateLoadRunButtonState();
  adjudicateButton.disabled = true;
  adjudicateButton.textContent =
    "Saving...";

  adjudicationStatus.textContent =
    "Saving adjudication...";

  adjudicationStatus.classList.remove(
    "hidden"
  );

  try {
    const response =
      await fetch(
        "/api/adjudicate-bugfix",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            runId:
              submittedRunId,
            adjudication
          })
        }
      );

    const responseText =
      await response.text();

    let data;

    try {
      data =
        responseText
          ? JSON.parse(
              responseText
            )
          : {};
    } catch {
      throw new Error(
        `Server returned non-JSON data with HTTP ${response.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.detail ||
        data.error ||
        `HTTP ${response.status}`
      );
    }

    if (data.runId !== submittedRunId) {
      throw new Error("Adjudication response runId does not match submitted run");
    }

    if (isSubmittedRunCurrent()) {
      latestBenchmarkResult = {
        ...latestBenchmarkResult,
        evaluation:
          data.evaluation
      };

      resultOutput.textContent =
        JSON.stringify(
          latestBenchmarkResult,
          null,
          2
        );

      adjudicationStatus.textContent =
        `Adjudication saved. Final score: ${data.evaluation.total}/100`;

      adjudicateButton.textContent =
        "Adjudication saved";

      adjudicateButton.disabled =
        true;
    }

    await loadRuns();
  } catch (error) {
    if (isSubmittedRunCurrent()) {
      adjudicationStatus.textContent =
        `Adjudication failed: ${error.message}`;

      adjudicateButton.textContent =
        "Save adjudication";

      adjudicateButton.disabled =
        false;
    }

    console.error(error);
  } finally {
    adjudicationInProgress =
      false;
    updateRunButtonState();
    updateLoadRunButtonState();
  }
}

modelSelect.addEventListener(
  "change",
  () => {
    showModel(
      Number(
        modelSelect.value
      )
    );

    updateRunButtonState();
  }
);

benchmarkSelect.addEventListener(
  "change",
  () => {
    updateRunButtonState();
  }
);

savedRunSelect.addEventListener(
  "change",
  () => {
    updateLoadRunButtonState();
  }
);

loadRunButton.addEventListener(
  "click",
  () => {
    void loadSelectedRun();
  }
);

runButton.addEventListener(
  "click",
  () => {
    void runBenchmark();
  }
);

adjudicateButton.addEventListener(
  "click",
  () => {
    void adjudicateBugfix();
  }
);

buildAdjudicationForm();
loadModels();
loadBenchmarks();
loadRuns();
