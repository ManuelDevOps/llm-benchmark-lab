"use strict";

const fs = require("node:fs");

const OLLAMA_URL = "http://127.0.0.1:11434";

/**
 * Read UTF-8 text while treating an initial UTF-8 BOM as
 * an encoding marker rather than prompt content.
 *
 * The source file is never modified.
 */
function readUtf8Text(filePath) {
  const buffer = fs.readFileSync(filePath);

  const hadUtf8Bom =
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf;

  let text = buffer.toString("utf8");

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  return {
    text,
    hadUtf8Bom,
    sourceByteLength: buffer.length
  };
}

async function getOllamaVersion() {
  const response = await fetch(
    `${OLLAMA_URL}/api/version`
  );

  if (!response.ok) {
    throw new Error(
      `Ollama /api/version failed with HTTP ${response.status}`
    );
  }

  return response.json();
}

async function getRunningModels() {
  const response = await fetch(
    `${OLLAMA_URL}/api/ps`
  );

  if (!response.ok) {
    throw new Error(
      `Ollama /api/ps failed with HTTP ${response.status}`
    );
  }

  return response.json();
}

async function getModelDetails(model) {
  if (typeof model !== "string" || model.trim() === "") {
    throw new Error("A valid Ollama model name is required");
  }

  const response = await fetch(
    `${OLLAMA_URL}/api/show`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Ollama /api/show failed with HTTP ${response.status}`
    );
  }

  return response.json();
}

function buildGenerateRequest(model, prompt, inference) {
  if (typeof model !== "string" || model.trim() === "") {
    throw new Error("A valid Ollama model name is required");
  }

  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new Error("Benchmark prompt is empty");
  }

  if (!inference || typeof inference !== "object") {
    throw new Error(
      "Benchmark inference configuration is missing"
    );
  }

  const request = {
    model,
    prompt,
    stream: false,
    keep_alive: inference.keep_alive ?? 0,
    options: {
      num_ctx: inference.num_ctx,
      temperature: inference.temperature,
      seed: inference.seed,
      num_predict: inference.num_predict
    }
  };

  /*
   * raw=false means normal native model templating.
   * The field is omitted unless a benchmark explicitly
   * requires raw=true.
   */
  if (inference.raw === true) {
    request.raw = true;
  }

  /*
   * No explicit "think" field is added.
   * This preserves the frozen benchmark procedure.
   */

  return request;
}

async function generate(model, prompt, inference) {
  const endpoint =
    inference.endpoint || "/api/generate";

  /*
   * These calls do not generate model output.
   * They capture the runtime identity and model metadata.
   */
  const ollamaVersion =
    await getOllamaVersion();

  const modelDetails =
    await getModelDetails(model);

  /*
   * Capture resident models immediately before generation.
   */
  const preRunState =
    await getRunningModels();

  const request =
    buildGenerateRequest(
      model,
      prompt,
      inference
    );

  const requestJson =
    JSON.stringify(request);

  const response = await fetch(
    `${OLLAMA_URL}${endpoint}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: requestJson
    }
  );

  /*
   * Preserve the exact HTTP response text before
   * interpreting its JSON content.
   */
  const rawResponse =
    await response.text();

  let responseJson;

  try {
    responseJson =
      JSON.parse(rawResponse);
  } catch {
    const error = new Error(
      "Ollama returned a response that is not valid JSON"
    );

    error.httpStatus =
      response.status;

    error.rawResponse =
      rawResponse;

    throw error;
  }

  const postRunState =
    await getRunningModels();

  return {
    ollamaVersion,
    modelDetails,
    request,
    requestJson,
    httpStatus: response.status,
    httpOk: response.ok,
    rawResponse,
    response: responseJson,
    preRunState,
    postRunState
  };
}

module.exports = {
  OLLAMA_URL,
  readUtf8Text,
  getOllamaVersion,
  getRunningModels,
  getModelDetails,
  buildGenerateRequest,
  generate
};