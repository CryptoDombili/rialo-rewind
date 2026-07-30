# Rialo Rewind

**Native compensation and recovery for real-world workflows.**

Rialo Rewind demonstrates how a multi-step workflow can stop after a downstream failure, retry safely, and execute compensating actions in reverse order. The v0.4 console combines a deterministic local recovery engine with live Rialo devnet telemetry.

## What is real in v0.4

- Live Rialo devnet block-height probe through a restricted Vercel RPC function.
- Public-address balance lookup and recent-activity query.
- Deterministic forward and compensation execution state machine.
- Retry ceiling, idempotent recovery policy, event stream, inspector, and portable receipt.
- No fake wallet connection, fake signature, or fake onchain transaction.

## What comes next

The next milestone is a signed Rialo devnet transaction and then a deployed recovery registry/program. Until that is complete, the console clearly separates local workflow execution from live chain proof.

## Local use

Open `index.html` through a local static server. The UI works locally, but live devnet telemetry requires the Vercel `/api/rialo` function.

## Tests

```bash
npm test
npm run check
```

## Security

Only public account addresses are accepted in the devnet panel. Never paste a seed phrase or private key into the application.
