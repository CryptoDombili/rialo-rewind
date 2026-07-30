# Security

- Never paste a seed phrase or private key into Rialo Rewind.
- Public account lookup is read-only.
- The signed proof creates disposable devnet-only keypairs inside one serverless request.
- Private key material is not logged, persisted, or returned to the browser.
- Both keypairs are disposed in a `finally` block.
- The proof endpoint accepts one fixed intent and no transaction parameters from the user.
- Amounts are hard-coded to 0.05 RLO faucet funding and a 0.001 RLO transfer.
- The existing RPC proxy uses an allowlist of read-only methods.


## Receipt anchor limitations

The R1.1 commitment address is deterministically derived from public receipt data. It is not a custody address and must never hold valuable funds. The demo transfers only a small devnet amount. The value of the mechanism is the permanent transaction reference and deterministic hash-to-address binding, not control of the recipient key.
