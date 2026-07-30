import { createHash } from "node:crypto";
import {
  Keypair,
  PublicKey,
  Signature,
  TransactionBuilder,
  createRialoClient,
  getDefaultRialoClientConfig,
  transferInstruction,
} from "@rialo/ts-cdk";
import { ANCHOR_VERSION, anchorPreimage, normalizeReceiptHash } from "../src/core/anchor-model.js";
import {
  decodePublicKeyText,
  decodeSignatureText,
  normalizeRpcSignature,
} from "../src/rialo/signature-format.js";

export const config = { maxDuration: 60 };

const AIRDROP_KELVIN = 10_000_000n; // 0.01 RLO
const ANCHOR_KELVIN = 1_000_000n; // 0.001 RLO commitment transfer
const FUNDING_TIMEOUT_MS = 24_000;
const INDEX_TIMEOUT_MS = 9_000;
const STATE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 750;
const RATE_WINDOW_MS = 90_000;
const rateState = globalThis.__rialoRewindAnchorRate || new Map();
globalThis.__rialoRewindAnchorRate = rateState;

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

function enforceRateLimit(req) {
  const key = requester(req);
  const now = Date.now();
  const previous = rateState.get(key) || 0;
  if (now - previous < RATE_WINDOW_MS) return Math.ceil((RATE_WINDOW_MS - (now - previous)) / 1000);
  rateState.set(key, now);
  if (rateState.size > 250) {
    for (const [entry, timestamp] of rateState) {
      if (now - timestamp > RATE_WINDOW_MS * 2) rateState.delete(entry);
    }
  }
  return 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveCommitmentKeypair(receiptHash) {
  const seed = createHash("sha256").update(anchorPreimage(receiptHash)).digest();
  return Keypair.fromSecretKey(new Uint8Array(seed));
}

async function waitForBalance(client, publicKey, minimum, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = 0n;
  while (Date.now() < deadline) {
    last = BigInt(await client.getBalance(publicKey));
    if (last >= minimum) return last;
    await sleep(POLL_INTERVAL_MS);
  }
  const error = new Error("Anchor payer funding was not visible before timeout.");
  error.code = "ANCHOR_FUNDING_TIMEOUT";
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

async function waitForEvidence(client, { signature, signatureText, sender, commitment, senderBefore, commitmentBefore }) {
  const indexDeadline = Date.now() + INDEX_TIMEOUT_MS;
  let indexed = false;
  while (Date.now() < indexDeadline) {
    const [transaction, history] = await Promise.all([
      client.getTransaction(signature).catch(() => null),
      client.getSignaturesForAddress(sender).catch(() => []),
    ]);
    if (transactionVisible(transaction) || historyHasSignature(history, signatureText)) {
      indexed = true;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const stateDeadline = Date.now() + (indexed ? 1 : STATE_TIMEOUT_MS);
  let senderAfter = senderBefore;
  let commitmentAfter = commitmentBefore;
  do {
    [senderAfter, commitmentAfter] = await Promise.all([
      client.getBalance(sender).then(BigInt).catch(() => senderAfter),
      client.getBalance(commitment).then(BigInt).catch(() => commitmentAfter),
    ]);
    const stateConfirmed = senderAfter <= senderBefore - ANCHOR_KELVIN && commitmentAfter >= commitmentBefore + ANCHOR_KELVIN;
    if (indexed || stateConfirmed) return { indexed, stateConfirmed, senderAfter, commitmentAfter };
    await sleep(POLL_INTERVAL_MS);
  } while (Date.now() < stateDeadline);

  return { indexed, stateConfirmed: false, senderAfter, commitmentAfter };
}

function anchorStatus(evidence) {
  if (evidence.indexed) return { status: "confirmed", verificationMode: "transaction-index" };
  if (evidence.stateConfirmed) return { status: "state-confirmed", verificationMode: "account-state" };
  return { status: "submitted", verificationMode: "submitted" };
}

async function createAnchor(receiptHash) {
  const normalizedHash = normalizeReceiptHash(receiptHash);
  const payer = Keypair.generate();
  const commitment = deriveCommitmentKeypair(normalizedHash);
  const started = Date.now();
  try {
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));
    const commitmentBefore = BigInt(await client.getBalance(commitment.publicKey).catch(() => 0n));
    const airdropSignature = await client.requestAirdrop(payer.publicKey, AIRDROP_KELVIN);
    const senderBefore = await waitForBalance(client, payer.publicKey, ANCHOR_KELVIN, FUNDING_TIMEOUT_MS);
    const configHashPrefix = await client.getConfigHashPrefix();
    const instruction = transferInstruction(payer.publicKey, commitment.publicKey, ANCHOR_KELVIN);
    const transaction = TransactionBuilder.create()
      .setPayer(payer.publicKey)
      .setValidFrom(BigInt(Date.now()))
      .setConfigHashPrefix(configHashPrefix)
      .addInstruction(instruction)
      .build();
    const signature = await client.sendTransaction(transaction.sign(payer).serialize());
    const signatureText = normalizeRpcSignature(signature);
    const evidence = await waitForEvidence(client, {
      signature,
      signatureText,
      sender: payer.publicKey,
      commitment: commitment.publicKey,
      senderBefore,
      commitmentBefore,
    });
    const blockHeight = await client.getBlockHeight().catch(() => null);
    return {
      ok: true,
      receiptHash: normalizedHash,
      anchorVersion: ANCHOR_VERSION,
      scheme: "hash-derived-recipient-v1",
      network: "rialo:devnet",
      commitmentAddress: commitment.publicKey.toString(),
      sender: payer.publicKey.toString(),
      signature: signatureText,
      airdropSignature: normalizeRpcSignature(airdropSignature),
      senderBeforeKelvin: senderBefore.toString(),
      senderAfterKelvin: evidence.senderAfter.toString(),
      commitmentBeforeKelvin: commitmentBefore.toString(),
      commitmentAfterKelvin: evidence.commitmentAfter.toString(),
      transferKelvin: ANCHOR_KELVIN.toString(),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
      durationMs: Date.now() - started,
      ...anchorStatus(evidence),
    };
  } finally {
    payer.dispose();
    commitment.dispose();
  }
}

async function verifyAnchor(body) {
  const receiptHash = normalizeReceiptHash(body?.receiptHash);
  const commitmentKeypair = deriveCommitmentKeypair(receiptHash);
  try {
    const expectedCommitment = commitmentKeypair.publicKey.toString();
    if (String(body?.commitmentAddress || "") !== expectedCommitment) {
      throw new Error("Commitment address does not match the supplied receipt hash.");
    }
    const signatureText = String(body?.signature || "").trim();
    const signature = Signature.fromBytes(decodeSignatureText(signatureText));
    const sender = PublicKey.fromBytes(decodePublicKeyText(body?.sender));
    const senderBefore = BigInt(body?.senderBeforeKelvin);
    const commitmentBefore = BigInt(body?.commitmentBeforeKelvin);
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));
    const [transaction, history, senderAfterRaw, commitmentAfterRaw, blockHeight] = await Promise.all([
      client.getTransaction(signature).catch(() => null),
      client.getSignaturesForAddress(sender).catch(() => []),
      client.getBalance(sender),
      client.getBalance(commitmentKeypair.publicKey),
      client.getBlockHeight().catch(() => null),
    ]);
    const senderAfter = BigInt(senderAfterRaw);
    const commitmentAfter = BigInt(commitmentAfterRaw);
    const indexed = transactionVisible(transaction) || historyHasSignature(history, signatureText);
    const stateConfirmed = senderAfter <= senderBefore - ANCHOR_KELVIN && commitmentAfter >= commitmentBefore + ANCHOR_KELVIN;
    return {
      ok: true,
      receiptHash,
      commitmentAddress: expectedCommitment,
      signature: signatureText,
      sender: sender.toString(),
      senderBeforeKelvin: senderBefore.toString(),
      senderAfterKelvin: senderAfter.toString(),
      commitmentBeforeKelvin: commitmentBefore.toString(),
      commitmentAfterKelvin: commitmentAfter.toString(),
      transferKelvin: ANCHOR_KELVIN.toString(),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
      ...anchorStatus({ indexed, stateConfirmed }),
    };
  } finally {
    commitmentKeypair.dispose();
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: { message: "Same-origin request required." } });
  if (req.headers["x-rewind-anchor"] !== ANCHOR_VERSION) {
    return send(res, 400, { ok: false, error: { message: "Anchor request header is missing." } });
  }

  try {
    if (req.body?.intent === "anchor-receipt") {
      const retryAfter = enforceRateLimit(req);
      if (retryAfter > 0) {
        res.setHeader("retry-after", String(retryAfter));
        return send(res, 429, { ok: false, error: { message: `One anchor is allowed every 90 seconds. Try again in ${retryAfter}s.` } });
      }
      return send(res, 200, await createAnchor(req.body?.receiptHash));
    }
    if (req.body?.intent === "verify-anchor") {
      return send(res, 200, await verifyAnchor(req.body));
    }
    return send(res, 400, { ok: false, error: { message: "Unknown anchor intent." } });
  } catch (error) {
    console.error("receipt-anchor", error);
    return send(res, 502, { ok: false, error: { code: error?.code || "ANCHOR_FAILED", message: error?.message || "Receipt anchor failed." } });
  }
}
