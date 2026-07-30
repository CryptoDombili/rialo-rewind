import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowReceipt, serializeReceipt } from "../src/core/receipt.js";

test("receipt is stable and portable", () => {
  const receipt = createWorkflowReceipt({
    result: "COMPENSATED",
    failedStep: "CREATE SHIPMENT",
    retries: 3,
    refund: "50.00 RLO",
    traces: ["trace_01"],
  });
  assert.equal(receipt.schema, "rialo-rewind.receipt.v1");
  assert.equal(receipt.retries, 3);
  assert.match(serializeReceipt(receipt), /COMPENSATED/);
});
