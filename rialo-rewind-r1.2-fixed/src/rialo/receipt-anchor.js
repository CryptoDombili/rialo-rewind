import { ANCHOR_VERSION } from "../core/anchor-model.js";

async function requestAnchor(payload) {
  const response = await fetch("/api/anchor", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rewind-anchor": ANCHOR_VERSION,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    const error = new Error(body?.error?.message || `Anchor API returned HTTP ${response.status}.`);
    error.status = response.status;
    error.code = body?.error?.code || "ANCHOR_API_ERROR";
    throw error;
  }
  return body;
}

export function createReceiptAnchor(receiptHash) {
  return requestAnchor({ intent: "anchor-receipt", receiptHash });
}

export function verifyReceiptAnchor(anchor) {
  return requestAnchor({ intent: "verify-anchor", ...anchor });
}
