import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/rialo.js";

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("RPC proxy rejects methods outside the allowlist", async () => {
  const req = { method: "POST", body: { method: "sendTransaction", params: [] } };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
});

test("RPC proxy returns an upstream result", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return { jsonrpc: "2.0", id: "x", result: 12345 }; },
  });

  const req = { method: "POST", body: { method: "getBlockHeight", params: [] } };
  const res = mockResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.result, 12345);
});
