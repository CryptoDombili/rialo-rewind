# Security boundaries

- The application never asks for a seed phrase or private key.
- The v0.4 RPC proxy is read-only and method allowlisted.
- The workflow animation is explicitly local and deterministic.
- The UI must not label local trace IDs as Rialo transaction signatures.
- Signed actions will only be added through the official Rialo wallet integration.
- RPC errors are shown rather than replaced by fabricated success states.
