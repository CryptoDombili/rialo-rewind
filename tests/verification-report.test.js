import test from "node:test";
import assert from "node:assert/strict";
import { buildVerificationReport, formatVerificationSummary } from "../src/core/receipt-verifier-model.js";

test("verification report contains public proof metadata", () => {
  const report = buildVerificationReport({
    verdict: "VALID",
    verifiedAt: "2026-07-30T00:00:00.000Z",
    sourceFile: "receipt.json",
    receipt: { workflowId: "RW-0247", executionId: "exec-1", receiptHash: "a".repeat(64), onchainAnchor: { commitmentAddress: "commitment", signature: "signature", blockHeight: "42" } },
    integrity: { ok: true, suppliedHash: "a".repeat(64), computedHash: "a".repeat(64) },
    binding: { ok: true, anchor: { commitmentAddress: "commitment", signature: "signature", blockHeight: "42" } },
    chain: { status: "confirmed", blockHeight: "43", verificationMode: "transaction-index" },
    chainQueried: true,
  });
  assert.equal(report.verdict, "VALID");
  assert.equal(report.fullReceiptUploaded, false);
  assert.equal(report.blockHeight, "43");
  assert.match(formatVerificationSummary(report), /Verdict: VALID/);
  assert.match(formatVerificationSummary(report), /Workflow: RW-0247/);
});
