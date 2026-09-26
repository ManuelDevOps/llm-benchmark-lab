# bugfix-v1 - Model Execution Procedure

Version: 1.0
Status: FROZEN once hashed
Benchmark: bugfix-v1

## 1. Runtime

Operating system:
Windows 11

Inference runtime:
Ollama 0.34.4

Verified locally before benchmark execution:

Client:
ollama version is 0.34.4

Server API:
{"version":"0.34.4"}

All evaluated models in bugfix-v1 must use this same Ollama runtime version.

If the Ollama runtime changes before all intended model comparisons are
completed, the change must be documented before further comparisons are
treated as directly equivalent.

## 2. API

Endpoint:

http://127.0.0.1:11434/api/generate

Method:
POST

stream:
false

The model's native Ollama template is used.

raw is not enabled.

No explicit think=true or think=false field is supplied.

## 3. Frozen generation parameters

options:

{
  "num_ctx": 32768,
  "temperature": 0,
  "seed": 42,
  "num_predict": 4096
}

keep_alive:

0

These parameters are identical for every evaluated model unless a future
benchmark version explicitly changes them.

## 4. Prompt

Every model receives the exact bytes represented by:

model-prompt-v1.txt

SHA-256:

86714D579EDA4505974C0EB4668F5521780D6640CBAA57427A0233045E016EA2

No hidden test, defect registry, reference implementation, previous model
answer, previous patch, or benchmark result may be added to the request.

## 5. Per-model identity

Before execution, record the exact Ollama model name/tag.

Model metadata available through Ollama must also be preserved before or
alongside the measured run.

A model tag must not be silently replaced by another quantization or model
revision.

## 6. Pre-run state

Before each measured request:

1. record `ollama ps`;
2. verify that the target model is not intentionally being retained from a
   previous benchmark run;
3. do not perform a warm-up generation using model-prompt-v1.txt;
4. preserve any relevant runtime-state evidence.

The measured request itself is the benchmark generation.

## 7. Request construction

The request must contain:

{
  "model": "<exact-model-tag>",
  "prompt": "<exact contents of model-prompt-v1.txt>",
  "stream": false,
  "keep_alive": 0,
  "options": {
    "num_ctx": 32768,
    "temperature": 0,
    "seed": 42,
    "num_predict": 4096
  }
}

No additional generation option may be added for one model but not another.

## 8. Raw artefacts

For every measured run preserve at least:

- exact request JSON;
- complete raw response JSON;
- extracted response text;
- exact model tag;
- Ollama model metadata;
- pre-run runtime state;
- post-run runtime state;
- available Ollama timing and token counters.

The raw response must be preserved before extracting or modifying the model
answer.

## 9. Valid-run checks

A measured run is valid only if:

1. the HTTP/API request completes without transport or server error;
2. the returned object reports `done: true`;
3. the response contains a usable model answer;
4. generation did not terminate because the configured token limit truncated
   the required answer;
5. the raw response is preserved;
6. request and response can be unambiguously associated with the exact model
   tag.

If `done` is false, the run is anomalous and must not be scored as a normal
completed result.

If `done_reason` indicates that output was cut by the generation limit, the
run must be recorded as truncated and must not silently be treated as a
complete answer.

An HTTP 200 response alone does not establish that the benchmark generation
is valid.

## 10. Rerun policy

The first measured result is never deleted or silently replaced.

If a rerun is required because of:

- runtime failure;
- malformed/incomplete API result;
- interrupted execution;
- demonstrated procedural error;

the original artefacts must be retained and the rerun reason documented.

A rerun must not be performed merely because the model gave a poor answer.

## 11. Patch handling

The model answer must first be archived unchanged.

The FINDINGS and PATCH sections may then be extracted mechanically.

No human correction may be made to the proposed patch before evaluation.

If the returned diff is syntactically unusable, that fact forms part of the
model result.

The evaluator must not reconstruct the model's intended patch manually.

## 12. Evaluation workspace

A fresh temporary workspace must be prepared for each model.

It must contain:

- a clean copy of frozen buggy-v1.js;
- the frozen hidden test suite;
- only the files required for deterministic evaluation.

The model patch is applied only inside that workspace.

Frozen benchmark source artefacts must never be modified during model
evaluation.

## 13. Functional evaluation

After patch application:

1. verify that the resulting JavaScript is syntactically valid;
2. execute the complete frozen hidden suite;
3. record pass/fail counts and complete test output;
4. compare the resulting patch with the seeded defect registry for diagnosis
   scoring;
5. inspect unrelated changes for patch-discipline scoring.

No failing hidden test may be removed, disabled or changed for a model.

## 14. Performance metadata

Where Ollama provides them, record:

- total_duration;
- load_duration;
- prompt_eval_count;
- prompt_eval_duration;
- eval_count;
- eval_duration;
- done;
- done_reason.

Performance values are reported separately from correctness.

Tokens per second may be derived deterministically from Ollama counters, but
must not be used as a substitute for functional quality.

## 15. Comparison rule

Only model runs performed under this frozen procedure, frozen prompt,
frozen source baseline, frozen hidden tests and Ollama 0.34.4 are directly
comparable within bugfix-v1.

Any material procedural change requires documentation and, where it affects
comparability, a new benchmark version.
