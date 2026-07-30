# Rialo Rewind — 2 Minute Demo Script

## Shot plan

- 0:00–0:12 — Product overview
- 0:12–0:28 — Clean settlement
- 0:28–0:58 — Controlled failure and retries
- 0:58–1:20 — Reverse compensation
- 1:20–1:37 — Rialo receipt anchor
- 1:37–1:51 — Valid public verification
- 1:51–2:00 — Tamper rejection and close

## Narration

Rialo Rewind is an open-source compensation and recovery engine for real-world workflows on Rialo.

This console models a five-step order flow: reserve inventory, lock escrow, create the order, create the shipment, and settle payment. A clean execution completes every forward action and produces a settled receipt.

The more important path is failure recovery. Here I inject a controlled courier outage. Shipment creation retries three times, then forward execution stops at the failure boundary.

Rewind now restores business state in reverse order. It refunds the protected escrow, cancels the order, and releases the reserved inventory. Each recovery action uses a workflow-scoped idempotency key, so repeated execution cannot duplicate the external effect. The final result is a compensated receipt with retries, refund data, event history, and a before-and-after state record.

Next, the receipt is hashed with SHA-256 and its hash is committed through a real Rialo devnet transaction. The application records the commitment and anchor transaction as public evidence.

Anyone can export the receipt and verify it without trusting the application server. The verifier recomputes the hash locally in the browser, binds it to the Rialo anchor, confirms finality, and returns valid.

Finally, the tamper challenge changes a protected refund field. The hash no longer matches, anchor verification is blocked, and the altered receipt is rejected before any chain query.

Rialo Rewind shows how deterministic compensation, portable receipts, and public Rialo verification can make failed real-world workflows recoverable and auditable.

## Recording notes

- Record at 1080p or 2K.
- Keep browser zoom at 100%.
- Use a fresh exported anchored receipt for the verifier segment.
- Pause briefly on `SETTLED`, `COMPENSATED`, `ANCHORED`, `VALID`, and `TAMPERED`.
- Do not claim that the sandbox adapters are production commerce integrations.
