import {
  Keypair,
  TransactionBuilder,
  createRialoClient,
  getDefaultRialoClientConfig,
  transferInstruction,
} from "@rialo/ts-cdk";

export const config = { maxDuration: 60 };

const AIRDROP_KELVIN = 50_000_000n; // 0.05 RLO
const TRANSFER_KELVIN = 1_000_000n; // 0.001 RLO
const KELVIN_PER_RLO = 1_000_000_000n;
const FUNDING_TIMEOUT_MS = 24_000;
const FINALITY_TIMEOUT_MS = 24_000;
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

async function waitForTransaction(client, signature, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const transaction = await client.getTransaction(signature);
      if (transactionVisible(transaction)) return transaction;
    } catch (error) {
      lastError = error;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  const error = new Error("Transfer was submitted, but finality was not visible before timeout.");
  error.code = "FINALITY_TIMEOUT";
  error.cause = lastError;
  throw error;
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
  if (req.headers["x-rewind-proof"] !== "v0.7") {
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
        airdropSignature: airdropSignature?.toString?.() || String(airdropSignature || ""),
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
        airdropSignature: airdropSignature?.toString?.() || String(airdropSignature || ""),
        balanceBefore: formatRlo(balanceBefore),
        durationMs: Date.now() - started,
      }));
    }

    const signatureText = transferSignature.toString();
    try {
      await waitForTransaction(client, transferSignature, FINALITY_TIMEOUT_MS);
    } catch (error) {
      const [balanceAfter, blockHeight] = await Promise.all([
        client.getBalance(sender.publicKey).catch(() => balanceBefore),
        client.getBlockHeight().catch(() => null),
      ]);
      return send(res, 200, {
        ok: true,
        status: "submitted",
        network: "rialo:devnet",
        sender: sender.publicKey.toString(),
        recipient: recipient.publicKey.toString(),
        signature: signatureText,
        airdropSignature: airdropSignature?.toString?.() || String(airdropSignature || ""),
        balanceBefore: formatRlo(balanceBefore),
        balanceAfter: formatRlo(balanceAfter),
        transfer: formatRlo(TRANSFER_KELVIN),
        blockHeight: blockHeight === null ? null : blockHeight.toString(),
        durationMs: Date.now() - started,
        warning: errorMessage(error),
      });
    }

    const [balanceAfter, blockHeight] = await Promise.all([
      client.getBalance(sender.publicKey),
      client.getBlockHeight().catch(() => null),
    ]);

    return send(res, 200, {
      ok: true,
      status: "confirmed",
      network: "rialo:devnet",
      sender: sender.publicKey.toString(),
      recipient: recipient.publicKey.toString(),
      signature: signatureText,
      airdropSignature: airdropSignature?.toString?.() || String(airdropSignature || ""),
      balanceBefore: formatRlo(balanceBefore),
      balanceAfter: formatRlo(balanceAfter),
      transfer: formatRlo(TRANSFER_KELVIN),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
      durationMs: Date.now() - started,
    });
  } catch (error) {
    console.error("signed-proof", error);
    return send(res, 502, stageError("wallet", error, { durationMs: Date.now() - started }));
  } finally {
    sender.dispose();
    recipient.dispose();
  }
}
