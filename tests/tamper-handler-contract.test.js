import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("tamper challenge declares its integrity result locally", async () => {
  const source = await readFile(new URL("../src/receipt-verifier.js", import.meta.url), "utf8");
  const start = source.indexOf("async function runTamperTest()");
  const end = source.indexOf("async function copySummary()", start);
  assert.ok(start >= 0 && end > start, "tamper handler must exist");
  const handler = source.slice(start, end);
  assert.match(handler, /const integrity = await verifyReceiptIntegrity\(receipt\);/);
  assert.doesNotMatch(handler, /(^|\n)\s*integrity = await verifyReceiptIntegrity\(receipt\);/);
});
