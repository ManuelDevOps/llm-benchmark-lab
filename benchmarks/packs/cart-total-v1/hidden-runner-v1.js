'use strict';

const path = require('node:path');

const implementationPath = process.argv[2];

if (!implementationPath) {
  console.error('Usage: node hidden-runner-v1.js <implementation.js>');
  process.exit(2);
}

const resolvedPath = path.resolve(implementationPath);

let loaded;
try {
  loaded = require(resolvedPath);
} catch (error) {
  console.error('IMPLEMENTATION_LOAD_ERROR');
  console.error(error);
  process.exit(2);
}

const calculateCartTotal =
  typeof loaded === 'function'
    ? loaded
    : loaded && loaded.calculateCartTotal;

if (typeof calculateCartTotal !== 'function') {
  console.error(
    'EXPORT_ERROR: implementation must export calculateCartTotal'
  );
  process.exit(2);
}

const results = [];

function addResult(id, category, passed, detail) {
  results.push({
    id,
    category,
    passed,
    detail
  });
}

function monetaryValueMatches(actual, expected) {
  if (typeof actual !== 'number' && typeof actual !== 'string') {
    return false;
  }

  if (typeof actual === 'string' && actual.trim() === '') {
    return false;
  }

  const numeric = Number(actual);

  return (
    Number.isFinite(numeric) &&
    Math.abs(numeric - expected) < 1e-9
  );
}

function runValueTest(id, expected, fn) {
  try {
    const actual = fn();
    const passed = monetaryValueMatches(actual, expected);

    addResult(
      id,
      'A',
      passed,
      passed
        ? `returned ${JSON.stringify(actual)}`
        : `expected monetary value ${expected}, got ${JSON.stringify(actual)}`
    );
  } catch (error) {
    addResult(
      id,
      'A',
      false,
      `unexpected ${error?.name || 'Error'}: ${error?.message || ''}`
    );
  }
}

function runRequiredErrorTest(id, requireMessage, fn) {
  try {
    const actual = fn();

    addResult(
      id,
      'A',
      false,
      `did not throw; returned ${JSON.stringify(actual)}`
    );
  } catch (error) {
    const isError = error instanceof Error;
    const hasMessage =
      typeof error?.message === 'string' &&
      error.message.trim().length > 0;

    const passed =
      isError &&
      (!requireMessage || hasMessage);

    addResult(
      id,
      'A',
      passed,
      `${error?.name || typeof error}: ${error?.message || ''}`
    );
  }
}

function runEngineeringInvalidTest(id, fn) {
  try {
    const actual = fn();

    addResult(
      id,
      'B',
      false,
      `accepted invalid input; returned ${JSON.stringify(actual)}`
    );
  } catch (error) {
    addResult(
      id,
      'B',
      true,
      `${error?.name || typeof error}: ${error?.message || ''}`
    );
  }
}

function observe(id, fn) {
  try {
    const value = fn();

    return {
      id,
      outcome: 'returned',
      value,
      valueType: typeof value
    };
  } catch (error) {
    return {
      id,
      outcome: 'threw',
      errorType: error?.constructor?.name || error?.name || typeof error,
      message: error?.message || ''
    };
  }
}


// ============================================================
// A. REQUISITOS INEQUÍVOCOS
// ============================================================

runValueTest(
  'A01',
  31.50,
  () =>
    calculateCartTotal(
      [
        { unitPrice: 10, quantity: 2 },
        { unitPrice: 5, quantity: 3 }
      ],
      10
    )
);

runValueTest(
  'A02',
  35.00,
  () =>
    calculateCartTotal(
      [
        { unitPrice: 10, quantity: 2 },
        { unitPrice: 5, quantity: 3 }
      ],
      0
    )
);

runValueTest(
  'A03',
  38.38,
  () =>
    calculateCartTotal(
      [
        { unitPrice: 15.99, quantity: 3 }
      ],
      20
    )
);

runRequiredErrorTest(
  'A04',
  true,
  () => calculateCartTotal(null, 10)
);

runRequiredErrorTest(
  'A05',
  true,
  () => calculateCartTotal('not an array', 10)
);

runRequiredErrorTest(
  'A06',
  true,
  () =>
    calculateCartTotal(
      [{ quantity: 1 }],
      10
    )
);

runRequiredErrorTest(
  'A07',
  true,
  () =>
    calculateCartTotal(
      [{ unitPrice: 10 }],
      10
    )
);

runRequiredErrorTest(
  'A08',
  false,
  () =>
    calculateCartTotal(
      [{ unitPrice: '10', quantity: 1 }],
      10
    )
);

runRequiredErrorTest(
  'A09',
  false,
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: '2' }],
      10
    )
);

runRequiredErrorTest(
  'A10',
  false,
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      '10'
    )
);


// ============================================================
// B. INFERENCIAS RAZONABLES DE INGENIERÍA
// ============================================================

runEngineeringInvalidTest(
  'B01',
  () =>
    calculateCartTotal(
      [{ unitPrice: NaN, quantity: 1 }],
      0
    )
);

runEngineeringInvalidTest(
  'B02',
  () =>
    calculateCartTotal(
      [{ unitPrice: Infinity, quantity: 1 }],
      0
    )
);

runEngineeringInvalidTest(
  'B03',
  () =>
    calculateCartTotal(
      [{ unitPrice: -Infinity, quantity: 1 }],
      0
    )
);

runEngineeringInvalidTest(
  'B04',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: NaN }],
      0
    )
);

runEngineeringInvalidTest(
  'B05',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: Infinity }],
      0
    )
);

runEngineeringInvalidTest(
  'B06',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      NaN
    )
);

runEngineeringInvalidTest(
  'B07',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      Infinity
    )
);

runEngineeringInvalidTest(
  'B08',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      -1
    )
);

runEngineeringInvalidTest(
  'B09',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      101
    )
);

runEngineeringInvalidTest(
  'B10',
  () =>
    calculateCartTotal(
      [{ unitPrice: -1, quantity: 1 }],
      0
    )
);

runEngineeringInvalidTest(
  'B11',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: -1 }],
      0
    )
);


// B12 se registra, no se puntúa automáticamente.
const b12Observation = observe(
  'B12',
  () =>
    calculateCartTotal(
      [{ unitPrice: Number.MAX_VALUE, quantity: 2 }],
      0
    )
);


// ============================================================
// C. DECISIONES NO ESPECIFICADAS
// ============================================================

const c01 = observe(
  'C01',
  () => calculateCartTotal([], 0)
);

const c02 = observe(
  'C02',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 0 }],
      0
    )
);

const c03 = observe(
  'C03',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1.5 }],
      0
    )
);

const c04 = observe(
  'C04',
  () =>
    calculateCartTotal(
      [{ unitPrice: 10, quantity: 1 }],
      0
    )
);

const c05 = observe(
  'C05',
  () => calculateCartTotal(null, 0)
);


// ============================================================
// RESULTADOS
// ============================================================

console.log('\n=== A. EXPLICIT REQUIREMENTS ===');

for (const result of results.filter(r => r.category === 'A')) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.id} | ${result.detail}`
  );
}

console.log('\n=== B. ENGINEERING INFERENCES ===');

for (const result of results.filter(r => r.category === 'B')) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.id} | ${result.detail}`
  );
}

console.log('\n=== B12 NUMERIC ROBUSTNESS OBSERVATION ===');
console.log(JSON.stringify(b12Observation, null, 2));

console.log('\n=== C. UNSPECIFIED DESIGN OBSERVATIONS ===');
console.log(JSON.stringify([c01, c02, c03, c04, c05], null, 2));

const aResults = results.filter(r => r.category === 'A');
const bResults = results.filter(r => r.category === 'B');

const summary = {
  A: {
    passed: aResults.filter(r => r.passed).length,
    total: aResults.length
  },
  B: {
    passed: bResults.filter(r => r.passed).length,
    total: bResults.length
  }
};

console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));

process.exitCode =
  summary.A.passed === summary.A.total ? 0 : 1;
