import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.4.4 uses a dense signal sky and step-04 failure pointer", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /ambient-starfield/);
  assert.match(css, /background-size: 97px 83px, 151px 127px, 239px 211px/);
  assert.match(css, /\.fault-gate\s*\{[\s\S]*left: 73%/);
  assert.match(css, /\.fault-gate::after/);
});
