import { PublicKey, Signature, createRialoClient, getDefaultRialoClientConfig } from "@rialo/ts-cdk";
import {
  decodePublicKeyText,
  decodeSignatureText,
  normalizeRpcSignature,
} from "../src/rialo/signature-format.js";

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

function unwrapArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return unwrapArray(value.value);
  }
  return [];
}

function historyHasSignature(history, signatureText) {
  return unwrapArray(history).some((entry) => {
    const candidate = entry?.signature ?? entry;
    try {
      return normalizeRpcSignature(candidate) === signatureText;
    } catch {
      return String(candidate || "") === signatureText;
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: { message: "Same-origin request required." } });
  if (req.headers["x-rewind-proof"] !== "v0.9") {
    return send(res, 400, { ok: false, error: { message: "Verification request header is missing." } });
  }

  try {
    const signatureText = String(req.body?.signature || "").trim();
    const signature = Signature.fromBytes(decodeSignatureText(signatureText));
    const sender = PublicKey.fromBytes(decodePublicKeyText(req.body?.sender));
    const recipient = PublicKey.fromBytes(decodePublicKeyText(req.body?.recipient));
    const balanceBefore = BigInt(req.body?.balanceBeforeKelvin);
    const transferKelvin = BigInt(req.body?.transferKelvin);
    if (balanceBefore <= 0n || transferKelvin <= 0n) throw new Error("Invalid proof evidence values.");

    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));
    const [transaction, history, senderBalanceRaw, recipientBalanceRaw, blockHeight] = await Promise.all([
      client.getTransaction(signature).catch(() => null),
      client.getSignaturesForAddress(sender).catch(() => []),
      client.getBalance(sender),
      client.getBalance(recipient),
      client.getBlockHeight().catch(() => null),
    ]);

    const senderBalance = BigInt(senderBalanceRaw);
    const recipientBalance = BigInt(recipientBalanceRaw);
    const indexConfirmed = transactionVisible(transaction) || historyHasSignature(history, signatureText);
    const stateConfirmed = senderBalance <= balanceBefore - transferKelvin && recipientBalance >= transferKelvin;

    let status = "pending";
    let verificationMode = "submitted";
    if (indexConfirmed) {
      status = "confirmed";
      verificationMode = "transaction-index";
    } else if (stateConfirmed) {
      status = "state-confirmed";
      verificationMode = "account-state";
    }

    return send(res, 200, {
      ok: true,
      status,
      verificationMode,
      signature: signatureText,
      senderBalanceKelvin: senderBalance.toString(),
      recipientBalanceKelvin: recipientBalance.toString(),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
    });
  } catch (error) {
    return send(res, 400, { ok: false, error: { message: error?.message || "Unable to verify Rialo transaction." } });
  }
}
