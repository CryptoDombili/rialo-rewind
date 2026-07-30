import {
  Keypair,
  TransactionBuilder,
  createRialoClient,
  getDefaultRialoClientConfig,
  transferInstruction,
} from "@rialo/ts-cdk";
import { normalizeRpcSignature } from "../src/rialo/signature-format.js";

export const config = { maxDuration: 60 };

const AIRDROP_KELVIN = 50_000_000n; // 0.05 RLO
const TRANSFER_KELVIN = 1_000_000n; // 0.001 RLO
const KELVIN_PER_RLO = 1_000_000_000n;
const FUNDING_TIMEOUT_MS = 24_000;
const FINALITY_TIMEOUT_MS = 9_000;
const STATE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 750;
const RATE_WINDOW_MS = 120_000;

const rateState = globalThis.__rialoRewindProofRate || new Map();
globalThis.__rialoRewindProofRate = rateState;

function send(res, status, body) {
  res.status(status);
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  return res.json(body);
}

function formatRlo(value) {
  const kelvin = BigInt(value);
  const whole = kelvin / KELVIN_PER_RLO;
  const fraction = (kelvin % KELVIN_PER_RLO).toString().padStart(9, "0").slice(0, 6);
  return `${whole}.${fraction} RLO`;
}

function errorMessage(error) {
  return error?.details?.message || error?.cause?.message || error?.message || "Rialo signed proof failed.";
}

function getRequester(req) {
  const forwarded = req.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
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

function enforceRateLimit(req) {
  const key = getRequester(req);
  const now = Date.now();
  const previous = rateState.get(key) || 0;
  if (now - previous < RATE_WINDOW_MS) {
    return Math.ceil((RATE_WINDOW_MS - (now - previous)) / 1000);
  }
  rateState.set(key, now);
  if (rateState.size > 250) {
    for (const [entry, timestamp] of rateState) {
      if (now - timestamp > RATE_WINDOW_MS) rateState.delete(entry);
    }
  }
  return 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBalance(client, publicKey, minimum, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastBalance = 0n;
  while (Date.now() < deadline) {
    lastBalance = BigInt(await client.getBalance(publicKey));
    if (lastBalance >= minimum) return lastBalance;
    await sleep(POLL_INTERVAL_MS);
  }
  const error = new Error("Devnet airdrop was submitted but the funded balance was not visible before timeout.");
  error.code = "FUNDING_TIMEOUT";
  error.lastBalance = lastBalance;
  throw error;
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

async function waitForTransaction(client, signature, signatureText, sender, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const [transaction, history] = await Promise.all([
        client.getTransaction(signature).catch(() => null),
        client.getSignaturesForAddress(sender).catch(() => []),
      ]);
      if (transactionVisible(transaction) || historyHasSignature(history, signatureText)) {
        return { transaction, history };
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const error = new Error("Transfer was submitted, but transaction indexing was not visible before timeout.");
  error.code = "INDEX_TIMEOUT";
  error.cause = lastError;
  throw error;
}

async function waitForStateEvidence(client, sender, recipient, balanceBefore, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let senderBalance = balanceBefore;
  let recipientBalance = 0n;
  while (Date.now() < deadline) {
    [senderBalance, recipientBalance] = await Promise.all([
      client.getBalance(sender).then(BigInt).catch(() => senderBalance),
      client.getBalance(recipient).then(BigInt).catch(() => recipientBalance),
    ]);
    const senderDebited = senderBalance <= balanceBefore - TRANSFER_KELVIN;
    const recipientCredited = recipientBalance >= TRANSFER_KELVIN;
    if (senderDebited && recipientCredited) {
      return { senderBalance, recipientBalance, verified: true };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { senderBalance, recipientBalance, verified: false };
}

function stageError(stage, error, extra = {}) {
  return {
    ok: false,
    stage,
    error: {
      code: error?.code || "SIGNED_PROOF_FAILED",
      message: errorMessage(error),
    },
    ...extra,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (!sameOrigin(req)) {
    return send(res, 403, { ok: false, error: { message: "Same-origin request required." } });
  }
  if (req.headers["x-rewind-proof"] !== "v0.9") {
    return send(res, 400, { ok: false, error: { message: "Proof request header is missing." } });
  }
  if (req.body?.intent !== "signed-devnet-proof") {
    return send(res, 400, { ok: false, error: { message: "Unknown proof intent." } });
  }

  const retryAfter = enforceRateLimit(req);
  if (retryAfter > 0) {
    res.setHeader("retry-after", String(retryAfter));
    return send(res, 429, {
      ok: false,
      error: { message: `One proof is allowed every two minutes. Try again in ${retryAfter}s.` },
    });
  }

  const started = Date.now();
  const sender = Keypair.generate();
  const recipient = Keypair.generate();
  let airdropSignature = null;
  let transferSignature = null;

  try {
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));

    try {
      airdropSignature = await client.requestAirdrop(sender.publicKey, AIRDROP_KELVIN);
    } catch (error) {
      return send(res, 502, stageError("fund", error, {
        sender: sender.publicKey.toString(),
        durationMs: Date.now() - started,
      }));
    }

    let balanceBefore;
    try {
      balanceBefore = await waitForBalance(client, sender.publicKey, TRANSFER_KELVIN, FUNDING_TIMEOUT_MS);
    } catch (error) {
      return send(res, 504, stageError("fund", error, {
        sender: sender.publicKey.toString(),
        airdropSignature: normalizeRpcSignature(airdropSignature),
        durationMs: Date.now() - started,
      }));
    }

    try {
      const configHashPrefix = await client.getConfigHashPrefix();
      const instruction = transferInstruction(sender.publicKey, recipient.publicKey, TRANSFER_KELVIN);
      const transaction = TransactionBuilder.create()
        .setPayer(sender.publicKey)
        .setValidFrom(BigInt(Date.now()))
        .setConfigHashPrefix(configHashPrefix)
        .addInstruction(instruction)
        .build();
      const signed = transaction.sign(sender);
      transferSignature = await client.sendTransaction(signed.serialize());
    } catch (error) {
      return send(res, 502, stageError("sign", error, {
        sender: sender.publicKey.toString(),
        recipient: recipient.publicKey.toString(),
        airdropSignature: normalizeRpcSignature(airdropSignature),
        balanceBefore: formatRlo(balanceBefore),
        durationMs: Date.now() - started,
      }));
    }

    const signatureText = normalizeRpcSignature(transferSignature);
    let indexed = false;
    try {
      await waitForTransaction(client, transferSignature, signatureText, sender.publicKey, FINALITY_TIMEOUT_MS);
      indexed = true;
    } catch {
      indexed = false;
    }

    const state = await waitForStateEvidence(
      client,
      sender.publicKey,
      recipient.publicKey,
      balanceBefore,
      indexed ? 1 : STATE_TIMEOUT_MS,
    );
    const blockHeight = await client.getBlockHeight().catch(() => null);

    const common = {
      ok: true,
      network: "rialo:devnet",
      sender: sender.publicKey.toString(),
      recipient: recipient.publicKey.toString(),
      signature: signatureText,
      airdropSignature: normalizeRpcSignature(airdropSignature),
      balanceBefore: formatRlo(balanceBefore),
      balanceAfter: formatRlo(state.senderBalance),
      recipientBalance: formatRlo(state.recipientBalance),
      balanceBeforeKelvin: balanceBefore.toString(),
      transferKelvin: TRANSFER_KELVIN.toString(),
      transfer: formatRlo(TRANSFER_KELVIN),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
      durationMs: Date.now() - started,
    };

    if (indexed) {
      return send(res, 200, { ...common, status: "confirmed", verificationMode: "transaction-index" });
    }
    if (state.verified) {
      return send(res, 200, {
        ...common,
        status: "state-confirmed",
        verificationMode: "account-state",
        warning: "Transaction index is lagging, but sender debit and disposable recipient credit confirm execution.",
      });
    }
    return send(res, 200, {
      ...common,
      status: "submitted",
      verificationMode: "submitted",
      warning: "Transfer was submitted; neither transaction index nor account-state evidence was visible before timeout.",
    });
  } catch (error) {
    console.error("signed-proof", error);
    return send(res, 502, stageError("wallet", error, { durationMs: Date.now() - started }));
  } finally {
    sender.dispose();
    recipient.dispose();
  }
}
