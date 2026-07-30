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
