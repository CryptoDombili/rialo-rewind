import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyReceiptVerification,
  createTamperedReceiptCopy,
  verifyAnchorBinding,
  verifyReceiptIntegrity,
} from "../src/core/receipt-verifier-model.js";

function baseReceipt() {
  return {
    schema: "rialo-rewind.receipt.v2",
    engineVersion: "r1.4.5",
    engine: "vercel-server-state-machine",
    workflowId: "RW-0247",
    executionId: "test-execution",
    mode: "failure",
    result: "COMPENSATED",
    failedStep: "CREATE SHIPMENT",
    retries: 3,
    refund: "50.00 RLO",
    manualIntervention: "NOT REQUIRED",
    stateBefore: {},
    stateAfter: {},
    idempotencyKeys: [],
    traces: [],
    events: [{ sequence: 1, type: "workflow.completed" }],
    startedAt: "2026-07-30T00:00:00.000Z",
    issuedAt: "2026-07-30T00:00:01.000Z",
    durationMs: 1000,
  };
}

async function signedReceipt() {
  const { sha256Hex } = await import("../src/core/receipt-verifier-model.js");
  const base = baseReceipt();
  return { ...base, receiptHash: await sha256Hex(JSON.stringify(base)) };
}

test("verifier accepts an unchanged receipt hash", async () => {
  const receipt = await signedReceipt();
  const result = await verifyReceiptIntegrity(receipt);
  assert.equal(result.ok, true);
});

test("verifier detects changed receipt content", async () => {
  const receipt = await signedReceipt();
  receipt.refund = "49.00 RLO";
  const result = await verifyReceiptIntegrity(receipt);
  assert.equal(result.ok, false);
});

test("anchor binding requires the same receipt hash", async () => {
  const receipt = await signedReceipt();
  receipt.onchainAnchor = {
    receiptHash: "f".repeat(64),
    commitmentAddress: "E4egR9UQn2vBJTnXZDPR18PbZrv3XK6yqgJpqxZXj6mY",
    signature: "S7bgUcKHgptFuaPPTj4x2jpGWPoUz3dTDXYVA9BDmZfCvaqMsT5UaY4NYMGLCvSac9Dfb3f8idwejTXBtMRizSq",
  };
  assert.equal(verifyAnchorBinding(receipt).ok, false);
});

test("classification distinguishes valid, pending and tampered receipts", () => {
  assert.equal(classifyReceiptVerification({ integrity: { ok: true }, binding: { ok: true }, chain: { status: "confirmed" } }), "VALID");
  assert.equal(classifyReceiptVerification({ integrity: { ok: true }, binding: { ok: true }, chain: { status: "submitted" } }), "PENDING");
  assert.equal(classifyReceiptVerification({ integrity: { ok: false }, binding: { ok: true }, chain: { status: "confirmed" } }), "TAMPERED");
});


test("tamper challenge changes a protected field without mutating the source", async () => {
  const receipt = await signedReceipt();
  receipt.onchainAnchor = {
    receiptHash: receipt.receiptHash,
    commitmentAddress: "E4egR9UQn2vBJTnXZDPR18PbZrv3XK6yqgJpqxZXj6mY",
    signature: "S7bgUcKHgptFuaPPTj4x2jpGWPoUz3dTDXYVA9BDmZfCvaqMsT5UaY4NYMGLCvSac9Dfb3f8idwejTXBtMRizSq",
  };
  const originalRefund = receipt.refund;
  const challenge = createTamperedReceiptCopy(receipt);
  assert.equal(receipt.refund, originalRefund);
  assert.notEqual(challenge.receipt.refund, originalRefund);
  assert.equal(challenge.receipt.receiptHash, receipt.receiptHash);
  assert.equal(challenge.receipt.onchainAnchor.signature, receipt.onchainAnchor.signature);
  assert.equal((await verifyReceiptIntegrity(challenge.receipt)).ok, false);
});
