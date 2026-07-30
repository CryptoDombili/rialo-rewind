export const ANCHOR_VERSION = "r1.1";
export const ANCHOR_DOMAIN = "rialo-rewind.receipt-anchor.v1";

export function normalizeReceiptHash(value) {
  const hash = String(value || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error("Receipt hash must be a 64-character SHA-256 hex value.");
  }
  return hash;
}

export function receiptHashBytes(value) {
  const hash = normalizeReceiptHash(value);
  return Uint8Array.from(hash.match(/../g).map((byte) => Number.parseInt(byte, 16)));
}

export function anchorPreimage(value) {
  const hash = normalizeReceiptHash(value);
  return `${ANCHOR_DOMAIN}:${hash}`;
}

export function shortAnchorValue(value, size = 12) {
  const text = String(value || "");
  if (text.length <= size * 2 + 1) return text || "—";
  return `${text.slice(0, size)}…${text.slice(-size)}`;
}
