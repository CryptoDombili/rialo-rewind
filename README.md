# Rialo Rewind R1.4.4

Native compensation and recovery engine for real-world workflows on Rialo.

R1.4.4 is the polished public-demo release. It combines a server-side recovery state machine, portable SHA-256 receipts, real Rialo devnet receipt anchoring, public verification, deterministic tamper detection, and shareable verification reports.

## What is real

- Rialo devnet telemetry and signed transaction proof
- Server-side forward workflow execution through `/api/workflow`
- Three-attempt courier failure boundary
- Reverse compensation in `refund → cancel → release` order
- Workflow-scoped idempotency keys
- Before/after business state and event traces
- Portable `rialo-rewind.receipt.v2` JSON receipt
- SHA-256 receipt integrity hash
- Real Rialo devnet hash-derived commitment transaction
- Transaction-index or account-state anchor verification
- Browser-local public receipt verification
- Deterministic `VALID` and `TAMPERED` challenge paths
- Copyable verification summary and downloadable verification report
- Same-origin API checks, input validation, no-store responses, and rate limiting

## Honest boundary

The inventory, escrow, merchant, and courier adapters are controlled server-side sandbox systems built to demonstrate recovery semantics. They are not connected to third-party production commerce APIs. The anchor is a real Rialo devnet transfer to a receipt-hash-derived commitment address; it is not a dedicated Rialo registry program or memo instruction.

## Demo path

1. Run **RUN CLEAN FLOW** and inspect the `SETTLED` receipt.
2. Reset, run **INJECT FAILURE**, and watch three courier retries.
3. Confirm `refund → cancel → release` and `COMPENSATED`.
4. Click **ANCHOR RECEIPT** and wait for Rialo confirmation.
5. Export the receipt JSON.
6. Open **VERIFY**, load the receipt, and confirm `VALID`.
7. Run **TAMPER TEST** and confirm `TAMPERED` before any chain query.
8. Copy the verification summary or download the public verification report.

See [`docs/DEMO.md`](docs/DEMO.md) for the presenter checklist.

## Commands

```bash
npm test
npm run check
npm run smoke
```

## Structure

- `api/` — Vercel workflow, anchor, proof, and read-only verification endpoints
- `src/server/` — deterministic recovery engine
- `src/core/` — receipt, anchor, workflow, and verifier models
- `src/rialo/` — Rialo CDK clients and proof/anchor adapters
- `src/receipt-verifier.js` — browser-local verifier and report export
- `tests/` — model, engine, API contract, UI contract, and version tests
- `docs/` — architecture, security, roadmap, and demo guide

## Release

R1.4.4 freezes the visual system and public demo flow. Future work belongs in a dedicated Rialo registry/program milestone rather than further expanding this demo surface.
