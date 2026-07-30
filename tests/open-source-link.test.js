import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("R1.5.3 places GitHub at the right edge of the case strip without changing top actions", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/app.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /href="https:\/\/github\.com\/CryptoDombili\/rialo-rewind"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  const caseStart = html.indexOf('<div class="case-strip">');
  const caseEnd = html.indexOf('</div>\n      <div class="top-actions">', caseStart);
  const sourceButton = html.indexOf('class="source-button"', caseStart);
  assert.ok(sourceButton > caseStart && sourceButton < caseEnd, "open source must stay inside the case strip");
  const actions = html.slice(caseEnd, html.indexOf('</div>\n    </header>', caseEnd));
  assert.doesNotMatch(actions, /source-button/);
  assert.match(actions, /network-state/);
  assert.match(actions, /connect-button/);
  assert.match(css, /grid-template-columns: 300px 1fr 390px/);
  assert.match(css, /\.case-strip > \.source-button/);
});
