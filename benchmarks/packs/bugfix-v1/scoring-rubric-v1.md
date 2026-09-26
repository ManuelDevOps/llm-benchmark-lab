# bugfix-v1 - Scoring Rubric

Version: 1.0
Status: FROZEN once hashed
Benchmark: bugfix-v1
Maximum score: 100 points

## 1. Governing principle

This rubric is derived from the frozen benchmark contract, functional
specification, defect registry, buggy baseline and hidden test suite.

It must be frozen before the first official scored model run.

No score may be adjusted because a particular model performs unexpectedly.

A model is evaluated only on the artefacts it actually returns.

No human repair, reconstruction, completion or reinterpretation of a proposed
patch is permitted before functional testing.

## 2. Score structure

A. Functional repair:          48 points
B. Regression preservation:    12 points
C. Diagnosis quality:          18 points
D. Patch discipline:           12 points
E. Output usability/compliance:10 points

TOTAL:                        100 points

Performance metadata such as tokens/s and generation duration are reported
separately and do not contribute to this score.

## 3. Run eligibility

A run may receive an official score only if the generation itself satisfies
the frozen execution procedure, including:

- successful API completion;
- done = true;
- no transport/server failure affecting the result;
- no demonstrated truncation of the required answer;
- preserved raw response and model identity.

A procedural or runtime failure before a valid model answer exists is not
scored as model performance.

Once a valid official model answer has been produced, malformed output,
incorrect findings, an unusable patch or failing tests are model results and
do not justify a rerun.

## 4. A - Functional repair: 48 points

The intentionally buggy baseline has eight hidden-test failures attributable
to the six registered defects.

Each registered defect is worth 8 points.

### BF-01 - 8 points

Test:

reserveInventory does not modify stock or order lines

Scoring:

- pass after model patch: 8
- fail or patch cannot be evaluated: 0

### BF-02 - 8 points

Test:

reserveInventory rejects combined duplicate quantity above available stock
atomically

Scoring:

- pass after model patch: 8
- fail or patch cannot be evaluated: 0

### BF-03 - 8 points

Test:

calculateOrderTotal rounds discount once from the complete merchandise
subtotal

Scoring:

- pass after model patch: 8
- fail or patch cannot be evaluated: 0

### BF-04 - 8 points

Tests:

1. calculateOrderTotal gives free shipping at exactly 5000 pence after
   discount
2. calculateOrderTotal accepts both discount boundaries

Scoring:

- 4 points for each passing test
- maximum: 8
- patch cannot be evaluated: 0

### BF-05 - 8 points

Test:

selectDispatchBatch skips an overweight order and continues with later orders

Scoring:

- pass after model patch: 8
- fail or patch cannot be evaluated: 0

### BF-06 - 8 points

Tests:

1. selectDispatchBatch includes an order that exactly reaches the weight limit
2. selectDispatchBatch supports zero capacity and zero-weight orders

Scoring:

- 4 points for each passing test
- maximum: 8
- patch cannot be evaluated: 0

Functional-repair points are based on actual hidden-test execution, not on
what the model claims to have fixed.

## 5. B - Regression preservation: 12 points

The following eleven tests pass on the frozen buggy baseline and therefore
represent behaviour that must not regress.

Each test that remains passing after applying the model patch earns 1 point:

1. reserveInventory subtracts requested stock and preserves unrelated SKUs
2. reserveInventory combines duplicate SKUs before checking availability
3. reserveInventory rejects an unknown SKU and leaves stock unchanged
4. reserveInventory rejects invalid order-line data
5. calculateOrderTotal calculates subtotal, discount, shipping and total
6. calculateOrderTotal charges shipping below 5000 pence after discount
7. calculateOrderTotal rejects discount percentages outside the allowed range
8. calculateOrderTotal rejects invalid order-line data
9. selectDispatchBatch does not modify its input array or order objects
10. selectDispatchBatch rejects invalid orders even when they occur later in
    the array
11. selectDispatchBatch rejects an invalid maximum weight

Subtotal:
0-11 points

Preservation bonus:

- all eleven baseline-passing tests remain passing: +1 point
- otherwise: +0

Maximum:
12 points

If the model patch cannot be applied and therefore no patched implementation
can be tested, this section receives 0 points.

## 6. C - Diagnosis quality: 18 points

Each registered defect BF-01 through BF-06 is worth up to 3 diagnosis points.

For each defect:

### Identification/location - 1 point

Award 1 point when the finding clearly identifies the affected function or
code area and distinguishes the actual defect.

Otherwise:
0 points.

### Cause - 1 point

Award 1 point when the model correctly explains the underlying mechanism
causing the defect.

A description of only the visible symptom is insufficient.

Otherwise:
0 points.

### Impact and severity rationale - 1 point

Award:

- 0.5 points when the practical consequence is substantially correct;
- 0.5 points when the severity assessment and rationale are proportionate to
  the defect described in the frozen registry.

Maximum per defect:
3 points

Maximum diagnosis score:
18 points

Rules:

- duplicated wording does not earn duplicate credit;
- one finding may cover more than one defect only when it clearly explains
  each distinct mechanism;
- a hallucinated defect earns no diagnosis points;
- diagnosis points do not require the proposed patch to be correct;
- incorrect statements within a finding prevent credit for the affected
  criterion when they materially contradict the specification.

## 7. D - Patch discipline: 12 points

This section evaluates the proposed changes independently of the hidden-test
score where possible.

### D1 - Minimal change surface: 4 points

4:
Changes are tightly limited to code needed to address identified defects.

3:
Minor unnecessary edits with no meaningful architectural or behavioural
expansion.

1-2:
Noticeable unrelated refactoring, duplication or unnecessary change surface.

0:
Broad rewrite or extensive unrelated modification.

### D2 - Contract preservation: 4 points

4:
Preserves public function names, CommonJS exports, dependency constraints and
specified interfaces.

2-3:
Minor contract-risking changes that do not replace the public architecture.

1:
Material unnecessary interface or dependency changes.

0:
Breaks or replaces the required public contract.

### D3 - Repair integrity: 4 points

4:
Repairs underlying logic without disabling validation, bypassing requirements,
hard-coding benchmark examples, altering tests, or introducing benchmark-
specific special cases.

2-3:
Mostly legitimate repair with limited questionable or redundant logic.

1:
Substantial workaround behaviour rather than repairing the underlying defect.

0:
Attempts to evade evaluation, modify tests, hard-code hidden behaviour, or
otherwise circumvent the specification.

If a patch is malformed, D may still be scored from its visible proposed
changes where the evidence is unambiguous. No missing intent may be inferred.

## 8. E - Output usability and compliance: 10 points

### E1 - Verbatim patch applicability: 4 points

4:
`git apply --check` accepts the model's patch exactly as returned.

0:
The patch is absent, corrupt or requires human repair/reconstruction.

No intermediate score is awarded.

### E2 - Exact section markers: 2 points

2:
The response contains exactly the required markers:

=== FINDINGS ===
=== PATCH ===

in the required order.

1:
Both sections are clearly present but one or both marker strings differ.

0:
A required section is absent or cannot be identified mechanically.

### E3 - Required diff headers: 1 point

1:
The patch contains exactly:

--- a/buggy-v1.js
+++ b/buggy-v1.js

0:
Otherwise.

### E4 - No prohibited Markdown patch fence: 1 point

1:
The patch is returned without Markdown code fences.

0:
A Markdown code fence surrounds or contaminates the patch.

### E5 - Mechanical extractability: 2 points

2:
The frozen extraction procedure can separate FINDINGS and PATCH without
heuristics or manual editing.

1:
The two components are identifiable mechanically only through a documented
generic fallback rule that does not repair model content.

0:
Manual interpretation, reconstruction or content repair is required.

Maximum:
10 points

## 9. Unusable-patch rule

If the model generation is valid but its patch cannot be applied verbatim:

- A Functional repair = 0
- B Regression preservation = 0
- C Diagnosis quality is still scored
- D Patch discipline may be scored from visible evidence
- E Output usability/compliance is scored normally

The evaluator must not create a repaired version merely to estimate what the
model might have achieved.

## 10. Syntax-failure rule

If the patch applies but the resulting JavaScript fails syntax validation:

- hidden tests are executed only if the test runner can meaningfully execute
  them;
- otherwise A = 0 and B = 0;
- C, D and E remain independently scoreable.

The syntax failure itself must be recorded.

## 11. Hidden-test rule

All functional and regression points come from the frozen hidden suite.

No hidden test may be:

- edited;
- removed;
- skipped;
- reordered for a particular model;
- interpreted differently between models.

The same evaluation workspace procedure applies to every official model run.

## 12. Diagnosis adjudication record

Diagnosis scoring must be recorded defect by defect:

BF-01:
identification/location =
cause =
impact =
severity/rationale =

BF-02:
identification/location =
cause =
impact =
severity/rationale =

BF-03:
identification/location =
cause =
impact =
severity/rationale =

BF-04:
identification/location =
cause =
impact =
severity/rationale =

BF-05:
identification/location =
cause =
impact =
severity/rationale =

BF-06:
identification/location =
cause =
impact =
severity/rationale =

Any non-zero diagnosis award must be supported by text present in the frozen
model answer.

## 13. Final score

Official bugfix-v1 score:

Functional repair       /48
Regression preservation /12
Diagnosis quality       /18
Patch discipline        /12
Output usability        /10

TOTAL                    /100

The numerical score must always be accompanied by the component scores and
raw hidden-test result.

No score may be merged numerically with cart-total-v1 because the two
benchmarks measure different capabilities.
