import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("public runtime surfaces R1.4.5 consistently", async () => {
  const [html, pkg, app, engine, client] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../src/app.js", import.meta.url), "utf8"),
    readFile(new URL("../src/server/recovery-engine.js", import.meta.url), "utf8"),
    readFile(new URL("../src/core/workflow-client.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /BUILD<\/span><strong>R1\.4\.5/);
  assert.match(html, /PUBLIC RECEIPT VERIFIER \/ R1\.4\.5/);
  assert.equal(JSON.parse(pkg).version, "1.4.5");
  assert.match(app, /SERVER R1\.4\.5/);
  assert.match(engine, /ENGINE_VERSION = "r1\.4\.5"/);
  assert.match(client, /"x-rewind-engine": "r1\.4\.5"/);
});
