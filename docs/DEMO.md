# R1.4.4 Demo Checklist

## Before recording

- Open the production URL at 1080p or 2K.
- Confirm the lower-left build label is `R1.4.4`.
- Confirm Rialo devnet displays a live block height.
- Keep one exported anchored receipt ready for the verifier segment.

## Recommended sequence

1. **Clean path** — run `RUN CLEAN FLOW`; show five completed nodes and `SETTLED`.
2. **Failure path** — reset and run `INJECT FAILURE`; show three `503` attempts and reverse recovery.
3. **Receipt** — point out retries, refund, server engine, hash, and `COMPENSATED`.
4. **Rialo anchor** — anchor the receipt and show commitment, transaction, and confirmation.
5. **Public verifier** — load the exported JSON and show all four green stages plus `VALID`.
6. **Tamper challenge** — run the simulated edit and show `MISMATCH`, `BLOCKED`, `NOT QUERIED`, and `TAMPERED`.
7. **Share proof** — use `COPY SUMMARY` or `DOWNLOAD REPORT`.

## Honest narration boundary

Say that the recovery adapters are controlled server-side sandbox systems. The workflow state machine, receipts, hashes, Rialo devnet transaction, and public verification are real. Do not describe the anchor as a dedicated registry smart contract.
