# Security

- Never paste a seed phrase or private key into Rialo Rewind.
- Public account lookup is read-only.
- The signed proof creates disposable devnet-only keypairs inside one serverless request.
- Private key material is not logged, persisted, or returned to the browser.
- Both keypairs are disposed in a `finally` block.
- The proof endpoint accepts one fixed intent and no transaction parameters from the user.
- Amounts are hard-coded to 0.05 RLO faucet funding and a 0.001 RLO transfer.
- The existing RPC proxy uses an allowlist of read-only methods.
