# bugfix-v1 - Baseline Validation Record

Version: 1.0
Project: fulfilment-core

## Frozen artefact

buggy-v1.js

SHA-256:
029B8C714C10AA19D8F4C0D89FA5BD7215D1E384EEA14FB91E16B0A8C9DCDE7F

## Hidden test suite

hidden-tests-v1.test.js

SHA-256:
B633D2797B387B53C020A76EB92FBC9AA27B50F7820D60021051AAC30B5741AB

## Execution result

Runtime:
Node.js built-in test runner

Tests:
19

Passed:
11

Failed:
8

Cancelled:
0

Skipped:
0

Todo:
0

Observed duration:
70.0005 ms

## Registered defects exposed

BF-01:
Exposed by stock immutability failure.

BF-02:
Exposed by failure to reject aggregate duplicate-SKU demand above available stock.

BF-03:
Exposed by incorrect per-line discount rounding.

BF-04:
Exposed by incorrect shipping charge at exactly 5000 pence discounted subtotal.

BF-05:
Exposed by premature termination of dispatch selection after an order does not fit.

BF-06:
Exposed by rejection of orders that exactly reach maxWeightGrams and by zero-capacity/zero-weight behaviour.

## Validation conclusion

The intentionally defective baseline is syntactically valid.

The frozen hidden suite exposes every defect BF-01 through BF-06.

All observed failing tests are attributable to the registered seeded defects.

The benchmark baseline is therefore suitable for use in bugfix-v1 model evaluation, subject to the remaining prompt, patch-format, scoring and execution-procedure freeze steps.
