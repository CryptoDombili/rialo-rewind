import test from "node:test";
import assert from "node:assert/strict";
import { executeRecoveryWorkflow, verifyReceiptHash } from "../src/server/recovery-engine.js";

test("clean execution settles without compensation", async () => {
  const result = await executeRecoveryWorkflow({ mode: "clean" });
  assert.equal(result.execution.result, "SETTLED");
  assert.equal(result.execution.refundRlo, 0);
  assert.equal(result.execution.stateAfter.escrow.settledRlo, 50);
  assert.equal(result.execution.events.some((event) => event.compensation), false);
  assert.equal(verifyReceiptHash(result.receipt), true);
});

test("courier failure retries three times and compensates in reverse order", async () => {
  const result = await executeRecoveryWorkflow({ mode: "failure" });
  assert.equal(result.execution.result, "COMPENSATED");
  assert.equal(result.execution.retries, 3);
  assert.equal(result.execution.stateAfter.escrow.refundedRlo, 50);
  assert.equal(result.execution.stateAfter.merchant.status, "CANCELLED");
  assert.equal(result.execution.stateAfter.inventory.reserved, 0);
  const compensation = result.execution.events
    .filter((event) => event.type === "action.completed" && event.compensation)
    .map((event) => event.name);
  assert.deepEqual(compensation, ["refund", "cancel", "release"]);
  assert.equal(verifyReceiptHash(result.receipt), true);
});

test("receipt hash detects mutation", async () => {
  const result = await executeRecoveryWorkflow({ mode: "failure" });
  const changed = { ...result.receipt, retries: 2 };
  assert.equal(verifyReceiptHash(changed), false);
});
