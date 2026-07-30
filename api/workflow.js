import { executeRecoveryWorkflow, ENGINE_VERSION } from "../src/server/recovery-engine.js";

export const config = { maxDuration: 20 };

const RATE_WINDOW_MS = 3_000;
const rateState = globalThis.__rialoRewindWorkflowRate || new Map();
globalThis.__rialoRewindWorkflowRate = rateState;

function send(res, status, body) {
  res.status(status);
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  return res.json(body);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function requester(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function rateLimit(req) {
  const key = requester(req);
  const now = Date.now();
  const previous = rateState.get(key) || 0;
  if (now - previous < RATE_WINDOW_MS) return Math.ceil((RATE_WINDOW_MS - (now - previous)) / 1000);
  rateState.set(key, now);
  if (rateState.size > 500) {
    for (const [entry, timestamp] of rateState) {
      if (now - timestamp > RATE_WINDOW_MS * 2) rateState.delete(entry);
    }
  }
  return 0;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: { message: "Same-origin request required." } });
  if (req.headers["x-rewind-engine"] !== ENGINE_VERSION) {
    return send(res, 400, { ok: false, error: { message: "Engine request header is missing." } });
  }

  const mode = req.body?.mode;
  if (!['clean', 'failure'].includes(mode)) {
    return send(res, 400, { ok: false, error: { message: "Mode must be clean or failure." } });
  }

  const retryAfter = rateLimit(req);
  if (retryAfter > 0) {
    res.setHeader("retry-after", String(retryAfter));
    return send(res, 429, { ok: false, error: { message: `Engine is cooling down. Try again in ${retryAfter}s.` } });
  }

  try {
    const result = await executeRecoveryWorkflow({ mode });
    return send(res, 200, result);
  } catch (error) {
    return send(res, 500, {
      ok: false,
      error: { code: error?.code || "WORKFLOW_EXECUTION_FAILED", message: error?.message || "Workflow execution failed." },
    });
  }
}
