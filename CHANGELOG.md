# Changelog

## R1.4.1 — Tamper challenge hotfix

- Fixed an undeclared `integrity` variable in the browser tamper challenge.
- Preserved VALID verification, report download, and local-only privacy behavior.
- Added a regression contract test for the tamper handler.

## R1.4.1 — Final product polish

- Added copyable public verification summaries.
- Added downloadable `rialo-rewind.verification-report.v1` reports.
- Restored focus after modal close and improved live status semantics.
- Added reduced-motion behavior and 1080p/2K verifier action layouts.
- Added UI-contract, report-model, version-consistency, and production smoke checks.
- Rewrote README and demo/security documentation to match the real R1.4.1 boundary.

## R1.3 — Tamper challenge

- Added deterministic local receipt mutation test.
- Proved altered data is rejected before a Rialo query.

## R1.2 — Public verifier

- Added browser-local SHA-256 receipt verification.
- Added Rialo anchor binding and finality verification.

## R1.1 — Receipt anchoring

- Added real Rialo devnet commitment transactions for receipt hashes.

## R1.0 — Recovery engine

- Added server-side clean and controlled-failure workflows.
- Added retry ceilings, reverse compensation, receipts, and idempotency keys.
