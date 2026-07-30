# Architecture

## Browser layer

`src/app.js` controls the workflow console and its deterministic demo execution. It does not claim that local trace IDs are Rialo signatures.

`src/rialo/devnet-panel.js` renders live network and public-account data. It talks only to the same-origin `/api/rialo` endpoint.

## RPC boundary

`api/rialo.js` is a restricted read-only proxy. It only forwards an explicit allowlist of Rialo JSON-RPC methods, applies a timeout, and never accepts private keys or transaction signing material.

## Recovery model

The order workflow executes five forward actions:

1. Reserve inventory
2. Lock escrow
3. Create merchant order
4. Create shipment
5. Settle payment

If shipment creation reaches the retry ceiling, Rewind executes the compensation stack in reverse order:

1. Refund escrow
2. Cancel merchant order
3. Release inventory

The implementation models compensating transactions, not historical rollback. Every compensation is a new action that restores business state.
