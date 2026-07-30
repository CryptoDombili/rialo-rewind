import { Signature, createRialoClient, getDefaultRialoClientConfig } from "@rialo/ts-cdk";
import { decodeSignatureText } from "../src/rialo/signature-format.js";

export const config = { maxDuration: 20 };

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

function transactionVisible(value) {
  if (value == null) return false;
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return transactionVisible(value.value);
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: { message: "Same-origin request required." } });
  if (req.headers["x-rewind-proof"] !== "v0.8") {
    return send(res, 400, { ok: false, error: { message: "Verification request header is missing." } });
  }

  try {
    const signatureText = String(req.body?.signature || "").trim();
    const signature = Signature.fromBytes(decodeSignatureText(signatureText));
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));
    const [transaction, blockHeight] = await Promise.all([
      client.getTransaction(signature).catch(() => null),
      client.getBlockHeight().catch(() => null),
    ]);
    const confirmed = transactionVisible(transaction);
    return send(res, 200, {
      ok: true,
      status: confirmed ? "confirmed" : "pending",
      signature: signatureText,
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
    });
  } catch (error) {
    return send(res, 400, { ok: false, error: { message: error?.message || "Unable to verify Rialo transaction." } });
  }
}
