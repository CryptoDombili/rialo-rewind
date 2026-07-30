import test from "node:test";
import assert from "node:assert/strict";
import { decodePublicKeyText, decodeSignatureText, normalizeRpcSignature } from "../src/rialo/signature-format.js";

test("raw 64-byte RPC signatures normalize to base58 and round-trip", () => {
  const bytes = Uint8Array.from({ length: 64 }, (_, index) => (index * 17 + 3) % 256);
  const text = normalizeRpcSignature(bytes);
  assert.match(text, /^[1-9A-HJ-NP-Za-km-z]+$/);
  assert.deepEqual(decodeSignatureText(text), bytes);
});

test("comma-separated byte strings normalize to base58", () => {
  const bytes = Uint8Array.from({ length: 64 }, (_, index) => index);
  const text = normalizeRpcSignature(Array.from(bytes).join(","));
  assert.deepEqual(decodeSignatureText(text), bytes);
});


test("32-byte Rialo public addresses decode safely", () => {
  const bytes = decodePublicKeyText("1".repeat(32));
  assert.equal(bytes.length, 32);
  assert.ok(bytes.every((byte) => byte === 0));
});
