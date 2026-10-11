# J1 fixtures (Recovery Batch 0, DL, 11 Oct 2026)

## State at this commit
- **Pin:** `tuple.json` is the **8 Oct pin** (CEE `b33222d4`, PLoT `5a1c2032`, ISL `87a031f7`, recorded with UI `68a03f7f`). The 26 recordings in `llm/` belong to it, and Required J1 replays them unchanged.
- **The two new cases,** `J1 positive` and `J1 refusal`, are `test.fixme`. They have no recordings on this pin.
- **Batch A** (CLAUDE.md §7.3, as amended 11 Oct):
  - moves `tuple.json` to its candidate combination;
  - re-records on it;
  - turns both cases live.

  Batch 0 does not certify the deployed combination; a pinned replay never certifies a new one (§7.7).

## What Batch 0 changed in the harness
- **`stack/apply-migrations.sh`:** CEE `20261009010100` uses `CREATE INDEX CONCURRENTLY` (SQLSTATE 25001 inside a transaction), so that file alone is retried strictly without the wrapper. A retried file is still reported OK.
- **Schema parity with production:** after the migrations, the B2 and A6 guarded functions must equal production's bodies (see `stack/` and `schema-assert.sql`). They are not listed as expected partials.
- **`stack/record-local.sh`:** reads Render environment variables page by page through the cursor (at most 20 pages; the cursor must move; it fails closed without printing the key).

## Authorised recording route (DL decision, 11 Oct)
Paul's 5 Oct rule is that no provider key goes into any GitHub field, so recording runs **on the Mac, run by the DL**:
- once per batch, after the candidate is frozen;
- with Docker up and load below 45.

```sh
J1_TUPLE=pinned J1_RECORD_MODE=record J1_MAX_CALLS=150 J1_REC_DIR=/private/tmp/j1-<batch> \
  bash e2e/core/journey/stack/record-local.sh
```

Set `tuple.json` to the candidate's 40-character SHAs first.
- **Bank** only if J1 passed, the ledger shows no `upstream_error` or `rate_limited`, `scan-recordings.sh` is clean, and the migration step's X7 is listed.
- A further capture is allowed only for a reviewed change to what is sent. Failed evidence is kept.

## Evidence kept outside the repository
- **The 11 Oct record run on CEE 50530b5f** (local schema NOT production's: B2 and A6 refused; X7 unlisted). Recordings and logs are under `~/olumi-work/recovery/b0/j1-new-recordings-20261011/` and `/private/tmp/j1-b0-current/logs/`.
- **That run's J2b failure** (goal figures withheld; 7 leader-dependent keys absent) is NOT used as acceptance evidence, because its schema differed from production's.
