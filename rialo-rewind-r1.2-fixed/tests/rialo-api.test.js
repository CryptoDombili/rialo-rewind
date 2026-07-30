import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../api/rialo.js", import.meta.url), "utf8");

test("health endpoint uses Rialo official CDK transport", () => {
  assert.match(source, /createRialoClient/);
  assert.match(source, /getDefaultRialoClientConfig\("devnet"\)/);
  assert.doesNotMatch(source, /fetch\(RPC_URL/);
});

test("health endpoint exposes only block-height check", () => {
  assert.match(source, /method !== "getBlockHeight"/);
});
