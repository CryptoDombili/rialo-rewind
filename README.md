# Rialo Rewind R1.2.2

Native compensation and recovery engine for real-world workflows on Rialo.

R1.2.2 combines the server-side recovery state machine, Rialo receipt anchoring, and public receipt verification. The clean and controlled-failure flows are executed inside `/api/workflow`; the browser only replays the events returned by that execution.

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


## R1.2.2 public receipt verifier

R1.2.2 adds a browser-side verifier for exported `rialo-rewind.receipt.v2` JSON files. The verifier:

- parses the receipt locally without uploading the full file,
- recomputes the SHA-256 receipt hash after excluding `receiptHash` and `onchainAnchor`,
- detects changed workflow fields or event history,
- checks that the anchor evidence binds the same receipt hash, and
- performs a read-only Rialo devnet verification through the existing anchor endpoint.

Possible results are `VALID`, `TAMPERED`, `PENDING`, `UNVERIFIED`, or `INVALID`.


## R1.2.2 verifier hotfix

- Cache-busted the browser entry assets.
- Routed the verifier launch through the central action controller.
- Isolated verifier, devnet, and signed-proof initialization so one module cannot block another.


## R1.2.2 verifier controls fix

R1.2.2 restores the Rialo anchor DOM fields required by the recovery console, initializes the verifier before the main console reset, and makes the verifier controls independently resilient. This prevents a missing optional panel field from disabling Load, Close, Reset, or drag-and-drop.
