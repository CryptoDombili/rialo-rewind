import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.5.2 exposes GitHub as the far-right top action", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /class="source-button"/);
  assert.match(html, /https:\/\/github\.com\/CryptoDombili\/rialo-rewind/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);

  const actionsStart = html.indexOf('<div class="top-actions">');
  const actionsEnd = html.indexOf('</header>', actionsStart);
  const signedProof = html.indexOf('SIGNED PROOF', actionsStart);
  const sourceButton = html.indexOf('class="source-button"', actionsStart);

  assert.ok(actionsStart >= 0 && actionsEnd > actionsStart, "top actions must exist");
  assert.ok(signedProof > actionsStart && signedProof < actionsEnd, "signed proof must stay in top actions");
  assert.ok(sourceButton > signedProof && sourceButton < actionsEnd, "open source must be the final action after signed proof");
  assert.match(css, /grid-template-columns: minmax\(178px, 1fr\) 176px 166px/);
  assert.match(css, /\.top-actions \.source-button/);
});
