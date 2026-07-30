import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/styles/app.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("R1.4.4 fault diagnostic is linked vertically to courier step", () => {
  assert.match(css, /\.fault-gate \{[\s\S]*left: 73%;[\s\S]*top: 306px/);
  assert.match(css, /\.fault-gate::before \{[\s\S]*bottom: 100%;[\s\S]*height: 38px/);
  assert.match(css, /\.fault-gate::after \{/);
});

test("R1.4.4 version label is consistent", () => {
  assert.match(html, /R1\.4\.4/);
});
