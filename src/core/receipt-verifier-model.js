export const RECEIPT_SCHEMA = "rialo-rewind.receipt.v2";
export const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function assertReceiptShape(receipt) {
  if (!isObject(receipt)) throw new Error("Receipt JSON must contain an object.");
  if (receipt.schema !== RECEIPT_SCHEMA) throw new Error(`Unsupported receipt schema: ${String(receipt.schema || "missing")}.`);
  if (typeof receipt.receiptHash !== "string" || !/^[0-9a-f]{64}$/i.test(receipt.receiptHash)) {
    throw new Error("Receipt hash is missing or malformed.");
  }
  if (!Array.isArray(receipt.events) || receipt.events.length === 0) throw new Error("Receipt event history is missing.");
  if (typeof receipt.workflowId !== "string" || typeof receipt.executionId !== "string") {
    throw new Error("Workflow or execution identifier is missing.");
  }
  return receipt;
}

export function receiptHashPayload(receipt) {
  assertReceiptShape(receipt);
  const { receiptHash, onchainAnchor, ...base } = receipt;
  void receiptHash;
  void onchainAnchor;
  return JSON.stringify(base);
}

export async function sha256Hex(text) {
  const input = new TextEncoder().encode(String(text));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyReceiptIntegrity(receipt) {
  assertReceiptShape(receipt);
  const suppliedHash = receipt.receiptHash.toLowerCase();
  const computedHash = await sha256Hex(receiptHashPayload(receipt));
  return Object.freeze({
    ok: suppliedHash === computedHash,
    suppliedHash,
    computedHash,
  });
}

export function verifyAnchorBinding(receipt) {
  assertReceiptShape(receipt);
  const anchor = receipt.onchainAnchor;
  if (!isObject(anchor)) throw new Error("This receipt has no Rialo anchor proof.");
  if (String(anchor.receiptHash || "").toLowerCase() !== receipt.receiptHash.toLowerCase()) {
    return Object.freeze({ ok: false, error: "Anchor receipt hash does not match the receipt." });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(String(anchor.commitmentAddress || ""))) {
    return Object.freeze({ ok: false, error: "Commitment address is malformed." });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(String(anchor.signature || ""))) {
    return Object.freeze({ ok: false, error: "Anchor transaction signature is malformed." });
  }
  return Object.freeze({ ok: true, anchor });
}

export function classifyReceiptVerification({ integrity, binding, chain }) {
  if (!integrity?.ok || !binding?.ok) return "TAMPERED";
  if (["confirmed", "state-confirmed"].includes(chain?.status)) return "VALID";
  if (chain?.status === "submitted") return "PENDING";
  return "UNVERIFIED";
}


export function createTamperedReceiptCopy(receipt) {
  assertReceiptShape(receipt);
  const clone = JSON.parse(JSON.stringify(receipt));
  const originalRefund = String(clone.refund || "");
  clone.refund = originalRefund === "49.99 RLO" ? "50.01 RLO" : "49.99 RLO";
  return Object.freeze({
    receipt: clone,
    mutation: Object.freeze({
      field: "refund",
      before: originalRefund || "missing",
      after: clone.refund,
    }),
  });
}

export function shortVerifierValue(value, size = 12) {
  const text = String(value || "");
  if (!text) return "—";
  if (text.length <= size * 2 + 1) return text;
  return `${text.slice(0, size)}…${text.slice(-size)}`;
}


export const VERIFICATION_REPORT_SCHEMA = "rialo-rewind.verification-report.v1";
export const VERIFIER_VERSION = "r1.4.5";

export function buildVerificationReport({
  verdict,
  receipt = null,
  sourceFile = "",
  integrity = null,
  binding = null,
  chain = null,
  detail = "",
  verifiedAt = new Date().toISOString(),
  chainQueried = false,
} = {}) {
  const anchor = binding?.anchor || receipt?.onchainAnchor || null;
  return Object.freeze({
    schema: VERIFICATION_REPORT_SCHEMA,
    verifierVersion: VERIFIER_VERSION,
    verifiedAt,
    verdict: String(verdict || "UNVERIFIED"),
    sourceFile: String(sourceFile || ""),
    workflowId: receipt?.workflowId || null,
    executionId: receipt?.executionId || null,
    suppliedHash: integrity?.suppliedHash || receipt?.receiptHash || null,
    computedHash: integrity?.computedHash || null,
    hashMatched: Boolean(integrity?.ok),
    anchorBound: Boolean(binding?.ok),
    commitmentAddress: anchor?.commitmentAddress || null,
    signature: anchor?.signature || null,
    blockHeight: chain?.blockHeight || anchor?.blockHeight || null,
    chainStatus: chain?.status || null,
    verificationMode: chain?.verificationMode || null,
    chainQueried: Boolean(chainQueried),
    fullReceiptUploaded: false,
    detail: String(detail || ""),
  });
}

export function formatVerificationSummary(report) {
  if (!report || report.schema !== VERIFICATION_REPORT_SCHEMA) throw new Error("Verification report is missing or malformed.");
  const line = (label, value) => `${label}: ${value ?? "—"}`;
  return [
    "Rialo Rewind Receipt Verification",
    line("Verdict", report.verdict),
    line("Workflow", report.workflowId),
    line("Execution", report.executionId),
    line("SHA-256 integrity", report.hashMatched ? "MATCHED" : "MISMATCH"),
    line("Anchor binding", report.anchorBound ? "BOUND" : "NOT BOUND"),
    line("Rialo status", report.chainStatus),
    line("Block", report.blockHeight),
    line("Verification mode", report.verificationMode),
    line("Receipt hash", report.computedHash || report.suppliedHash),
    line("Commitment", report.commitmentAddress),
    line("Signature", report.signature),
    line("Verified by", `Rialo Rewind ${report.verifierVersion.toUpperCase()}`),
  ].join("\n");
}
