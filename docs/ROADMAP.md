# Roadmap

## Completed in R1.4.3

- Server-side recovery state machine
- Clean and controlled-failure paths
- Retry ceiling and reverse compensation
- Idempotency keys and portable receipts
- Rialo signed proof and receipt-hash anchoring
- Public receipt verifier and tamper challenge
- Shareable verification summary/report
- Public-demo documentation and regression checks

## Next technical milestone

A dedicated Rialo receipt registry/program that stores typed receipt commitments and exposes first-class lookup semantics. This should be treated as a separate protocol milestone, not silently represented as part of R1.4.3.

## Production integrations

- External inventory adapter
- External merchant/order adapter
- External courier adapter
- Production escrow and authorization policy
- Persistent execution storage and observability
- Authentication, tenancy, and operator permissions
