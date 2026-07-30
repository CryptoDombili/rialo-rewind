import { randomUUID } from "node:crypto";

const RPC_URL = process.env.RIALO_RPC_URL || "https://devnet.rialo.io:4101";
const ALLOWED_METHODS = new Set([
  "getBlockHeight",
  "getEpochInfo",
  "getBalance",
  "getSignaturesForAddress",
  "getTransaction",
  "getWorkflowLineage",
  "getSubscription",
  "getTriggeredTransactions",
]);

function send(res, status, body) {
  res.status(status);
  res.setHeader("cache-control", "no-store");
  return res.json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required" } });
  }

  const { method, params = [] } = req.body || {};
  if (!ALLOWED_METHODS.has(method)) {
    return send(res, 400, { ok: false, error: { message: "RPC method is not allowed by this proxy." } });
  }
  if (!Array.isArray(params)) {
    return send(res, 400, { ok: false, error: { message: "RPC params must be an array." } });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const started = Date.now();

  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
      signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    const latencyMs = Date.now() - started;

    if (!upstream.ok) {
      return send(res, 502, { ok: false, latencyMs, error: { message: `Rialo RPC returned HTTP ${upstream.status}.` } });
    }
    if (!payload) {
      return send(res, 502, { ok: false, latencyMs, error: { message: "Rialo RPC returned an unreadable response." } });
    }
    if (payload.error) {
      return send(res, 502, { ok: false, latencyMs, error: payload.error });
    }

    return send(res, 200, { ok: true, latencyMs, result: payload.result });
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "Rialo devnet did not respond within 10 seconds."
      : error?.message || "Rialo devnet request failed.";
    return send(res, 502, { ok: false, latencyMs: Date.now() - started, error: { message } });
  } finally {
    clearTimeout(timeout);
  }
}
