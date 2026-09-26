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

  const requested = new Map();

  for (const line of lines) {
    requested.set(
      line.sku,
      (requested.get(line.sku) || 0) + line.quantity
    );
  }

  for (const [sku, quantity] of requested) {
    const available = Object.prototype.hasOwnProperty.call(stock, sku)
      ? stock[sku]
      : 0;

    if (quantity > available) {
      throw new Error(`insufficient stock for ${sku}`);
    }
  }

  const remaining = { ...stock };

  for (const [sku, quantity] of requested) {
    remaining[sku] -= quantity;
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

  for (const line of lines) {
    merchandiseSubtotalPence += line.quantity * line.unitPricePence;
  }

  const discountPence = Math.round(
    merchandiseSubtotalPence * discountPercent / 100
  );

  const discountedSubtotalPence =
    merchandiseSubtotalPence - discountPence;

  const shippingPence =
    discountedSubtotalPence < 5000 ? 499 : 0;

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
    if (currentWeight + order.weightGrams <= maxWeightGrams) {
      selected.push(order);
      currentWeight += order.weightGrams;
    }
  }

  return selected;
}

module.exports = {
  reserveInventory,
  calculateOrderTotal,
  selectDispatchBatch
};
