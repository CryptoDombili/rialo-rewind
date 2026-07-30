# Architecture

## Browser

- `index.html` and `src/styles/app.css`: industrial recovery console.
- `src/app.js`: deterministic forward/failure/compensation state machine.
- `src/rialo/devnet-panel.js`: live block and public-account queries.
- `src/rialo/signed-proof.js`: signed-proof UI state and result rendering.

## Vercel functions

- `api/rialo.js`: allowlisted read-only JSON-RPC proxy.
- `api/proof.js`: fixed devnet proof runner. It creates disposable keypairs, requests faucet funds, signs a transfer, waits for confirmation, returns public proof fields, then disposes key material.

## Next onchain layer

The dedicated recovery registry program will persist receipt hashes and compensation results. The local state machine will remain deterministic and will submit only the final proof envelope onchain.
