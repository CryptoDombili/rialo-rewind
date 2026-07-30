# Rialo Rewind Submission Copy

## One-line description

Rialo Rewind is an open-source compensation engine that restores business state after multi-step workflow failures and anchors verifiable recovery receipts on Rialo devnet.

## Short description

Rialo Rewind demonstrates how a real-world workflow can settle normally or recover safely after a downstream failure. It retries a courier action three times, stops forward execution, compensates completed effects in reverse order, produces a SHA-256 receipt, anchors the receipt on Rialo devnet, and lets anyone verify or reject it locally.

## Full description

Rialo Rewind is a server-side recovery engine for multi-step real-world workflows. The demo models inventory reservation, escrow locking, order creation, shipment creation, and payment settlement.

A clean run completes all five steps and issues a `SETTLED` receipt. In the controlled failure path, shipment creation returns HTTP 503 three times. Rewind then stops forward execution and compensates completed business effects in reverse order: refund the protected escrow, cancel the order, and release inventory. The result is a `COMPENSATED` receipt with workflow-scoped idempotency keys, event history, retries, refund data, and before/after business state.

The receipt is hashed locally with SHA-256 and its hash is committed through a real Rialo devnet transaction. The public verifier recomputes the receipt hash in the browser, checks its anchor evidence against Rialo, and returns `VALID` for unchanged data. A deterministic tamper challenge changes a protected field and is rejected as `TAMPERED` before any chain query.

The application is open source and does not require a browser wallet. Disposable devnet keys remain server-side; no seed phrase or private key reaches the browser.

## Links

- Live demo: https://rialo-rewind.vercel.app
- GitHub: https://github.com/CryptoDombili/rialo-rewind

## Honest boundary

Inventory, escrow, merchant, and courier adapters are controlled sandbox systems for demonstrating recovery semantics. They are not production commerce integrations. The Rialo receipt anchor and public verification are real.
