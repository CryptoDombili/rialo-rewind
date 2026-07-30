import test from "node:test";
import assert from "node:assert/strict";

function transactionVisible(value) {
  if (value == null) return false;
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return transactionVisible(value.value);
  }
  return true;
}

function stageStates(stage) {
  const order = ["wallet", "fund", "sign", "confirm"];
  const failedIndex = Math.max(0, order.indexOf(stage));
  return order.map((name, index) => index < failedIndex ? "complete" : index === failedIndex ? "failed" : "idle");
}

test("transaction visibility unwraps nullable RPC wrappers", () => {
  assert.equal(transactionVisible(null), false);
  assert.equal(transactionVisible({ value: null }), false);
  assert.equal(transactionVisible({ value: { signature: "abc" } }), true);
  assert.equal(transactionVisible({ signature: "abc" }), true);
});

test("only the actual failed stage is marked failed", () => {
  assert.deepEqual(stageStates("fund"), ["complete", "failed", "idle", "idle"]);
  assert.deepEqual(stageStates("confirm"), ["complete", "complete", "complete", "failed"]);
});
