"use strict";

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateStock(stock) {
  if (stock === null || typeof stock !== "object" || Array.isArray(stock)) {
    throw new Error("stock must be an object");
  }

  for (const [sku, quantity] of Object.entries(stock)) {
    if (sku.length === 0 || !isNonNegativeInteger(quantity)) {
      throw new Error("invalid stock data");
    }
  }
}

function validateLine(line) {
  if (line === null || typeof line !== "object" || Array.isArray(line)) {
    throw new Error("invalid order line");
  }

  if (typeof line.sku !== "string" || line.sku.length === 0) {
    throw new Error("invalid sku");
  }

  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new Error("invalid quantity");
  }

  if (!isNonNegativeInteger(line.unitPricePence)) {
    throw new Error("invalid unit price");
  }

  if (!isNonNegativeInteger(line.unitWeightGrams)) {
    throw new Error("invalid unit weight");
  }
}

function validateLines(lines) {
  if (!Array.isArray(lines)) {
    throw new Error("lines must be an array");
  }

  for (const line of lines) {
    validateLine(line);
  }
}

function reserveInventory(stock, lines) {
  validateStock(stock);
  validateLines(lines);

  const initialStock = { ...stock };

  for (const line of lines) {
    const available = Object.prototype.hasOwnProperty.call(initialStock, line.sku)
      ? initialStock[line.sku]
      : 0;

    if (line.quantity > available) {
      throw new Error(`insufficient stock for ${line.sku}`);
    }
  }

  const remaining = stock;

  for (const line of lines) {
    remaining[line.sku] -= line.quantity;
  }

  return remaining;
}

function calculateOrderTotal(lines, discountPercent) {
  validateLines(lines);

  if (
    !Number.isInteger(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 50
  ) {
    throw new Error("invalid discount percentage");
  }

  let merchandiseSubtotalPence = 0;
  let discountPence = 0;

  for (const line of lines) {
    const lineSubtotalPence =
      line.quantity * line.unitPricePence;

    merchandiseSubtotalPence += lineSubtotalPence;

    discountPence += Math.round(
      lineSubtotalPence * discountPercent / 100
    );
  }

  const discountedSubtotalPence =
    merchandiseSubtotalPence - discountPence;

  const shippingPence =
    discountedSubtotalPence > 5000 ? 0 : 499;

  return {
    merchandiseSubtotalPence,
    discountPence,
    shippingPence,
    totalPence: discountedSubtotalPence + shippingPence
  };
}

function validateDispatchOrder(order) {
  if (order === null || typeof order !== "object" || Array.isArray(order)) {
    throw new Error("invalid dispatch order");
  }

  if (typeof order.id !== "string" || order.id.length === 0) {
    throw new Error("invalid order id");
  }

  if (!isNonNegativeInteger(order.weightGrams)) {
    throw new Error("invalid order weight");
  }
}

function selectDispatchBatch(orders, maxWeightGrams) {
  if (!Array.isArray(orders)) {
    throw new Error("orders must be an array");
  }

  if (!isNonNegativeInteger(maxWeightGrams)) {
    throw new Error("invalid maximum weight");
  }

  for (const order of orders) {
    validateDispatchOrder(order);
  }

  const selected = [];
  let currentWeight = 0;

  for (const order of orders) {
    if (currentWeight + order.weightGrams < maxWeightGrams) {
      selected.push(order);
      currentWeight += order.weightGrams;
    } else {
      break;
    }
  }

  return selected;
}

module.exports = {
  reserveInventory,
  calculateOrderTotal,
  selectDispatchBatch
};
