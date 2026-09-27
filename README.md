# LLM Benchmark Lab

[![CI](https://github.com/ManuelDevOps/llm-benchmark-lab/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ManuelDevOps/llm-benchmark-lab/actions/workflows/ci.yml)

LLM Benchmark Lab is a local-first web application for running reproducible benchmarks against models available through Ollama.

It discovers Ollama models, runs fixed benchmark prompts, evaluates supported outputs, records performance metrics, and stores detailed run artefacts locally.

## Current status

Early public version.

Validated on Windows 11 with:

- Node.js 24.19.0
- Ollama 0.34.4
- NVIDIA GPU acceleration

The code uses portable benchmark paths. macOS and Linux execution have not yet been validated by this project.

## Features

- Detects models available through Ollama.
- Runs benchmark-specific prompts with fixed inference settings.
- Records generation timing and token metrics.
- Evaluates benchmark-specific correctness.
- Preserves detailed run artefacts locally.
- Prevents parallel benchmark executions.
- Keeps the application server bound to the local loopback interface.
- Sanitizes browser-facing results to avoid exposing local filesystem paths.
- Includes portable benchmark packs.
- Requires no third-party Node.js packages.

## Architecture

The application runs on the user machine:

```text
Browser
  |
  v
http://127.0.0.1:3000
  |
  v
LLM Benchmark Lab
  |
  v
http://127.0.0.1:11434
  |
  v
Ollama
  |
  v
Selected model
```

The application server listens on `127.0.0.1:3000` and connects to Ollama at `127.0.0.1:11434`.

It is not designed to expose either service directly to the public Internet.

## Requirements

### Node.js

This project has been validated with Node.js 24.19.0.

Use a currently supported Node.js release that provides the APIs required by the application.

Download Node.js from:

https://nodejs.org/

### Ollama

Ollama must be installed and running.

Download Ollama from:

https://ollama.com/download

The application expects the Ollama API at:

`http://127.0.0.1:11434`

At least one compatible model must be available before running a benchmark.

Check available models with:

```bash
ollama list
```

Install a model with:

```bash
ollama pull <model>
```

## Installation

Clone the repository:

```bash
git clone https://github.com/ManuelDevOps/llm-benchmark-lab.git
cd llm-benchmark-lab
```

No `npm install` step is currently required because the application uses only Node.js built-in modules and browser APIs.

Start the application:

```bash
npm start
```

Then open:

`http://127.0.0.1:3000`

## Running a benchmark

1. Make sure Ollama is running.
2. Make sure at least one model is available.
3. Start LLM Benchmark Lab with `npm start`.
4. Open `http://127.0.0.1:3000`.
5. Select a model.
6. Select a benchmark.
7. Click **Run benchmark**.
8. Review the result shown in the browser.

Detailed run artefacts are stored under:

`results/<benchmark-id>/<run-id>/`

The `results/` directory is intentionally excluded from Git.

## Included benchmarks

### Cart Total v1

Category: code generation.

The benchmark asks the model to generate JavaScript from a fixed set of requirements and evaluates syntax, functional correctness, regression behaviour, and performance metadata.

### Bugfix v1

Category: debugging.

The benchmark asks the model to diagnose and patch an existing JavaScript implementation.

Mechanical portions of the evaluation are performed automatically.

The frozen `bugfix-v1` pack also includes its specification, defect registry, scoring rubric, execution procedure, baseline validation record, and reference implementation. These artefacts support reproducibility, validation, auditing, and separate adjudication of the benchmark.

They are not included in the normal model prompt. During automatic patch evaluation, the adapter creates the workspace `reference-v1.js` from the model-patched `buggy-v1.js` before running the hidden tests. The frozen `reference-v1.js` stored in the benchmark pack is therefore a validation and audit artefact, not the candidate implementation used to score a model response.

Some semantic and patch-discipline scoring components require separate adjudication and may remain `null` in an automatic run.

## Benchmark reproducibility

Benchmark manifests define fixed inference settings such as context size, temperature, seed, maximum generated tokens, and model keep-alive behaviour.

Benchmark source packs use paths relative to the repository so the application does not depend on the original developer's filesystem layout.

Benchmark artefacts under `benchmarks/` are treated as frozen inputs where appropriate. Their byte representation is preserved by the Git configuration in `.gitattributes`.

## About hidden tests

Some benchmark files are named `hidden-tests` or `hidden-runner`.

In this public repository, these files are available to anyone who inspects the source code. Hidden means that they are not included in the prompt presented to the model during a normal benchmark execution.

They should not be interpreted as secret or as suitable for a high-stakes blind evaluation once a participant has inspected the repository.

## Privacy

LLM Benchmark Lab does not currently implement application telemetry, analytics, user accounts, or a remote application backend.

The browser-facing API is designed to omit local filesystem paths from benchmark metadata, successful benchmark responses, and handled error responses.

Full diagnostic artefacts remain on the user's own machine under `results/`.

Those local artefacts can contain information such as:

- local filesystem paths;
- Ollama model metadata;
- model identifiers;
- prompts and responses;
- benchmark execution details.

Review local result files before sharing them publicly.

Privacy guarantees depend on how Ollama and the selected model are configured. If inference is configured to use remote or cloud services, data handling is governed by those services rather than by LLM Benchmark Lab.

## Security scope

The server is intentionally bound to `127.0.0.1`.

Do not modify the host binding to `0.0.0.0`, configure public port forwarding, or expose the application directly to the Internet without first adding appropriate authentication, authorization, network security, and deployment controls.

## Project structure

```text
llm-benchmark-lab/
|-- benchmarks/
|   |-- assets/
|   |-- packs/
|   |   |-- bugfix-v1/
|   |   `-- cart-total-v1/
|   |-- bugfix-v1.json
|   `-- cart-total-v1.json
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- src/
|   |-- adapters/
|   |-- benchmark-paths.js
|   |-- benchmark-runner.js
|   |-- ollama-client.js
|   |-- public-result.js
|   `-- server.js
|-- .gitattributes
|-- .gitignore
|-- LICENSE
|-- package.json
`-- README.md
```

## Testing roadmap

The current benchmark set validates the application architecture, but it is not the final test suite.

Planned work includes:

- automated regression tests for the application itself;
- additional benchmark packs covering more programming and debugging scenarios;
- repeatable validation of privacy sanitization and portable paths;
- cross-platform validation on macOS and Linux;
- benchmark versioning so existing frozen tests remain comparable over time.

## License

LLM Benchmark Lab is released under the MIT License.

See `LICENSE` for the full license text.
