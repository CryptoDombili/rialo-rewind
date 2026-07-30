# Rialo Rewind

Native compensation and recovery for real-world workflows on Rialo.

Rialo Rewind demonstrates how a multi-step workflow can stop after a downstream failure, retry safely, and execute compensating actions in reverse order. The v0.9 console combines a deterministic recovery engine with live Rialo devnet telemetry and a real signed devnet transfer.

## What is real in v0.9

- Live Rialo devnet block-height check through the official `@rialo/ts-cdk` client.
- A disposable server-side Rialo keypair generated for each proof run.
- A devnet faucet request followed by a signed 0.001 RLO system transfer.
- A real base58 transaction signature.
- Transaction-index verification through `getTransaction` and sender history.
- Account-state verification through the sender debit and the unique recipient credit when the devnet transaction index lags.
- Deterministic forward and compensation execution state machine.
- Retry ceiling, idempotent recovery policy, event stream, inspector, and portable receipt.

## Honest verification states

- `CONFIRMED`: Rialo's transaction index or sender history exposes the submitted signature.
- `STATE VERIFIED`: the disposable recipient received the transfer and the sender was debited, while transaction indexing is still delayed.
- `SUBMITTED`: a signature was returned but neither verification path is visible yet.

The UI never labels a merely submitted transaction as confirmed.

## Security boundary

The signed-proof function uses disposable devnet-only keypairs. They exist in memory for one request, are disposed in `finally`, and are never returned to the browser. No seed phrase or private key is stored.

The recovery flow itself remains a deterministic product engine in v0.9. The next milestone is a dedicated Rialo recovery registry/program that anchors workflow receipts and compensation state onchain.

## Local checks

```bash
npm test
npm run check
```

Live RPC and signed proof require a Vercel deployment.

## v0.9 verification upgrade

- Keeps the base58 signature fix from v0.8.
- Checks `getTransaction` and `getSignaturesForAddress` for index-level confirmation.
- Falls back to sender and recipient account-state evidence instead of leaving an executed transfer stuck on `SUBMITTED`.
- Labels the fallback precisely as `STATE VERIFIED`, not transaction-index confirmation.
