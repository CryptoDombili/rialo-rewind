# R1.5.3 Release Checklist

## Repository

- [ ] Remove obsolete nested folders such as `rialo-rewind-r1.2-fixed`.
- [ ] Confirm `.env` and private keys are not committed.
- [ ] Confirm the root contains only current source, API, tests, scripts, docs, and config files.

## Automated checks

- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npm run smoke`

## Production checks

- [ ] Build label shows `R1.5.3`.
- [ ] Devnet block height loads.
- [ ] Clean flow reaches `SETTLED`.
- [ ] Failure flow reaches `COMPENSATED`.
- [ ] Receipt anchoring reaches `ANCHORED`.
- [ ] Original receipt verifies as `VALID`.
- [ ] Tamper challenge returns `TAMPERED` without a chain query.
- [ ] Summary copy and report download work.

## GitHub release

- [ ] Create tag `r1.5.3`.
- [ ] Create release title `Rialo Rewind R1.5.3`.
- [ ] Include live URL, demo summary, honest boundary, and test result.
