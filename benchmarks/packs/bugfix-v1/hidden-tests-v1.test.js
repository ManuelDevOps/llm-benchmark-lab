"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  reserveInventory,
  calculateOrderTotal,
  selectDispatchBatch
} = require("./reference-v1.js");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function line(
  sku,
  quantity,
  unitPricePence = 1000,
  unitWeightGrams = 100
) {
  return {
    sku,
    quantity,
    unitPricePence,
    unitWeightGrams
  };
}

/* ------------------------------------------------------------------ */
/* reserveInventory                                                    */
/* ------------------------------------------------------------------ */

test("reserveInventory subtracts requested stock and preserves unrelated SKUs", () => {
  const stock = {
    "SKU-A": 5,
    "SKU-B": 4,
    "SKU-C": 9
  };

  const lines = [
    line("SKU-A", 2),
    line("SKU-B", 1)
  ];

  assert.deepStrictEqual(
    reserveInventory(stock, lines),
    {
      "SKU-A": 3,
      "SKU-B": 3,
      "SKU-C": 9
    }
  );
});

test("reserveInventory does not modify stock or order lines", () => {
  const stock = {
    "SKU-A": 5,
    "SKU-B": 2
  };

  const lines = [
    line("SKU-A", 2, 1250, 300)
  ];

  const stockBefore = clone(stock);
  const linesBefore = clone(lines);

  reserveInventory(stock, lines);

  assert.deepStrictEqual(stock, stockBefore);
  assert.deepStrictEqual(lines, linesBefore);
});

test("reserveInventory combines duplicate SKUs before checking availability", () => {
  const stock = {
    "SKU-A": 5
  };

  const lines = [
    line("SKU-A", 3),
    line("SKU-A", 2)
  ];

  assert.deepStrictEqual(
    reserveInventory(stock, lines),
    {
      "SKU-A": 0
    }
  );
});

test("reserveInventory rejects combined duplicate quantity above available stock atomically", () => {
  const stock = {
    "SKU-A": 4,
    "SKU-B": 7
  };

  const stockBefore = clone(stock);

  const lines = [
    line("SKU-B", 2),
    line("SKU-A", 3),
    line("SKU-A", 2)
  ];

  assert.throws(
    () => reserveInventory(stock, lines),
    Error
  );

  assert.deepStrictEqual(stock, stockBefore);
});

test("reserveInventory rejects an unknown SKU and leaves stock unchanged", () => {
  const stock = {
    "SKU-A": 5
  };

  const stockBefore = clone(stock);

  assert.throws(
    () => reserveInventory(
      stock,
      [line("SKU-X", 1)]
    ),
    Error
  );

  assert.deepStrictEqual(stock, stockBefore);
});

test("reserveInventory rejects invalid order-line data", () => {
  const stock = {
    "SKU-A": 5
  };

  assert.throws(
    () => reserveInventory(
      stock,
      [line("SKU-A", 0)]
    ),
    Error
  );
});

/* ------------------------------------------------------------------ */
/* calculateOrderTotal                                                 */
/* ------------------------------------------------------------------ */

test("calculateOrderTotal calculates subtotal, discount, shipping and total", () => {
  const lines = [
    line("SKU-A", 2, 1200, 100),
    line("SKU-B", 1, 600, 100)
  ];

  const before = clone(lines);

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 10),
    {
      merchandiseSubtotalPence: 3000,
      discountPence: 300,
      shippingPence: 499,
      totalPence: 3199
    }
  );

  assert.deepStrictEqual(lines, before);
});

test("calculateOrderTotal rounds discount once from the complete merchandise subtotal", () => {
  const lines = [
    line("SKU-A", 1, 101, 0),
    line("SKU-B", 1, 101, 0)
  ];

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 50),
    {
      merchandiseSubtotalPence: 202,
      discountPence: 101,
      shippingPence: 499,
      totalPence: 600
    }
  );
});

test("calculateOrderTotal gives free shipping at exactly 5000 pence after discount", () => {
  const lines = [
    line("SKU-A", 1, 6250, 0)
  ];

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 20),
    {
      merchandiseSubtotalPence: 6250,
      discountPence: 1250,
      shippingPence: 0,
      totalPence: 5000
    }
  );
});

test("calculateOrderTotal charges shipping below 5000 pence after discount", () => {
  const lines = [
    line("SKU-A", 1, 6249, 0)
  ];

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 20),
    {
      merchandiseSubtotalPence: 6249,
      discountPence: 1250,
      shippingPence: 499,
      totalPence: 5498
    }
  );
});

test("calculateOrderTotal accepts both discount boundaries", () => {
  const lines = [
    line("SKU-A", 1, 10000, 0)
  ];

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 0),
    {
      merchandiseSubtotalPence: 10000,
      discountPence: 0,
      shippingPence: 0,
      totalPence: 10000
    }
  );

  assert.deepStrictEqual(
    calculateOrderTotal(lines, 50),
    {
      merchandiseSubtotalPence: 10000,
      discountPence: 5000,
      shippingPence: 0,
      totalPence: 5000
    }
  );
});

test("calculateOrderTotal rejects discount percentages outside the allowed range", () => {
  const lines = [
    line("SKU-A", 1, 1000, 0)
  ];

  assert.throws(
    () => calculateOrderTotal(lines, -1),
    Error
  );

  assert.throws(
    () => calculateOrderTotal(lines, 51),
    Error
  );

  assert.throws(
    () => calculateOrderTotal(lines, 2.5),
    Error
  );
});

test("calculateOrderTotal rejects invalid order-line data", () => {
  assert.throws(
    () => calculateOrderTotal(
      [line("SKU-A", -1, 1000, 100)],
      10
    ),
    Error
  );
});

/* ------------------------------------------------------------------ */
/* selectDispatchBatch                                                 */
/* ------------------------------------------------------------------ */

test("selectDispatchBatch skips an overweight order and continues with later orders", () => {
  const orders = [
    { id: "A", weightGrams: 700 },
    { id: "B", weightGrams: 500 },
    { id: "C", weightGrams: 200 }
  ];

  assert.deepStrictEqual(
    selectDispatchBatch(orders, 1000),
    [
      { id: "A", weightGrams: 700 },
      { id: "C", weightGrams: 200 }
    ]
  );
});

test("selectDispatchBatch includes an order that exactly reaches the weight limit", () => {
  const orders = [
    { id: "A", weightGrams: 700 },
    { id: "B", weightGrams: 300 },
    { id: "C", weightGrams: 1 }
  ];

  assert.deepStrictEqual(
    selectDispatchBatch(orders, 1000),
    [
      { id: "A", weightGrams: 700 },
      { id: "B", weightGrams: 300 }
    ]
  );
});

test("selectDispatchBatch supports zero capacity and zero-weight orders", () => {
  const orders = [
    { id: "A", weightGrams: 0 },
    { id: "B", weightGrams: 1 },
    { id: "C", weightGrams: 0 }
  ];

  assert.deepStrictEqual(
    selectDispatchBatch(orders, 0),
    [
      { id: "A", weightGrams: 0 },
      { id: "C", weightGrams: 0 }
    ]
  );
});

test("selectDispatchBatch does not modify its input array or order objects", () => {
  const orders = [
    { id: "A", weightGrams: 400 },
    { id: "B", weightGrams: 700 },
    { id: "C", weightGrams: 300 }
  ];

  const before = clone(orders);

  selectDispatchBatch(orders, 800);

  assert.deepStrictEqual(orders, before);
});

test("selectDispatchBatch rejects invalid orders even when they occur later in the array", () => {
  const orders = [
    { id: "A", weightGrams: 100 },
    { id: "", weightGrams: 200 }
  ];

  assert.throws(
    () => selectDispatchBatch(orders, 1000),
    Error
  );
});

test("selectDispatchBatch rejects an invalid maximum weight", () => {
  const orders = [
    { id: "A", weightGrams: 100 }
  ];

  assert.throws(
    () => selectDispatchBatch(orders, -1),
    Error
  );

  assert.throws(
    () => selectDispatchBatch(orders, 100.5),
    Error
  );
});
