# Rialo Rewind R1.1

Native compensation and recovery engine for real-world workflows on Rialo.

R1.1 connects the interface to a real server-side state machine. The clean and controlled-failure flows are executed inside `/api/workflow`; the browser only replays the events returned by that execution.

## What is real

- Rialo devnet telemetry and signed transaction proof
- Server-side forward workflow execution
- Three-attempt courier failure boundary
- Reverse compensation in `refund → cancel → release` order
- Workflow-scoped idempotency keys
- Before/after business state
- Portable receipt v2 with SHA-256 integrity hash
- Vercel API security checks and rate limiting

## Honest boundary

The workflow adapters are server-side sandbox business systems, not third-party production merchant/courier APIs. The receipt is integrity-hashed but is not yet anchored to a dedicated Rialo receipt registry program. That is the next milestone.

## Commands

```bash
npm test
npm run check
```


## R1.1 receipt anchoring

After a server workflow issues a SHA-256 receipt hash, the operator can anchor that hash to Rialo devnet. The anchor endpoint domain-separates the receipt hash, derives a deterministic commitment address, and submits a small devnet transfer to that address. Verification recomputes the address from the receipt hash and checks transaction-index or account-state evidence. This is a hash commitment, not a general-purpose memo program.
