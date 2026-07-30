# Rialo Rewind

Native compensation and recovery for real-world workflows on Rialo.

Rialo Rewind demonstrates how a multi-step workflow can stop after a downstream failure, retry safely, and execute compensating actions in reverse order. The v0.5 console combines a deterministic recovery engine with live Rialo devnet telemetry and a real signed devnet proof.

## What is real in v0.5

- Live Rialo devnet block-height probe through a restricted Vercel RPC function.
- Public-address balance lookup and recent-activity query.
- A server-side ephemeral Rialo keypair generated per proof run.
- A confirmed devnet faucet request followed by a signed 0.001 RLO transfer.
- A real transaction signature and explorer link returned only after confirmation.
- Deterministic forward and compensation execution state machine.
- Retry ceiling, idempotent recovery policy, event stream, inspector, and portable receipt.

## Security boundary

The signed-proof function uses disposable devnet-only keypairs. They exist in memory for one request, are disposed in `finally`, and are never returned to the browser. No seed phrase or private key is stored.

The recovery flow itself remains a deterministic product engine in v0.5. The next milestone is a dedicated deployed Rialo recovery registry/program that anchors workflow receipts and compensation state onchain.

## Local checks

```bash
npm test
npm run check
```

Live RPC and signed proof require a Vercel deployment.
