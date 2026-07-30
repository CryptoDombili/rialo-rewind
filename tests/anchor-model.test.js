import test from "node:test";
import assert from "node:assert/strict";
import {
  ANCHOR_DOMAIN,
  ANCHOR_VERSION,
  anchorPreimage,
  normalizeReceiptHash,
  receiptHashBytes,
  shortAnchorValue,
} from "../src/core/anchor-model.js";

const HASH = "a".repeat(64);

test("anchor model validates and normalizes SHA-256 receipt hashes", () => {
  assert.equal(normalizeReceiptHash(HASH.toUpperCase()), HASH);
  assert.throws(() => normalizeReceiptHash("abc"), /64-character/);
});

test("anchor preimage is domain separated", () => {
  assert.equal(ANCHOR_VERSION, "r1.1");
  assert.equal(anchorPreimage(HASH), `${ANCHOR_DOMAIN}:${HASH}`);
});

test("receipt hash bytes preserve all 32 bytes", () => {
  const bytes = receiptHashBytes("00".repeat(32));
  assert.equal(bytes.length, 32);
  assert.ok(bytes.every((value) => value === 0));
});

test("short anchor values preserve both ends", () => {
  assert.equal(shortAnchorValue("1234567890", 3), "123…890");
  assert.equal(shortAnchorValue("short", 3), "short");
});
