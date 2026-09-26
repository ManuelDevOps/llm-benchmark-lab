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

const resultStatus = document.getElementById("resultStatus");
const resultOutput = document.getElementById("resultOutput");

let models = [];
let benchmarks = [];
let runInProgress = false;

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

function updateRunButtonState() {
  const model = getSelectedModel();
  const benchmark = getSelectedBenchmark();

  runButton.disabled =
    runInProgress ||
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

  modelParameters.textContent = details.parameter_size || "-";
  modelQuantization.textContent = details.quantization_level || "-";
  modelSize.textContent = formatBytes(model.size);

  modelContext.textContent =
    details.context_length?.toLocaleString() || "-";

  modelCapabilities.textContent =
    Array.isArray(model.capabilities) && model.capabilities.length
      ? model.capabilities.join(", ")
      : "-";

  modelDetails.classList.remove("hidden");
}

async function loadModels() {
  try {
    const response = await fetch("/api/models");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    models = Array.isArray(data.models) ? data.models : [];

    if (models.length === 0) {
      throw new Error("No Ollama models found");
    }

    modelSelect.innerHTML = "";

    models.forEach((model, index) => {
      const option = document.createElement("option");

      option.value = String(index);
      option.textContent = model.name;

      modelSelect.appendChild(option);
    });

    modelSelect.disabled = false;

    ollamaStatus.textContent =
      `Ollama online · ${models.length} models`;

    ollamaStatus.className = "status status-online";

    showModel(0);
    updateRunButtonState();
  } catch (error) {
    models = [];

    modelSelect.innerHTML =
      "<option>Unable to load models</option>";

    modelSelect.disabled = true;

    ollamaStatus.textContent = "Ollama unavailable";
    ollamaStatus.className = "status status-error";

    updateRunButtonState();

    console.error(error);
  }
}

async function loadBenchmarks() {
  try {
    const response = await fetch("/api/benchmarks");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    benchmarks = Array.isArray(data.benchmarks)
      ? data.benchmarks
      : [];

    benchmarkSelect.innerHTML = "";

    if (benchmarks.length === 0) {
      benchmarkSelect.innerHTML =
        "<option>No benchmarks found</option>";

      benchmarkSelect.disabled = true;
      updateRunButtonState();
      return;
    }

    benchmarks.forEach((benchmark, index) => {
      const option = document.createElement("option");

      option.value = String(index);

      option.textContent =
        `${benchmark.name} · ${benchmark.category}`;

      if (!benchmark.available) {
        option.disabled = true;
        option.textContent += " · unavailable";
      }

      benchmarkSelect.appendChild(option);
    });

    const firstAvailableIndex =
      benchmarks.findIndex((benchmark) => benchmark.available);

    if (firstAvailableIndex === -1) {
      benchmarkSelect.disabled = true;
      updateRunButtonState();
      return;
    }

    benchmarkSelect.value = String(firstAvailableIndex);
    benchmarkSelect.disabled = false;

    updateRunButtonState();
  } catch (error) {
    benchmarks = [];

    benchmarkSelect.innerHTML =
      "<option>Unable to load benchmarks</option>";

    benchmarkSelect.disabled = true;

    updateRunButtonState();

    console.error(error);
  }
}

async function runBenchmark() {
  const model = getSelectedModel();
  const benchmark = getSelectedBenchmark();

  if (
    runInProgress ||
    !model ||
    !benchmark ||
    benchmark.available !== true
  ) {
    return;
  }

  const modelName = model.name || model.model;

  if (!modelName) {
    resultStatus.textContent =
      "Cannot run benchmark: selected model has no valid name.";
    return;
  }

  runInProgress = true;

  modelSelect.disabled = true;
  benchmarkSelect.disabled = true;

  runButton.textContent = "Running...";

  updateRunButtonState();

  resultStatus.textContent =
    `Running ${benchmark.name} with ${modelName}...`;

  resultOutput.textContent = "";
  resultOutput.classList.add("hidden");

  try {
    const response = await fetch(
      "/api/run-benchmark",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          benchmarkId: benchmark.id,
          model: modelName
        })
      }
    );

    const responseText = await response.text();

    let data = null;

    try {
      data = responseText
        ? JSON.parse(responseText)
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

    resultStatus.textContent =
      `Completed: ${benchmark.name} with ${modelName}`;

    resultOutput.textContent =
      JSON.stringify(data, null, 2);

    resultOutput.classList.remove("hidden");
  } catch (error) {
    resultStatus.textContent =
      `Benchmark failed: ${error.message}`;

    resultOutput.textContent =
      JSON.stringify(
        {
          error: error.message
        },
        null,
        2
      );

    resultOutput.classList.remove("hidden");

    console.error(error);
  } finally {
    runInProgress = false;

    modelSelect.disabled = models.length === 0;

    benchmarkSelect.disabled =
      !benchmarks.some((benchmark) => benchmark.available);

    runButton.textContent = "Run benchmark";

    updateRunButtonState();
  }
}

modelSelect.addEventListener("change", () => {
  showModel(Number(modelSelect.value));
  updateRunButtonState();
});

benchmarkSelect.addEventListener("change", () => {
  updateRunButtonState();
});

runButton.addEventListener("click", () => {
  void runBenchmark();
});

loadModels();
loadBenchmarks();