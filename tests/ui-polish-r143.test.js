import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.4.3 uses a dense signal sky and collision-free failure gate", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /ambient-starfield/);
  assert.match(css, /background-size: 97px 83px, 151px 127px, 239px 211px/);
  assert.match(css, /\.fault-gate\s*\{[\s\S]*left: 66%/);
  assert.match(css, /width: 146px/);
});
