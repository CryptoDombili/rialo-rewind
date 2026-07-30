const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const INDEX = new Map(Array.from(ALPHABET, (char, index) => [char, index]));

function encodeBase58(bytes) {
  if (!(bytes instanceof Uint8Array)) bytes = Uint8Array.from(bytes || []);
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = ALPHABET[remainder] + encoded;
    value /= 58n;
  }
  return "1".repeat(leadingZeroes) + (encoded || (leadingZeroes ? "" : "1"));
}

function decodeBase58(text) {
  let leadingOnes = 0;
  while (leadingOnes < text.length && text[leadingOnes] === "1") leadingOnes += 1;
  let value = 0n;
  for (const char of text) {
    const digit = INDEX.get(char);
    if (digit === undefined) throw new Error("Invalid base58 character.");
    value = value * 58n + BigInt(digit);
  }
  const body = [];
  while (value > 0n) {
    body.push(Number(value & 255n));
    value >>= 8n;
  }
  body.reverse();
  return Uint8Array.from([...new Array(leadingOnes).fill(0), ...body]);
}

function bytesFromUnknown(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value);
  if (value && typeof value.toBytes === "function") {
    const bytes = value.toBytes();
    return bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  }
  if (value && value.bytes) {
    return value.bytes instanceof Uint8Array ? value.bytes : Uint8Array.from(value.bytes);
  }
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (/^\d+(,\d+)+$/.test(text)) {
    const numbers = text.split(",").map((part) => Number(part));
    if (numbers.every((number) => Number.isInteger(number) && number >= 0 && number <= 255)) {
      return Uint8Array.from(numbers);
    }
  }
  return null;
}

export function normalizeRpcSignature(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (BASE58_RE.test(text) && text.length >= 80 && text.length <= 100) return text;
  }
  const bytes = bytesFromUnknown(value);
  if (!bytes || bytes.length !== 64) {
    throw new Error("Rialo RPC returned an invalid 64-byte transaction signature.");
  }
  return encodeBase58(bytes);
}

export function decodeSignatureText(value) {
  const text = String(value || "").trim();
  if (!BASE58_RE.test(text) || text.length < 80 || text.length > 100) {
    throw new Error("Invalid Rialo base58 transaction signature.");
  }
  const bytes = decodeBase58(text);
  if (bytes.length !== 64) throw new Error("Rialo transaction signature must decode to 64 bytes.");
  return bytes;
}
