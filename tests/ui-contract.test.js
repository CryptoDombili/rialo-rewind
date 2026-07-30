import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.4 verifier UI exposes every required control exactly once", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const ids = ["receiptVerifierModal", "verifierFileInput", "verifierDropzone", "verifierLoadButton", "verifierResetButton", "verifierTamperButton", "verifierCopyButton", "verifierDownloadButton", "verifierResult"];
  for (const id of ids) {
    const count = (html.match(new RegExp(`id=[\"']${id}[\"']`, "g")) || []).length;
    assert.equal(count, 1, `${id} must appear exactly once`);
  }
});
