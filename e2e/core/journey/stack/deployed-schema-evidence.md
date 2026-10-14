# J1 B2/A6 deployed-schema repair — offline evidence

Source: `/Users/paulslee/olumi-work/recovery/bA/olumi-assistants-service`.
The deployment target is the user-supplied CEE 50530b5f census; no network was used.
All paths below are relative to that CEE checkout unless prefixed `stack/`.

## Cause

`stack/merge-migrations.mjs:56` sorts both repositories and pre-shims by timestamp.
DGAI has no definition of these four functions. Reordering the existing migrations
cannot produce the required pre-B2 or pre-A6 hashes.

- v4's last pre-B2 definition is
  `supabase/migrations/20260806120000_v5_turn_fence_first_write_exemption.sql:146`.
  Its body differs from the deployed pre-B2 body only by full-line comments.
- Guidance's last pre-A6 definition is
  `supabase/migrations/20261004142707_agent_guidance_answer_history.sql:8`.
  It accepts only empty handler facts; the deployed fixture adds the Run-delivery
  fact gate. This is a functional difference, not merely formatting or an ACL error.
- Offers' last definition is
  `supabase/migrations/20261006230000_agent_answer_offers.sql:12`. It already matches.
- If-latest's last pre-A6 definition is
  `supabase/migrations/20261007090000_agent_answer_conditional_append.sql:22`.
  Its deployed fixture differs only by full-line comments.

The only migration adding `evaluated_scenario_revision` is B2 at
`supabase/migrations/20261009160000_b2_fact_evaluated_revision.sql:19`.
STEP 1 explicitly commits at line 22, before the failing body guard at line 37.
`stack/apply-migrations.sh:47` first invokes psql with `--single-transaction`;
B2's own COMMIT ends that transaction. After the later guard fails,
`stack/apply-migrations.sh:75` retries the whole file. STEP 1 therefore attempts
to add the already-committed column again. This explanation follows the runner
and SQL transaction boundaries and the supplied error log; it was not re-executed
in this sandbox. The repair targets a fresh stack, not rerunning migrations on
the existing partially migrated database.

## Exact body hashes

Computed with `hashlib.md5(body.encode('utf-8')).hexdigest()`. `body` is exactly
between `AS $$` and `$$;`, or the matching `$function$` delimiters, including its
leading/trailing newlines. Lengths below are characters, as in PostgreSQL `length`.
Comments were retained when hashing. Comment removal was used only for a separate
diff confirming the two comment-only differences above.

| CEE migration candidate | Function | MD5 | Length |
| --- | --- | --- | ---: |
| `20260731130000_v5_turn_fence_atomic_append.sql:124` | v4 | `5b8820cac6acbafa336e635bf07cb6f4` | 5145 |
| `20260802120000_v5_turn_fence_atomic_append_generation_key.sql:82` | v4 | `f1fd169537ac319cd6bf71f411cc5e43` | 5508 |
| `20260806120000_v5_turn_fence_first_write_exemption.sql:146` | v4 | `8cfc5f6c24810517e250125020915547` | 7888 |
| `20261004142707_agent_guidance_answer_history.sql:8` | guidance | `9800e1937c6cf9aa028f1f0fe2dd7287` | 3337 |
| `20261006230000_agent_answer_offers.sql:12` | offers | `ea9988e21459581bdf18097534a6e373` | 3623 |
| `20261007090000_agent_answer_conditional_append.sql:22` | if-latest | `e994d7ada7edab2b933fc610976321bc` | 2377 |
| `20261009160000_b2_fact_evaluated_revision.sql:42` | v4, post-B2 | `e43eadabab6f416561497c35815d2860` | 5386 |
| `20261010010000_a6_guidance_entry_variant_slot.sql:54` | guidance, post-A6 | `bb1b2328d1e665311d96fa78e42e23df` | 4978 |

All candidate paths in this table are under `supabase/migrations/`.

| Exact pre-migration source on disk | Function | MD5 | Length |
| --- | --- | --- | ---: |
| `supabase/migrations/rollback/20261009160000_b2_fact_evaluated_revision_rollback.sql.do-not-apply:46` | v4 | `db7bdbe3e2052237c623d8c5477a96e5` | 4856 |
| `scripts/phase2/fixtures/a6-live-with_guidance.sql:4` | guidance | `9bc227a08d12cc216c9365f668fb6709` | 4204 |
| `scripts/phase2/fixtures/a6-live-if_latest.sql:4` | if-latest | `7d038f624e222134c7ac58c8db79281e` | 1994 |
| `scripts/phase2/fixtures/a6-live-with_offers.sql:4` | offers | `ea9988e21459581bdf18097534a6e373` | 3623 |

## Changes and checks

- `hosted-drift-pre/20261009155959_j1_drift_pre_b2_v4.sql` copies only the
  rollback's v4 definition, preserving body bytes. It does not execute the rollback
  or drop/create the revision column.
- `hosted-drift-pre/20261010005959_j1_drift_pre_a6_guidance.sql` copies guidance and
  if-latest from the fixtures, changing only CREATE to CREATE OR REPLACE and
  retaining their owner/ACL statements. Offers is asserted without replacement.
- Both shims assert the original migration hashes before replacement and the exact
  deployed hashes afterwards. The existing runner executes each shim atomically
  and stops on a shim failure. The original B2/A6 guards remain unchanged.
- `schema-assert.sql` (CTE `deployed`) pins all four supplied post-migration hashes
  and lengths. A body row runs only for a function the pre-shim commented
  `j1:deployed-parity` (CTE `parity`), so a missing, re-created or re-commented
  function drops its row; it does not report a FAIL by itself. A separate REQUIRED
  row counts the body rows: 4 when the migration ledger
  (`supabase_migrations.schema_migrations`, written by `apply-migrations.sh`) holds
  both B2 `20261009160000` and A6 `20261010010000`, otherwise 0. A dropped row, or a
  tuple carrying only one of the two, fails that count.
- Neither the migration merge nor `expected-partials.tsv` was changed.

Offline validation passed: 162 merged files; each shim precedes its guarded
migration; all three copied definitions equal their source definitions byte for
byte (apart from CREATE OR REPLACE for the two A6 fixtures); pre-B2 and pre-A6
source states satisfy the required body hashes; all four final source definitions
match the supplied production hashes. `node --check`, `bash -n`, and
`git diff --check` passed.

## Unverified

No needed body is missing or invented. The original mechanism/date of the hosted
changes is not established by these files. A fresh PostgreSQL execution, runtime
ACLs, and X7's database verdict remain unverified: access to the local Docker
socket was denied (`connect: operation not permitted`), and no standalone
PostgreSQL tools were found in the checked local installation paths. No Docker
permission workaround, network access, or sealed-path reads were attempted.
