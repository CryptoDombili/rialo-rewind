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

function send(res, status, body) {
  res.status(status);
  res.setHeader("cache-control", "no-store");
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return send(res, 405, { ok: false, error: { message: "POST required." } });
  }
  if (req.body?.intent !== "signed-devnet-proof") {
    return send(res, 400, { ok: false, error: { message: "Unknown proof intent." } });
  }

  const started = Date.now();
  const sender = Keypair.generate();
  const recipient = Keypair.generate();

  try {
    const client = createRialoClient(getDefaultRialoClientConfig("devnet"));

    await client.requestAirdropAndConfirm(sender.publicKey, AIRDROP_KELVIN);
    const balanceBefore = await client.getBalance(sender.publicKey);
    const configHashPrefix = await client.getConfigHashPrefix();

    const instruction = transferInstruction(sender.publicKey, recipient.publicKey, TRANSFER_KELVIN);
    const transaction = TransactionBuilder.create()
      .setPayer(sender.publicKey)
      .setValidFrom(BigInt(Date.now()))
      .setConfigHashPrefix(configHashPrefix)
      .addInstruction(instruction)
      .build();

    const signed = transaction.sign(sender);
    const signature = await client.sendTransaction(signed.serialize());
    await client.confirmTransaction(signature);

    const [balanceAfter, blockHeight] = await Promise.all([
      client.getBalance(sender.publicKey),
      client.getBlockHeight().catch(() => null),
    ]);

    return send(res, 200, {
      ok: true,
      network: "rialo:devnet",
      sender: sender.publicKey.toString(),
      recipient: recipient.publicKey.toString(),
      signature: signature.toString(),
      balanceBefore: formatRlo(balanceBefore),
      balanceAfter: formatRlo(balanceAfter),
      transfer: formatRlo(TRANSFER_KELVIN),
      blockHeight: blockHeight === null ? null : blockHeight.toString(),
      durationMs: Date.now() - started,
    });
  } catch (error) {
    console.error("signed-proof", error);
    return send(res, 502, { ok: false, error: { message: errorMessage(error) }, durationMs: Date.now() - started });
  } finally {
    sender.dispose();
    recipient.dispose();
  }
}
