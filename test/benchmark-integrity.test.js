"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");

const manifestFiles = [
  "benchmarks/cart-total-v1.json",
  "benchmarks/bugfix-v1.json"
];

const frozenPackFiles = new Map([
  [
    "benchmarks/packs/cart-total-v1/benchmark-contract-v1.md",
    "1FB307387B1771492E6F6448D368723D3401A2623A1D86B3F16976CA311F04A8"
  ],
  [
    "benchmarks/packs/cart-total-v1/hidden-runner-v1.js",
    "32303CD868FEACEA9BEDF44985D44F30DCAD92DC01610FAB35F154D21094ED92"
  ],
  [
    "benchmarks/packs/bugfix-v1/benchmark-contract-v1.md",
    "10936592B18541884DD6A63408436327986BB8E47E18F3A36D7BEF4E8F4D7B77"
  ],
  [
    "benchmarks/packs/bugfix-v1/model-prompt-v1.txt",
    "86714D579EDA4505974C0EB4668F5521780D6640CBAA57427A0233045E016EA2"
  ],
  [
    "benchmarks/packs/bugfix-v1/buggy-v1.js",
    "029B8C714C10AA19D8F4C0D89FA5BD7215D1E384EEA14FB91E16B0A8C9DCDE7F"
  ],
  [
    "benchmarks/packs/bugfix-v1/hidden-tests-v1.test.js",
    "B633D2797B387B53C020A76EB92FBC9AA27B50F7820D60021051AAC30B5741AB"
  ],
  [
    "benchmarks/packs/bugfix-v1/spec-v1.md",
    "671A036AF6444B7522A119B791B4656B8418809BF33FA5905C3A3E8A0BF756A4"
  ],
  [
    "benchmarks/packs/bugfix-v1/defect-registry-v1.md",
    "AA5544293DEC00368979C549EACD31532EE97A3E724EB44183F7AC7932A08095"
  ],
  [
    "benchmarks/packs/bugfix-v1/scoring-rubric-v1.md",
    "D8DBC7EA396FD8905F8225F9F652ED0EAB34B1BC8D14667A502E310BC1095B31"
  ],
  [
    "benchmarks/packs/bugfix-v1/execution-procedure-v1.md",
    "4F5A2B7F9D881B6A6A865E9910F73E98850D7F9CF7B4C10CFD74702471C91278"
  ],
  [
    "benchmarks/packs/bugfix-v1/baseline-validation-v1.md",
    "5467DE35429E26FF9B1B756570BFC5B1DA874E54128B000F78F580279B11AA7C"
  ],
  [
    "benchmarks/packs/bugfix-v1/reference-v1.js",
    "D628CAFE075ECD35D81330547B6C07F025481CB2E59DA83DA4A2DDD5C8DCC8A9"
  ]
]);

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex")
    .toUpperCase();
}

test("benchmark manifests use portable relative source directories", () => {
  for (const relativeManifestPath of manifestFiles) {
    const manifestPath = path.join(root, relativeManifestPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert.equal(typeof manifest.sourceDir, "string");
    assert.notEqual(manifest.sourceDir.trim(), "");
    assert.equal(
      path.isAbsolute(manifest.sourceDir),
      false,
      `${relativeManifestPath} must not contain an absolute sourceDir`
    );

    const sourceDir = path.resolve(
      path.dirname(manifestPath),
      manifest.sourceDir
    );

    assert.equal(
      fs.statSync(sourceDir).isDirectory(),
      true,
      `${relativeManifestPath} sourceDir must resolve to a directory`
    );
  }
});

test("frozen benchmark pack files retain their validated SHA-256 hashes", () => {
  for (const [relativePath, expectedHash] of frozenPackFiles) {
    const filePath = path.join(root, relativePath);

    assert.equal(
      fs.existsSync(filePath),
      true,
      `${relativePath} must exist`
    );

    assert.equal(
      sha256(filePath),
      expectedHash,
      `${relativePath} changed from the validated frozen artefact`
    );
  }
});
