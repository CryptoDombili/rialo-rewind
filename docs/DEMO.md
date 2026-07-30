# R1.5 Demo Checklist

## Before recording

- Open the production URL at 1080p or 2K.
- Confirm the lower-left build label is `R1.5`.
- Confirm Rialo devnet shows a live block height.
- Keep one exported anchored receipt ready for the verifier segment.
- Use a fresh browser refresh before recording.

## Recommended sequence

1. **Clean path** — run `RUN CLEAN FLOW`; show five completed nodes and `SETTLED`.
2. **Failure path** — reset and run `INJECT FAILURE`; show three `503` attempts at step 04.
3. **Reverse recovery** — show `refund → cancel → release` and `COMPENSATED`.
4. **Receipt** — point out retries, refund, engine version, receipt hash, and business-state restoration.
5. **Rialo anchor** — anchor the receipt and show commitment, transaction, and confirmation.
6. **Public verifier** — load the exported JSON and show four green stages plus `VALID`.
7. **Tamper challenge** — run the simulated edit and show `MISMATCH`, `BLOCKED`, `NOT QUERIED`, and `TAMPERED`.
8. **Share proof** — use `COPY SUMMARY` or `DOWNLOAD REPORT`.

## Honest narration boundary

Say that the recovery adapters are controlled server-side sandbox systems. The workflow state machine, receipts, hashes, Rialo devnet transaction, and public verification are real. Do not describe the anchor as a dedicated registry smart contract.

Do not claim the app needs or controls a user wallet. The browser never receives a private key.
