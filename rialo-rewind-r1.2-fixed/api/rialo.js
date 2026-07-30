import { createRialoClient, getDefaultRialoClientConfig } from "@rialo/ts-cdk";

export const config = { maxDuration: 15 };

function send(res, status, body) {
  res.status(status);
  res.setHeader("cache-control", "no-store");
  return res.json(body);
}

function messageOf(error) {
  return error?.details?.message || error?.cause?.message || error?.message || "Rialo devnet health check failed.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }

  const { method } = req.body || {};
  if (method !== "getBlockHeight") {
    return send(res, 400, {
      ok: false,
      error: { message: "This endpoint only exposes the Rialo devnet health check." },
    });
  }

  const started = Date.now();
  try {
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));
    const blockHeight = await client.getBlockHeight();
    return send(res, 200, {
      ok: true,
      network: "rialo:devnet",
      latencyMs: Date.now() - started,
      result: blockHeight.toString(),
    });
  } catch (error) {
    console.error("rialo-health", error);
    return send(res, 502, {
      ok: false,
      latencyMs: Date.now() - started,
      error: { message: messageOf(error) },
    });
  }
}
