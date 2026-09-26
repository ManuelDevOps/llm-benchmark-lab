# bugfix-v1 - Hidden Defect Registry

Version: 1.0
Status: FROZEN once hashed
Project: fulfilment-core
Visibility: evaluator-only

This file must never be included in a model prompt.

The benchmark baseline will be derived from reference-v1.js by introducing
exactly the defects defined below and no additional intentional changes.

## BF-01 - Inventory input mutation

Area:
reserveInventory

Defect class:
State mutation / API contract violation

Seeded change:
Use the supplied stock object itself as the reservation result instead of
creating an independent copy.

Intended faulty pattern:

const remaining = stock;

instead of:

const remaining = { ...stock };

Observable consequences:

- a successful reservation modifies the caller's stock object;
- returned state and caller-owned state become the same object;
- the function violates the immutability requirement.

Expected repair:

Create a new inventory object before applying successful deductions.

Primary existing detection:

- reserveInventory does not modify stock or order lines

Severity rationale:

High. Caller-owned inventory can be silently changed outside the expected
state-management boundary.

## BF-02 - Duplicate SKU availability checked independently

Area:
reserveInventory

Defect class:
Aggregation / business-logic error

Seeded change:
Validate availability one order line at a time against the original stock
quantity rather than aggregating quantities for identical SKUs before the
availability decision.

The faulty implementation may therefore accept:

stock SKU-A = 4
request SKU-A = 3
request SKU-A = 2

because each individual line appears valid against four available units.

Observable consequences:

- combined reservations can exceed available inventory;
- resulting stock can become negative;
- duplicate lines are handled incorrectly.

Expected repair:

Aggregate requested quantities by SKU before testing availability and before
applying deductions.

Primary existing detection:

- reserveInventory combines duplicate SKUs before checking availability
- reserveInventory rejects combined duplicate quantity above available stock atomically

Severity rationale:

Critical. The system can confirm reservations for inventory that does not
exist.

## BF-03 - Discount rounded separately per line

Area:
calculateOrderTotal

Defect class:
Financial calculation / rounding error

Seeded change:
Calculate and round each line's discount independently, then add the rounded
discounts together.

Required behaviour instead rounds once from the complete merchandise
subtotal.

Observable consequences:

The payable amount can differ by one or more pence depending on order-line
composition even when the total merchandise subtotal is identical.

Expected repair:

Calculate merchandiseSubtotalPence first, then perform one Math.round call on:

merchandiseSubtotalPence * discountPercent / 100

Primary existing detection:

- calculateOrderTotal rounds discount once from the complete merchandise subtotal

Severity rationale:

Medium. It produces deterministic but incorrect monetary totals.

## BF-04 - Free-shipping boundary excludes exactly 5000 pence

Area:
calculateOrderTotal

Defect class:
Boundary-condition error

Seeded change:
Grant free shipping only when the discounted subtotal is greater than 5000
pence.

Faulty logical boundary:

discountedSubtotalPence > 5000

Required boundary:

discountedSubtotalPence >= 5000

Observable consequences:

An order whose discounted merchandise subtotal is exactly 5000 pence is
incorrectly charged 499 pence shipping.

Expected repair:

Use the inclusive 5000-pence threshold defined by the specification.

Primary existing detection:

- calculateOrderTotal gives free shipping at exactly 5000 pence after discount

Severity rationale:

Medium. A valid customer order is overcharged at an exact commercial
threshold.

## BF-05 - Dispatch selection stops at first order that does not fit

Area:
selectDispatchBatch

Defect class:
Control-flow error

Seeded change:
Stop processing the order list when one order cannot fit within the remaining
weight capacity.

Faulty behaviour:

break

Required behaviour:

skip that order and continue evaluating later orders.

Observable consequences:

Later lightweight orders are excluded even when they would fit.

Expected repair:

Continue iteration after an order fails the capacity test.

Primary existing detection:

- selectDispatchBatch skips an overweight order and continues with later orders

Severity rationale:

Medium. Dispatch capacity is unnecessarily wasted and valid later orders are
not selected.

## BF-06 - Exact dispatch weight rejected

Area:
selectDispatchBatch

Defect class:
Boundary-condition error

Seeded change:
Accept an order only when its addition keeps cumulative weight strictly below
maxWeightGrams.

Faulty comparison:

currentWeight + order.weightGrams < maxWeightGrams

Required comparison:

currentWeight + order.weightGrams <= maxWeightGrams

Observable consequences:

- an order that exactly fills the batch capacity is rejected;
- zero-weight orders are rejected when maximum capacity is zero.

Expected repair:

Use the inclusive maximum-weight boundary.

Primary existing detection:

- selectDispatchBatch includes an order that exactly reaches the weight limit
- selectDispatchBatch supports zero capacity and zero-weight orders

Severity rationale:

Medium. Valid orders are excluded at an explicit boundary condition.

## Registry constraints

The seeded baseline must contain exactly BF-01 through BF-06.

No additional intentional defect may be added.

Formatting changes unrelated to these defects should be avoided.

The public function names and CommonJS exports must remain unchanged.

The baseline must remain syntactically valid JavaScript.

Before any model is evaluated:

1. the reference implementation must pass the frozen hidden suite;
2. the seeded buggy baseline must fail tests that expose the registered
   defects;
3. each registered defect must be demonstrably observable;
4. the baseline and this registry must be hashed and frozen.

If any registered defect is not exposed by the frozen tests, the benchmark
must not proceed to model evaluation until the benchmark versioning procedure
is reconsidered.
