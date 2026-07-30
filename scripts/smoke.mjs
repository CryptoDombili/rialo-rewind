import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const base = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", base), "utf8");
const css = await readFile(new URL("src/styles/app.css", base), "utf8");
const app = await readFile(new URL("src/app.js", base), "utf8");

assert.match(html, /Recovery Console/);
assert.match(html, /PUBLIC RECEIPT VERIFIER \/ R1\.4\.4/);
assert.match(html, /id="verifierCopyButton"/);
assert.match(html, /id="verifierDownloadButton"/);
assert.match(css, /R1\.4\.4 final product polish/);
assert.match(app, /SERVER R1\.4\.4/);
await Promise.all([
  access(new URL("src/receipt-verifier.js", base)),
  access(new URL("api/workflow.js", base)),
  access(new URL("api/anchor.js", base)),
]);
console.log("Static production smoke check passed.");
