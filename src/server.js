"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const {
  resolveBenchmarkSourceDir
} = require("./benchmark-paths");

const {
  sanitizePublicValue,
  createPublicBenchmarkResult
} = require("./public-result");

const {
  runBenchmarkGeneration,
  RESULTS_DIR
} = require("./benchmark-runner");

const {
  writeBugfixAdjudication
} = require("./bugfix-adjudication-store");

const HOST = "127.0.0.1";
const PORT = 3000;
const OLLAMA_URL = "http://127.0.0.1:11434";

const MAX_JSON_BODY_BYTES =
  16 * 1024;

let benchmarkRunActive = false;

const rootDir = path.join(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const benchmarksDir = path.join(rootDir, "benchmarks");

const staticFiles = {
  "/": {
    file: "index.html",
    contentType: "text/html; charset=utf-8"
  },
  "/styles.css": {
    file: "styles.css",
    contentType: "text/css; charset=utf-8"
  },
  "/app.js": {
    file: "app.js",
    contentType: "application/javascript; charset=utf-8"
  }
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data, null, 2));
}

function serveStaticFile(req, res) {
  const entry = staticFiles[req.url];

  if (!entry) {
    return false;
  }

  const filePath = path.join(publicDir, entry.file);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(500, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Unable to read static file.");
      return;
    }

    res.writeHead(200, {
      "Content-Type": entry.contentType,
      "Cache-Control": "no-store"
    });

    res.end(content);
  });

  return true;
}

async function handleModels(res) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = await response.json();

    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 503, {
      error: "Unable to contact Ollama",
      detail:
        sanitizePublicValue(
          error.message
        )
    });
  }
}

function readJsonBody(
  req,
  maxBytes = MAX_JSON_BODY_BYTES
) {
  return new Promise(
    (resolve, reject) => {
      let body = "";
      let receivedBytes = 0;
      let settled = false;

      req.setEncoding("utf8");

      req.on("data", chunk => {
        if (settled) {
          return;
        }

        receivedBytes +=
          Buffer.byteLength(
            chunk,
            "utf8"
          );

        if (receivedBytes > maxBytes) {
          settled = true;

          const error =
            new Error(
              "Request body exceeds allowed size"
            );

          error.code =
            "REQUEST_BODY_TOO_LARGE";

          reject(error);

          /*
           * Continue consuming the incoming request without
           * retaining additional data in memory.
           */
          req.resume();
          return;
        }

        body += chunk;
      });

      req.on("end", () => {
        if (settled) {
          return;
        }

        settled = true;

        if (body.trim() === "") {
          const error =
            new Error(
              "Request body is empty"
            );

          error.code =
            "EMPTY_REQUEST_BODY";

          reject(error);
          return;
        }

        try {
          resolve(
            JSON.parse(body)
          );
        } catch (parseError) {
          const error =
            new Error(
              "Request body is not valid JSON"
            );

          error.code =
            "INVALID_JSON";

          error.cause =
            parseError;

          reject(error);
        }
      });

      req.on("aborted", () => {
        if (settled) {
          return;
        }

        settled = true;

        const error =
          new Error(
            "Request was aborted"
          );

        error.code =
          "REQUEST_ABORTED";

        reject(error);
      });

      req.on("error", error => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      });
    }
  );
}

async function handleRunBenchmark(
  req,
  res
) {
  const contentType =
    String(
      req.headers["content-type"] || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  if (contentType !== "application/json") {
    sendJson(
      res,
      415,
      {
        error:
          "Content-Type must be application/json"
      }
    );

    return;
  }

  let body;

  try {
    body =
      await readJsonBody(req);
  } catch (error) {
    let statusCode = 400;

    if (
      error.code ===
      "REQUEST_BODY_TOO_LARGE"
    ) {
      statusCode = 413;
    }

    sendJson(
      res,
      statusCode,
      {
        error:
          "Invalid benchmark request",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );

    return;
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "Request body must be a JSON object"
      }
    );

    return;
  }

  const benchmarkId =
    body.benchmarkId;

  const model =
    body.model;

  if (
    typeof benchmarkId !== "string" ||
    benchmarkId.trim() === ""
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "benchmarkId must be a non-empty string"
      }
    );

    return;
  }

  if (
    typeof model !== "string" ||
    model.trim() === ""
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "model must be a non-empty string"
      }
    );

    return;
  }

  if (benchmarkRunActive) {
    sendJson(
      res,
      409,
      {
        error:
          "A benchmark run is already active"
      }
    );

    return;
  }

  benchmarkRunActive = true;

  try {
    const result =
      await runBenchmarkGeneration({
        benchmarkId:
          benchmarkId.trim(),

        model:
          model.trim()
      });

    const publicResult =
      createPublicBenchmarkResult(result);

    sendJson(
      res,
      200,
      publicResult
    );
  } catch (error) {
    sendJson(
      res,
      500,
      {
        error:
          "Benchmark execution failed",

        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );
  } finally {
    benchmarkRunActive = false;
  }
}

async function handleAdjudicateBugfix(
  req,
  res
) {
  const contentType =
    String(
      req.headers["content-type"] || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  if (contentType !== "application/json") {
    sendJson(
      res,
      415,
      {
        error:
          "Content-Type must be application/json"
      }
    );

    return;
  }

  let body;

  try {
    body =
      await readJsonBody(req);
  } catch (error) {
    let statusCode = 400;

    if (
      error.code ===
      "REQUEST_BODY_TOO_LARGE"
    ) {
      statusCode = 413;
    }

    sendJson(
      res,
      statusCode,
      {
        error:
          "Invalid adjudication request",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );

    return;
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "Request body must be a JSON object"
      }
    );

    return;
  }

  if (
    typeof body.runId !== "string" ||
    body.runId.trim() === ""
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "runId must be a non-empty string"
      }
    );

    return;
  }

  if (
    !body.adjudication ||
    typeof body.adjudication !== "object" ||
    Array.isArray(body.adjudication)
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "adjudication must be an object"
      }
    );

    return;
  }

  const runId =
    body.runId.trim();

  try {
    const finalEvaluation =
      writeBugfixAdjudication({
        resultsDir:
          RESULTS_DIR,
        runId,
        adjudication:
          body.adjudication
      });

    sendJson(
      res,
      200,
      {
        runId,
        evaluation:
          sanitizePublicValue(
            finalEvaluation
          )
      }
    );
  } catch (error) {
    let statusCode = 500;

    if (
      error instanceof TypeError ||
      error instanceof RangeError ||
      /runId/i.test(error.message) ||
      /criterion/i.test(error.message)
    ) {
      statusCode = 400;
    } else if (
      /run does not exist/i.test(
        error.message
      )
    ) {
      statusCode = 404;
    } else if (
      /already exists/i.test(
        error.message
      ) ||
      /Mechanical evaluation does not exist/i.test(
        error.message
      )
    ) {
      statusCode = 409;
    }

    sendJson(
      res,
      statusCode,
      {
        error:
          "Bugfix adjudication failed",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );
  }
}
function loadBenchmarks() {
  if (!fs.existsSync(benchmarksDir)) {
    return [];
  }

  const files = fs
    .readdirSync(benchmarksDir)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort();

  return files.map((file) => {
    const manifestPath = path.join(benchmarksDir, file);

    try {
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, "utf8")
      );

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

      const issues = [];

      if (!manifest.id) {
        issues.push("Missing id");
      }

      if (!manifest.name) {
        issues.push("Missing name");
      }

      if (!manifest.sourceDir) {
        issues.push("Missing sourceDir");
      } else if (!fs.existsSync(manifest.sourceDir)) {
        issues.push("sourceDir does not exist");
      }

      if (manifest.contractFile && manifest.sourceDir) {
        const contractPath = path.join(
          manifest.sourceDir,
          manifest.contractFile
        );

        if (!fs.existsSync(contractPath)) {
          issues.push("contractFile does not exist");
        }
      }

      if (manifest.promptFile && manifest.sourceDir) {
        const promptPath = path.join(
          manifest.sourceDir,
          manifest.promptFile
        );

        if (!fs.existsSync(promptPath)) {
          issues.push("promptFile does not exist");
        }
      }

      if (manifest.appPromptFile) {
        const appPromptPath = path.join(
          rootDir,
          manifest.appPromptFile
        );

        if (!fs.existsSync(appPromptPath)) {
          issues.push("appPromptFile does not exist");
        }
      }

      if (manifest.testFile && manifest.sourceDir) {
        const testPath = path.join(
          manifest.sourceDir,
          manifest.testFile
        );

        if (!fs.existsSync(testPath)) {
          issues.push("testFile does not exist");
        }
      }

      return {
        id: manifest.id,
        name: manifest.name,
        category: manifest.category,
        available: issues.length === 0
      };
    } catch (error) {
      return {
        id: null,
        name: "Invalid benchmark manifest",
        category: "invalid",
        available: false
      };
    }
  });
}

function readPersistedJson(
  filePath
) {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      "utf8"
    )
  );
}

function loadPersistedRuns() {
  const benchmarkIds =
    loadBenchmarks()
      .map(
        (benchmark) =>
          benchmark.id
      )
      .filter(
        (benchmarkId) =>
          typeof benchmarkId ===
            "string" &&
          benchmarkId.length > 0
      );

  const runs = [];

  for (const benchmarkId of benchmarkIds) {
    const benchmarkResultsDir =
      path.join(
        RESULTS_DIR,
        benchmarkId
      );

    if (
      !fs.existsSync(
        benchmarkResultsDir
      ) ||
      !fs.statSync(
        benchmarkResultsDir
      ).isDirectory()
    ) {
      continue;
    }

    const entries =
      fs.readdirSync(
        benchmarkResultsDir,
        {
          withFileTypes: true
        }
      );

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const runId =
        entry.name;

      const runDir =
        path.join(
          benchmarkResultsDir,
          runId
        );

      const runStartPath =
        path.join(
          runDir,
          "run-start.json"
        );

      const runtimePath =
        path.join(
          runDir,
          "runtime.json"
        );

      const finalEvaluationPath =
        path.join(
          runDir,
          "evaluation-final.json"
        );

      const mechanicalEvaluationPath =
        path.join(
          runDir,
          "evaluation.json"
        );

      const evaluationPath =
        fs.existsSync(
          finalEvaluationPath
        )
          ? finalEvaluationPath
          : mechanicalEvaluationPath;

      if (
        !fs.existsSync(
          runStartPath
        ) ||
        !fs.existsSync(
          runtimePath
        ) ||
        !fs.existsSync(
          evaluationPath
        )
      ) {
        continue;
      }

      try {
        const runStart =
          readPersistedJson(
            runStartPath
          );

        const runtime =
          readPersistedJson(
            runtimePath
          );

        const evaluation =
          readPersistedJson(
            evaluationPath
          );

        if (
          runStart.runId !==
            runId ||
          runStart.benchmarkId !==
            benchmarkId ||
          runtime.runId !==
            runId ||
          runtime.benchmarkId !==
            benchmarkId
        ) {
          continue;
        }

        const runSummary = {
          runId,
          benchmarkId,
          model:
            runStart.model ??
            runtime.model ??
            null,
          completedAt:
            runtime.completedAt ??
            null,
          total:
            evaluation.total ??
            null,
          hasFinalEvaluation:
            evaluationPath ===
            finalEvaluationPath
        };

        if (
          benchmarkId ===
          "cart-total-v1"
        ) {
          runSummary.explicitRequirements =
            evaluation.hiddenTests
              ?.explicitRequirements ??
            null;

          runSummary.engineeringRobustness =
            evaluation.hiddenTests
              ?.engineeringRobustness ??
            null;
        }

        runs.push(
          sanitizePublicValue(
            runSummary
          )
        );
      } catch {
        continue;
      }
    }
  }

  runs.sort(
    (left, right) =>
      String(
        right.completedAt ?? ""
      ).localeCompare(
        String(
          left.completedAt ?? ""
        )
      )
  );

  return runs;
}

function loadPersistedRun(
  benchmarkId,
  runId
) {
  if (
    typeof benchmarkId !== "string" ||
    benchmarkId.trim() === ""
  ) {
    throw new TypeError(
      "benchmarkId must be a non-empty string"
    );
  }

  if (
    typeof runId !== "string" ||
    runId.trim() === ""
  ) {
    throw new TypeError(
      "runId must be a non-empty string"
    );
  }

  const normalizedBenchmarkId =
    benchmarkId.trim();

  const normalizedRunId =
    runId.trim();

  const registered =
    loadBenchmarks()
      .some(
        (benchmark) =>
          benchmark.id ===
          normalizedBenchmarkId
      );

  if (!registered) {
    throw new Error(
      "Benchmark is not registered"
    );
  }

  if (
    normalizedRunId === "." ||
    normalizedRunId === ".." ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
      normalizedRunId
    )
  ) {
    throw new Error(
      "runId contains invalid path characters"
    );
  }

  const benchmarkResultsDir =
    path.resolve(
      RESULTS_DIR,
      normalizedBenchmarkId
    );

  const runDir =
    path.resolve(
      benchmarkResultsDir,
      normalizedRunId
    );

  const relative =
    path.relative(
      benchmarkResultsDir,
      runDir
    );

  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "runId resolves outside the benchmark results directory"
    );
  }

  if (
    !fs.existsSync(runDir) ||
    !fs.statSync(runDir).isDirectory()
  ) {
    throw new Error(
      "Benchmark run does not exist"
    );
  }

  const runStartPath =
    path.join(
      runDir,
      "run-start.json"
    );

  const runtimePath =
    path.join(
      runDir,
      "runtime.json"
    );

  const finalEvaluationPath =
    path.join(
      runDir,
      "evaluation-final.json"
    );

  const mechanicalEvaluationPath =
    path.join(
      runDir,
      "evaluation.json"
    );

  const evaluationErrorPath =
    path.join(
      runDir,
      "evaluation-error.json"
    );

  if (
    !fs.existsSync(runStartPath) ||
    !fs.existsSync(runtimePath)
  ) {
    throw new Error(
      "Persisted benchmark run is incomplete"
    );
  }

  const runStart =
    readPersistedJson(
      runStartPath
    );

  const runtime =
    readPersistedJson(
      runtimePath
    );

  if (
    runStart.runId !==
      normalizedRunId ||
    runStart.benchmarkId !==
      normalizedBenchmarkId ||
    runtime.runId !==
      normalizedRunId ||
    runtime.benchmarkId !==
      normalizedBenchmarkId
  ) {
    throw new Error(
      "Persisted benchmark run metadata does not match its location"
    );
  }

  let evaluation = null;

  if (
    fs.existsSync(
      finalEvaluationPath
    )
  ) {
    evaluation =
      readPersistedJson(
        finalEvaluationPath
      );
  } else if (
    fs.existsSync(
      mechanicalEvaluationPath
    )
  ) {
    evaluation =
      readPersistedJson(
        mechanicalEvaluationPath
      );
  }

  const evaluationError =
    fs.existsSync(
      evaluationErrorPath
    )
      ? readPersistedJson(
          evaluationErrorPath
        )
      : null;

  return createPublicBenchmarkResult({
    runId:
      normalizedRunId,
    benchmarkId:
      normalizedBenchmarkId,
    model:
      runStart.model ??
      runtime.model ??
      null,
    validation:
      runtime.validation ??
      null,
    performance:
      runtime.performance ??
      null,
    evaluation,
    evaluationError
  });
}

async function handleLoadRun(
  req,
  res
) {
  const contentType =
    String(
      req.headers["content-type"] || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  if (contentType !== "application/json") {
    sendJson(
      res,
      415,
      {
        error:
          "Content-Type must be application/json"
      }
    );

    return;
  }

  let body;

  try {
    body =
      await readJsonBody(req);
  } catch (error) {
    let statusCode = 400;

    if (
      error.code ===
      "REQUEST_BODY_TOO_LARGE"
    ) {
      statusCode = 413;
    }

    sendJson(
      res,
      statusCode,
      {
        error:
          "Invalid load-run request",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );

    return;
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    sendJson(
      res,
      400,
      {
        error:
          "Request body must be a JSON object"
      }
    );

    return;
  }

  try {
    const result =
      loadPersistedRun(
        body.benchmarkId,
        body.runId
      );

    sendJson(
      res,
      200,
      result
    );
  } catch (error) {
    let statusCode = 500;

    if (
      error instanceof TypeError ||
      /invalid path/i.test(
        error.message
      ) ||
      /not registered/i.test(
        error.message
      ) ||
      /resolves outside/i.test(
        error.message
      )
    ) {
      statusCode = 400;
    } else if (
      /run does not exist/i.test(
        error.message
      )
    ) {
      statusCode = 404;
    } else if (
      /incomplete/i.test(
        error.message
      ) ||
      /does not match/i.test(
        error.message
      )
    ) {
      statusCode = 409;
    }

    sendJson(
      res,
      statusCode,
      {
        error:
          "Unable to load benchmark run",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );
  }
}

function handleRuns(res) {
  try {
    sendJson(
      res,
      200,
      {
        runs:
          loadPersistedRuns()
      }
    );
  } catch (error) {
    sendJson(
      res,
      500,
      {
        error:
          "Unable to discover benchmark runs",
        detail:
          sanitizePublicValue(
            error.message
          )
      }
    );
  }
}

function handleBenchmarks(res) {
  try {
    const benchmarks = loadBenchmarks();

    sendJson(res, 200, {
      benchmarks
    });
  } catch (error) {
    sendJson(res, 500, {
      error: "Unable to discover benchmarks",
      detail:
        sanitizePublicValue(
          error.message
        )
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && serveStaticFile(req, res)) {
    return;
  }

  if (req.url === "/api/models" && req.method === "GET") {
    await handleModels(res);
    return;
  }

  if (req.url === "/api/benchmarks" && req.method === "GET") {
    handleBenchmarks(res);
    return;
  }

  if (req.url === "/api/runs" && req.method === "GET") {
    handleRuns(res);
    return;
  }

  if (req.url === "/api/run-benchmark" && req.method === "POST") {
    await handleRunBenchmark(req, res);
    return;
  }

  if (req.url === "/api/load-run" && req.method === "POST") {
    await handleLoadRun(req, res);
    return;
  }

  if (req.url === "/api/adjudicate-bugfix" && req.method === "POST") {
    await handleAdjudicateBugfix(req, res);
    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not found");
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(
      `LLM Benchmark Lab running at http://${HOST}:${PORT}`
    );
  });
}

module.exports = {
  server,
  HOST
};
