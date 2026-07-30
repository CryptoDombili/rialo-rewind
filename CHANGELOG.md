# Changelog

## R1.4.4 — Signal sky and collision-free diagnostics

- Rebuilt the ambient starfield as a denser, irregular Rialo telemetry sky.
- Moved the 503 failure gate into the empty channel between compensation nodes.
- Tightened workflow cards without reducing their typography.
- Preserved all R1.4.2 workflow, anchor, verifier, report and tamper behavior.

## R1.4.2 — Operations sky and failure-gate polish

- Added a restrained, Rialo-themed animated starfield behind the workflow grid.
- Repositioned the HTTP 503 failure diagnostic so its text is never hidden beneath the shipment node.
- Added a lower safe area for compensation and telemetry labels on 1080p and 2K displays.
- Preserved all R1.4.1 workflow, anchoring, verifier, report, and tamper-detection behavior.

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
- Rewrote README and demo/security documentation to match the real R1.4 boundary.

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
