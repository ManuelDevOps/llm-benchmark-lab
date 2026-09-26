# bugfix-v1 - Functional Specification

Version: 1.0
Status: FROZEN once hashed
Project: fulfilment-core

## 1. Purpose

fulfilment-core is a small JavaScript module used by an order fulfilment
system.

It performs three operations:

1. reserve inventory for an order;
2. calculate the payable order total;
3. select orders that can be packed into a dispatch batch.

All monetary values are represented as integer pence.
All weights are represented as integer grams.

No function requires network access or external packages.

## 2. Inventory representation

Inventory is represented by a plain JavaScript object.

Example:

{
  "SKU-A": 10,
  "SKU-B": 4
}

Keys are exact, case-sensitive SKU identifiers.

Values are non-negative integer quantities.

## 3. Order-line representation

An order line has this form:

{
  sku: "SKU-A",
  quantity: 2,
  unitPricePence: 1250,
  unitWeightGrams: 300
}

Requirements:

- sku must be a non-empty string;
- quantity must be a positive integer;
- unitPricePence must be a non-negative integer;
- unitWeightGrams must be a non-negative integer.

## 4. reserveInventory(stock, lines)

The function receives an inventory object and an array of order lines.

It must return a new inventory object representing the stock remaining
after the reservation.

### Required behaviour

The input stock object must never be modified.

If the same SKU appears in more than one order line, the quantities for
that SKU must be combined before availability is evaluated.

Example:

stock:
{
  "SKU-A": 5
}

lines:
[
  { sku: "SKU-A", quantity: 3, ... },
  { sku: "SKU-A", quantity: 2, ... }
]

is valid and leaves zero units.

If the combined requested quantity exceeds available stock, the
reservation must fail.

An unknown SKU has zero available units and therefore cannot satisfy a
positive reservation.

The operation is atomic.

If any line is invalid or any SKU has insufficient stock:

- an Error must be thrown;
- no partial reservation may occur;
- the supplied stock object must remain unchanged.

If the reservation succeeds, SKUs not requested by the order retain
their existing quantities.

## 5. calculateOrderTotal(lines, discountPercent)

The function calculates the amount payable before any external taxes or
payment-processing charges.

### Merchandise subtotal

For each line:

line total = quantity * unitPricePence

The merchandise subtotal is the sum of all line totals.

### Discount

discountPercent must be an integer from 0 through 50 inclusive.

A value of 0 is valid and means no discount.

The discount is calculated from the complete merchandise subtotal, not
independently per line.

discount =
Math.round(merchandiseSubtotal * discountPercent / 100)

discounted subtotal =
merchandiseSubtotal - discount

### Shipping

Shipping costs 499 pence when the discounted merchandise subtotal is
less than 5000 pence.

Shipping is free when the discounted merchandise subtotal is exactly
5000 pence or greater.

### Result

The function returns:

{
  merchandiseSubtotalPence: <integer>,
  discountPence: <integer>,
  shippingPence: <integer>,
  totalPence: <integer>
}

where:

totalPence =
discounted merchandise subtotal + shipping

The input lines array and its objects must not be modified.

Invalid order-line data or an invalid discountPercent must cause an
Error.

## 6. selectDispatchBatch(orders, maxWeightGrams)

Each order has this form:

{
  id: "ORDER-001",
  weightGrams: 1200
}

Requirements:

- id must be a non-empty string;
- weightGrams must be a non-negative integer;
- maxWeightGrams must be a non-negative integer.

The function examines orders in their existing array order.

An order is added to the batch when adding it would not cause the
cumulative batch weight to exceed maxWeightGrams.

If an order does not fit, it is skipped and evaluation continues with
later orders.

Example:

orders:
[
  { id: "A", weightGrams: 700 },
  { id: "B", weightGrams: 500 },
  { id: "C", weightGrams: 200 }
]

maxWeightGrams: 1000

result:
[
  { id: "A", weightGrams: 700 },
  { id: "C", weightGrams: 200 }
]

The result preserves the original relative order of selected orders.

An order whose addition makes the cumulative weight exactly equal to
maxWeightGrams must be included.

The input orders array and its objects must not be modified.

Invalid input must cause an Error.

## 7. General constraints

The implementation must:

- use standard JavaScript compatible with the installed Node.js runtime;
- require no external dependencies;
- avoid network access;
- preserve the public function names and return structures described
  above;
- avoid dependence on locale, current date, environment variables or
  nondeterministic data.

Correct behaviour is defined by this specification, not by the
implementation used in either the buggy or reference version.
