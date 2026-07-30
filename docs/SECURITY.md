# Security Model

## Protected properties

- Receipt integrity is checked with SHA-256 in the browser.
- Receipt-to-anchor binding is recomputed from the receipt hash.
- Altered receipts are rejected before Rialo is queried.
- Workflow actions use execution-scoped idempotency keys.
- API routes require same-origin requests and version headers.
- Responses use `no-store` and `nosniff`; expensive write paths are rate-limited.
- Signed-proof and anchor keys are disposable devnet-only keys and are disposed server-side.

## Privacy

The public verifier does not upload the full receipt. It sends only public anchor evidence needed for read-only verification. Verification reports contain public proof metadata, not private keys.

## Non-goals

- R1.5.1 is not a custody system.
- It is not connected to production commerce providers.
- It does not replace authorization, authentication, audit retention, or compliance controls.
- The hash-derived commitment transfer is not a dedicated Rialo registry program.
