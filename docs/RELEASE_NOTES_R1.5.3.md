# Rialo Rewind R1.5.3

Rialo Rewind is an open-source native compensation and recovery engine for real-world workflows on Rialo.

## Highlights

- Clean five-step settlement path
- Controlled HTTP 503 courier failure with a three-attempt retry ceiling
- Reverse compensation in `refund → cancel → release` order
- Workflow-scoped idempotency keys and before/after business state
- Portable SHA-256 receipt JSON
- Real Rialo devnet receipt-hash commitment transaction
- Browser-local receipt verification
- Deterministic `VALID` and `TAMPERED` verification paths
- Copyable verification summary and downloadable public report

## Validation

- 31/31 automated tests passed
- JavaScript syntax checks passed
- Static production smoke check passed
- Production regression completed: `SETTLED → COMPENSATED → ANCHORED → VALID → TAMPERED`

## Live links

- Live demo: https://rialo-rewind.vercel.app
- Source: https://github.com/CryptoDombili/rialo-rewind

## Honest boundary

Inventory, escrow, merchant, and courier integrations are controlled server-side sandbox adapters used to demonstrate recovery semantics. The workflow state machine, receipts, hashes, Rialo devnet transaction, and public verification are real. The anchor is a real Rialo devnet transfer to a receipt-hash-derived commitment address, not a dedicated registry program.
