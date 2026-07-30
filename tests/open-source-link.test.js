import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.5.1 exposes the public GitHub source link", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /class="source-button"/);
  assert.match(html, /https:\/\/github\.com\/CryptoDombili\/rialo-rewind/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(css, /\.source-button \{/);
});
