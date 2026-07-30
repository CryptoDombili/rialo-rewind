import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("R1.5.1 fault diagnostic is linked vertically to courier step", () => {
  assert.match(css, /\.fault-gate \{[\s\S]*left: calc\(73% - var\(--fault-offset\)\);[\s\S]*top: 306px/);
  assert.match(css, /\.fault-gate::before \{[\s\S]*left: calc\(50% \+ var\(--fault-offset\)\);[\s\S]*bottom: 100%;[\s\S]*height: 40px/);
  assert.match(css, /\.fault-gate::after \{[\s\S]*bottom: calc\(100% \+ 36px\)/);
});

test("R1.5.1 version label is consistent", () => {
  assert.match(html, /R1\.5/);
});
