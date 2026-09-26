# bugfix-v1 - Benchmark Contract

Version: 1.0
Status: FROZEN once created
Benchmark family: local-llm-coding
Experiment: bugfix-v1

## 1. Objective

Measure the ability of local language models to inspect an existing
software project containing realistic defects, diagnose those defects,
explain their practical impact, and produce minimal corrective patches
without unnecessary rewrites or regressions.

This benchmark is independent from cart-total-v1.

## 2. Experimental principle

All compared models receive exactly the same:

- project source code
- task instructions
- file ordering
- available context
- generation parameters
- hidden-test suite
- evaluation procedure

No model receives hidden tests, expected solutions, bug locations,
bug count, reference patches, or results from another model.

## 3. Runtime

Host:
- Windows 11
- NVIDIA RTX 5070 Ti 16 GB
- Ollama

API:
- endpoint: /api/generate
- stream: false
- native model template
- raw: false / not enabled

Generation options:
- num_ctx: 32768
- temperature: 0
- seed: 42
- num_predict: 4096
- keep_alive: 0

No explicit think=true or think=false parameter will be supplied.

## 4. Cold-run policy

Each measured model execution must begin from the defined cold state.

The model must not remain intentionally loaded between benchmark runs.

The runtime state will be checked before the measured request.

No warm-up generation may use the benchmark prompt.

## 5. Valid-run requirements

A model result is valid only when:

1. the request completes normally;
2. the server reports normal completion;
3. the response is not truncated by the configured generation limit;
4. no runtime/API error occurred;
5. the complete raw response is preserved;
6. the exact request and response can be associated with the tested model.

An anomalous or incomplete response must be recorded as such and must
not silently be treated as a successful benchmark result.

No rerun may replace a failed first measured result without preserving
and documenting the original result and the reason for the rerun.

## 6. Benchmark implementation constraints

The benchmark project will use JavaScript runnable with the already
installed Node.js environment.

No additional package, framework, runtime, extension, compiler, test
framework, or external service will be installed solely for bugfix-v1
unless a later requirement demonstrates that it is necessary.

Tests should preferentially use Node.js built-in capabilities.

The benchmark source project will be created specifically for
bugfix-v1 and will not be copied from cart-total-v1.

## 7. Defect design

The project will contain a fixed set of intentionally introduced,
realistic software defects.

Defects must:

- represent plausible programming mistakes;
- have observable behavioural consequences;
- be objectively testable where practical;
- require inspection/reasoning rather than syntax repair alone;
- include more than one class of defect;
- avoid dependencies on external network services;
- avoid ambiguous requirements where two incompatible behaviours
  could both reasonably be considered correct.

The exact defect registry and expected fixes will be frozen before any
model is evaluated.

The model prompt will not reveal the defect count or defect locations.

## 8. Model task

Each model will be asked to:

1. inspect the supplied existing project;
2. identify defects;
3. explain the cause and practical impact of each identified defect;
4. assign an impact/severity assessment where justified;
5. correct the defects;
6. preserve existing intended behaviour;
7. avoid unnecessary refactoring or rewriting.

The model is not rewarded for replacing working code merely with a
different implementation.

## 9. Output requirements

Each model must return:

### FINDINGS

A concise list of diagnosed defects containing, when identifiable:

- file/location
- defect
- cause
- impact
- severity rationale

### PATCH

A patch representing the proposed code changes.

The required patch representation will be fixed before model execution
and will be identical for every tested model.

No evaluator may improve a model's proposed code before testing it.

## 10. Evaluation layers

Evaluation will separate at least:

A. Functional repair
   Hidden tests directly associated with the seeded defects.

B. Regression behaviour
   Tests for behaviour that was already correct before repair.

C. Diagnosis quality
   Whether the model correctly identified the underlying seeded
   defects rather than merely changing symptoms.

D. Patch discipline
   Whether changes are targeted and whether unrelated working code was
   unnecessarily modified or rewritten.

E. Execution validity
   Whether the response and patch are complete and usable under the
   frozen protocol.

F. Performance metadata
   Generation duration and available Ollama evaluation metrics will be
   recorded separately from correctness.

No single speed metric will be treated as a quality score.

## 11. Hidden evaluation

Hidden tests, the defect registry, and reference behaviour must remain
outside every model prompt.

They must be identical for all models.

Tests and scoring rules must be frozen before the first evaluated model
is run.

The hidden suite must first be executed against the intentionally buggy
baseline so that the benchmark is known to expose the intended defects.

It must also be executed against the reference-corrected version before
model evaluation begins.

## 12. Reproducibility

For every evaluated model preserve:

- exact Ollama model name/tag
- model metadata available from Ollama
- exact benchmark prompt
- exact API request JSON
- raw API response JSON
- extracted model answer
- proposed patch
- test results
- timing/evaluation metadata
- relevant runtime state
- SHA-256 hashes of frozen benchmark artefacts

Artefacts must not be modified after hashing without creating a new
version and documenting the change.

## 13. Comparability

Results from bugfix-v1 may be compared between models tested under this
contract.

bugfix-v1 scores must not be merged directly with cart-total-v1 scores,
because they measure different coding capabilities.

Cross-benchmark discussion may compare patterns, but the benchmark
scores remain separate.

## 14. Change control

After this contract is frozen, any material change to:

- prompt
- source project
- defect set
- hidden tests
- scoring rules
- API endpoint
- generation parameters
- output format
- execution procedure

requires a new benchmark version.

No post-hoc change may be introduced merely because a particular model
performed unexpectedly.
