# Rialo Rewind

Native compensation and recovery for real-world workflows on Rialo.

Rialo Rewind demonstrates how a multi-step workflow can stop after a downstream failure, retry safely, and execute compensating actions in reverse order. The v0.7 console combines a deterministic recovery engine with live Rialo devnet telemetry and a real signed devnet proof.

## What is real in v0.7

- Live Rialo devnet block-height check through the official `@rialo/ts-cdk` transport in a restricted Vercel function.
- Public-address balance lookup and recent-activity query.
- A server-side ephemeral Rialo keypair generated per proof run.
- A confirmed devnet faucet request followed by a signed 0.001 RLO transfer.
- A real transaction signature and explorer link returned only after confirmation.
- Deterministic forward and compensation execution state machine.
- Retry ceiling, idempotent recovery policy, event stream, inspector, and portable receipt.

## Security boundary

The signed-proof function uses disposable devnet-only keypairs. They exist in memory for one request, are disposed in `finally`, and are never returned to the browser. No seed phrase or private key is stored.

The recovery flow itself remains a deterministic product engine in v0.7. The next milestone is a dedicated deployed Rialo recovery registry/program that anchors workflow receipts and compensation state onchain.

## Local checks

```bash
npm test
npm run check
```

Live RPC and signed proof require a Vercel deployment.

## v0.7 fix

The previous health check sent a hand-written JSON-RPC payload and the devnet node returned HTTP 400. v0.7 routes the check through Rialo's official TypeScript CDK, matching the same transport used by the signed-proof function.

## v0.7 reliability fix

The signed proof no longer relies on the CDK's short default confirmation timeout. It submits the faucet request, waits for the funded balance, submits the signed transfer, and polls transaction visibility separately. If indexing is slow, the UI still returns the real submitted signature and links it to Rialo Explorer instead of reporting a false failure.
