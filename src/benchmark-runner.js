"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  resolveBenchmarkSourceDir
} = require("./benchmark-paths");

const {
  readUtf8Text,
  buildGenerateRequest,
  generate
} = require("./ollama-client");

const {
  evaluateCartTotal
} = require("./adapters/cart-total-v1");

const {
  evaluateBugfix
} = require("./adapters/bugfix-v1");

const PROJECT_ROOT =
  path.resolve(__dirname, "..");

const MANIFESTS_DIR =
  path.join(PROJECT_ROOT, "benchmarks");

const RESULTS_DIR =
  path.join(PROJECT_ROOT, "results");

function readJsonFile(filePath) {
  let text = fs.readFileSync(filePath, "utf8");

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  return JSON.parse(text);
}

function writeText(filePath, text) {
  fs.writeFileSync(
    filePath,
    text,
    {
      encoding: "utf8",
      flag: "w"
    }
  );
}

function writeJson(filePath, value) {
  writeText(
    filePath,
    JSON.stringify(value, null, 2)
  );
}

function sanitizeName(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createRunId(benchmarkId, model) {
  const timestamp =
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  return [
    timestamp,
    sanitizeName(benchmarkId),
    sanitizeName(model)
  ].join("__");
}

function loadManifest(benchmarkId) {
  const manifestPath =
    path.join(
      MANIFESTS_DIR,
      `${benchmarkId}.json`
    );

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Benchmark manifest not found: ${benchmarkId}`
    );
  }

  const manifest =
    readJsonFile(manifestPath);

  if (
    typeof manifest.sourceDir === "string" &&
    manifest.sourceDir.length > 0
  ) {
    manifest.sourceDir =
      resolveBenchmarkSourceDir(
        manifest.sourceDir,
        manifestPath
      );
  }

  if (manifest.id !== benchmarkId) {
    throw new Error(
      `Benchmark manifest ID mismatch: ${benchmarkId}`
    );
  }

  if (
    !manifest.inference ||
    typeof manifest.inference !== "object"
  ) {
    throw new Error(
      `Benchmark inference configuration missing: ${benchmarkId}`
    );
  }

  return {
    manifest,
    manifestPath
  };
}

function resolvePromptPath(manifest) {
  if (
    typeof manifest.promptFile === "string" &&
    manifest.promptFile.length > 0
  ) {
    return path.resolve(
      manifest.sourceDir,
      manifest.promptFile
    );
  }

  if (
    typeof manifest.appPromptFile === "string" &&
    manifest.appPromptFile.length > 0
  ) {
    return path.resolve(
      PROJECT_ROOT,
      manifest.appPromptFile
    );
  }

  throw new Error(
    `No prompt source configured for ${manifest.id}`
  );
}

function calculatePerformance(response) {
  const nsToSeconds = value =>
    typeof value === "number"
      ? value / 1_000_000_000
      : null;

  const evalSeconds =
    nsToSeconds(response.eval_duration);

  const promptSeconds =
    nsToSeconds(response.prompt_eval_duration);

  return {
    totalSeconds:
      nsToSeconds(response.total_duration),

    loadSeconds:
      nsToSeconds(response.load_duration),

    promptEvalSeconds:
      promptSeconds,

    generationSeconds:
      evalSeconds,

    promptTokens:
      response.prompt_eval_count ?? null,

    cachedPromptTokens:
      response.prompt_eval_cached_count ?? null,

    generatedTokens:
      response.eval_count ?? null,

    promptTokensPerSecond:
      typeof response.prompt_eval_count === "number" &&
      promptSeconds > 0
        ? response.prompt_eval_count / promptSeconds
        : null,

    generationTokensPerSecond:
      typeof response.eval_count === "number" &&
      evalSeconds > 0
        ? response.eval_count / evalSeconds
        : null
  };
}

function validateGeneration(
  model,
  execution
) {
  const response =
    execution.response || {};

  const checks = {
    httpSuccess:
      execution.httpOk === true,

    done:
      response.done === true,

    usableAnswer:
      typeof response.response === "string" &&
      response.response.length > 0,

    notTruncated:
      response.done_reason !== "length",

    modelAssociated:
      typeof response.model === "string" &&
      response.model === model
  };

  return {
    valid:
      Object.values(checks)
        .every(Boolean),

    checks,

    requestedModel:
      model,

    returnedModel:
      response.model ?? null,

    doneReason:
      response.done_reason ?? null
  };
}

function evaluateBenchmarkResponse({
  benchmarkId,
  responseText,
  manifest,
  runDir
}) {
  switch (benchmarkId) {
    case "cart-total-v1":
      return evaluateCartTotal({
        responseText,
        manifest,
        runDir
      });

    case "bugfix-v1":
      /*
       * A, B and E are evaluated mechanically.
       *
       * C and D require external semantic adjudication and
       * intentionally remain null here. The bugfix adapter
       * therefore also leaves total null until those scores
       * are supplied separately.
       */
      return evaluateBugfix({
        responseText,
        manifest,
        runDir
      });

    default:
      throw new Error(
        `No benchmark evaluator configured for: ${benchmarkId}`
      );
  }
}

async function runBenchmarkGeneration({
  benchmarkId,
  model
}) {
  if (
    typeof benchmarkId !== "string" ||
    benchmarkId.length === 0
  ) {
    throw new Error(
      "A benchmark ID is required"
    );
  }

  if (
    typeof model !== "string" ||
    model.trim() === ""
  ) {
    throw new Error(
      "A model name is required"
    );
  }

  const {
    manifest,
    manifestPath
  } = loadManifest(benchmarkId);

  const promptPath =
    resolvePromptPath(manifest);

  if (!fs.existsSync(promptPath)) {
    throw new Error(
      `Benchmark prompt not found: ${promptPath}`
    );
  }

  const promptSource =
    readUtf8Text(promptPath);

  if (promptSource.text.length === 0) {
    throw new Error(
      `Benchmark prompt is empty: ${benchmarkId}`
    );
  }

  const plannedRequest =
    buildGenerateRequest(
      model,
      promptSource.text,
      manifest.inference
    );

  const plannedRequestJson =
    JSON.stringify(plannedRequest);

  const runId =
    createRunId(
      benchmarkId,
      model
    );

  const runDir =
    path.join(
      RESULTS_DIR,
      benchmarkId,
      runId
    );

  fs.mkdirSync(
    runDir,
    {
      recursive: true
    }
  );

  /*
   * Preserve everything known before generation.
   * request.json is the exact JSON body planned for Ollama.
   */
  writeText(
    path.join(runDir, "request.json"),
    plannedRequestJson
  );

  writeJson(
    path.join(
      runDir,
      "manifest-snapshot.json"
    ),
    manifest
  );

  writeJson(
    path.join(
      runDir,
      "run-start.json"
    ),
    {
      runId,
      benchmarkId,
      model,
      startedAt:
        new Date().toISOString(),

      manifestPath,
      promptPath,

      promptSource: {
        hadUtf8Bom:
          promptSource.hadUtf8Bom,

        sourceByteLength:
          promptSource.sourceByteLength,

        promptCharacterLength:
          promptSource.text.length,

        firstCodePoint:
          promptSource.text.length > 0
            ? promptSource.text.codePointAt(0)
            : null
      }
    }
  );

  let execution;

  try {
    execution =
      await generate(
        model,
        promptSource.text,
        manifest.inference
      );
  } catch (error) {
    /*
     * If Ollama returned any raw body before an error,
     * preserve it rather than losing evidence.
     */
    if (
      typeof error.rawResponse === "string"
    ) {
      writeText(
        path.join(
          runDir,
          "response-raw.json"
        ),
        error.rawResponse
      );
    }

    writeJson(
      path.join(
        runDir,
        "run-error.json"
      ),
      {
        name:
          error.name,

        message:
          error.message,

        httpStatus:
          error.httpStatus ?? null,

        recordedAt:
          new Date().toISOString()
      }
    );

    throw error;
  }

  /*
   * Preserve the raw response before extracting
   * the answer or calculating benchmark results.
   */
  writeText(
    path.join(
      runDir,
      "response-raw.json"
    ),
    execution.rawResponse
  );

  /*
   * Verify that the request actually sent by the
   * Ollama client is identical to the archived one.
   */
  const requestMatches =
    execution.requestJson ===
    plannedRequestJson;

  if (!requestMatches) {
    writeJson(
      path.join(
        runDir,
        "run-error.json"
      ),
      {
        name:
          "RequestMismatchError",

        message:
          "Archived request differs from request sent to Ollama",

        recordedAt:
          new Date().toISOString()
      }
    );

    throw new Error(
      "Archived request differs from request sent to Ollama"
    );
  }

  const validation =
    validateGeneration(
      model,
      execution
    );

  const performance =
    calculatePerformance(
      execution.response
    );

  /*
   * response.txt is an exact extraction of Ollama's
   * response field. No evaluator has modified it.
   */
  writeText(
    path.join(
      runDir,
      "response.txt"
    ),
    typeof execution.response.response === "string"
      ? execution.response.response
      : ""
  );

  writeJson(
    path.join(
      runDir,
      "runtime.json"
    ),
    {
      runId,
      benchmarkId,
      model,

      completedAt:
        new Date().toISOString(),

      ollamaVersion:
        execution.ollamaVersion,

      modelDetails:
        execution.modelDetails,

      preRunState:
        execution.preRunState,

      postRunState:
        execution.postRunState,

      httpStatus:
        execution.httpStatus,

      validation,

      performance,

      responseMetadata: {
        model:
          execution.response.model ?? null,

        createdAt:
          execution.response.created_at ?? null,

        done:
          execution.response.done ?? null,

        doneReason:
          execution.response.done_reason ?? null,

        totalDuration:
          execution.response.total_duration ?? null,

        loadDuration:
          execution.response.load_duration ?? null,

        promptEvalCount:
          execution.response.prompt_eval_count ?? null,

        promptEvalCachedCount:
          execution.response.prompt_eval_cached_count ?? null,

        promptEvalDuration:
          execution.response.prompt_eval_duration ?? null,

        evalCount:
          execution.response.eval_count ?? null,

        evalDuration:
          execution.response.eval_duration ?? null
      }
    }
  );

  /*
   * Evaluation happens only after all original generation
   * evidence has been archived above.
   *
   * An evaluator failure is kept separate from generation
   * validity so a valid model answer is never misclassified
   * as an inference failure or rerun unnecessarily.
   */
  let evaluation = null;
  let evaluationError = null;

  if (validation.valid) {
    try {
      evaluation =
        evaluateBenchmarkResponse({
          benchmarkId,
          responseText:
            execution.response.response,
          manifest,
          runDir
        });
    } catch (error) {
      evaluationError = {
        name:
          error.name,
        message:
          error.message,
        recordedAt:
          new Date().toISOString()
      };

      writeJson(
        path.join(
          runDir,
          "evaluation-error.json"
        ),
        evaluationError
      );
    }
  }

  return {
    runId,
    runDir,
    benchmarkId,
    model,
    validation,
    performance,
    evaluation,
    evaluationError
  };
}

module.exports = {
  PROJECT_ROOT,
  MANIFESTS_DIR,
  RESULTS_DIR,
  readJsonFile,
  loadManifest,
  resolvePromptPath,
  calculatePerformance,
  validateGeneration,
  evaluateBenchmarkResponse,
  runBenchmarkGeneration
};