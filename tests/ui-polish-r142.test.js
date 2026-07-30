import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.4.2 includes the ambient starfield and legible failure diagnostic", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /class="ambient-starfield"/);
  assert.match(html, /star-layer-a/);
  assert.match(css, /R1\.4\.2 — ambient operations sky/);
  assert.match(css, /left: calc\(73% \+ 96px\)/);
  assert.match(css, /field-footnote[\s\S]*bottom: 20px/);
});
