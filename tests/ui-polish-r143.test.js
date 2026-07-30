import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.5.3 uses a dense signal sky and step-04 failure pointer", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /ambient-starfield/);
  assert.match(css, /background-size: 97px 83px, 151px 127px, 239px 211px/);
  assert.match(css, /animation: rialoStarDrift 28s ease-in-out infinite alternate/);
  assert.match(css, /\.fault-gate\s*\{[\s\S]*left: calc\(73% - var\(--fault-offset\)\)/);
  assert.match(css, /\.fault-gate::after/);
});
