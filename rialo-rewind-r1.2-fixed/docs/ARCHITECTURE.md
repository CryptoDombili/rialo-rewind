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


## R1.1 receipt commitment protocol (used by R1.2)

`/api/anchor` accepts a validated SHA-256 workflow receipt hash. It domain-separates the hash, derives a deterministic Rialo commitment address, and submits a small devnet system transfer to that address. The returned anchor record includes the transaction signature, commitment address, block height, and account-state evidence. Given the same receipt hash, the verifier derives the same commitment address and checks the transaction or balance delta.
