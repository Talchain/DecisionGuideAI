This is a dry run of `copy_guest_scenario` on PGlite (Postgres running in-process). It never touches Supabase.

- `setup.sql` mirrors the live `scenarios` table (columns, defaults, CHECK constraints, self-FK, trigger; read 1 Oct 2026) and Supabase's default ACL, which grants EXECUTE on every new public function to anon, authenticated and service_role. So a migration that forgot its REVOKE would be callable here, as it would be live.
- The guest fixture is shaped like what the guest turn path leaves: a graph, the brief, the CAS hash, a Run (analysis columns, CEE's analysis brief, events, a model version) and turn + fact rows.
- Every row binds to exact ids, SQLSTATE + message, or whole-row tuples. The script exits 1 if any row fails or no migration is given.

```bash
cd supabase/tests/guest-copy && npm i --no-save @electric-sql/pglite@0.2
node run.mjs ../../migrations/20261001222932_copy_guest_scenario_20261001.sql   # 18/18
```

| Row | Claim |
|---|---|
| C1, C1b | The owner copy is a new row owned by the caller. It carries `graph` and `title` only (DL condition 1). C1 reads EVERY column, so anything else copied by mistake turns it red: every other column is at its never-run default (stage `frame`, status `none`, hash anchor NULL). No turns, no facts. |
| C2, C2b | The guest original is byte-unchanged (whole row), and its turns and facts stay unowned. |
| C3 | A second call returns the same copy id (`created: false`), and there is one row. |
| C4 | An owned source is refused (`CG409`) and nothing is written. It runs in the same suite as the guest-source success C1 (DL condition 4). |
| C5, C5b | anon and authenticated cannot call it. Only service_role (CEE, after verifying the JWT) can. |
| C6–C8 | Typed refusals: an id that is not an auth user (`22023`), an absent source (`CG404`), a guest source with no model (`CG422`). |
| C9 | A second user gets their own copy; the first copy is unchanged. |
| C10 | SECURITY DEFINER, `search_path=''`, EXECUTE = {postgres, service_role}. |
| C11, C11b | A caller's TEMP `scenarios` table cannot shadow `public.scenarios`: on a replay (C11), or on a FRESH copy whose source the TEMP table claims is owned (C11b, which reaches the source SELECT and the INSERT). |
| C13, C13b | A source graph over the 1 MiB cap is refused (`CG413`) and nothing is written; just under the cap copies (DL condition 3). |
| C12 | Exactly the expected rows were written in the whole run (3 copies + C11b's source + its copy). |

Mutants, each applied to the migration on its own:

| Mutant | Rows it turns RED |
|---|---|
| Owned-source check removed | C4, C12 |
| Idempotent lookup removed | C3, C11, C12 |
| REVOKE removed | C5, C5b, C10 |
| Claim instead of copy (ownership moves) | C2, C9, C11, C12 |
| `search_path = public` | C10 |
| auth-user check removed | C6, C12 |
| size cap removed | C13, C12 |
| the hash anchor copied | C1 |
| bare `scenarios` in the source SELECT + `search_path = public` | C10, C11b, C12 |

**Race (`race.mjs`, real Postgres).** PGlite has one connection, so concurrency runs on `embedded-postgres`. 8 sessions call the function at once, each in its own open transaction, with a `pg_sleep(0.3)` injected between the idempotent lookup and the INSERT to hold the window open. The control variant removes the advisory lock.

```bash
npm i --no-save embedded-postgres@17.6.0-beta.15 pg
node race.mjs ../../migrations/20261001222932_copy_guest_scenario_20261001.sql
# AS SHIPPED    {"ids":1,"created":1,"rows":1}
# LOCK REMOVED  {"ids":8,"created":8,"rows":8}
```

## v2: the copy carries the brief, name and conversation (S-G slice 2, 7 Oct 2026)

`run-v2.mjs` runs on `setup-v2.sql`. That file is `setup.sql` with the full `v5_conversation_turns` table: 20 columns, 5 CHECKs, the unique key and the scenario FK. The table is derived from CEE's migrations at CEE staging `d738949c`, not read from the live project. Before applying, the migration's PRE-CHECK lists the live columns for the DL to compare. `run.mjs` stays the record for v1.

Install PGlite in a directory that has its own `package.json`. In this directory, `npm i` walks up to the repo root and installs the whole app.

```bash
node run-v2.mjs ../../migrations/20261001222932_copy_guest_scenario_20261001.sql \
  ../../migrations/20261007120145_copy_guest_scenario_v2_carries_the_conversation_20261007.sql   # 25/25
node run-v2.mjs ../../migrations/20261001222932_copy_guest_scenario_20261001.sql                 # base (v1): 15/25, RED as designed
node run.mjs v1.sql v2.sql rollback.sql                                                           # rollback restores v1: 18/18
```

| Row | Claim |
|---|---|
| C1 | The copy carries `graph`, `title`, `framing` and `brief_text`, and is owned by the caller. Every other `scenarios` column is at its never-run default. |
| C14 | Every guest turn is copied and re-keyed: a new `id`, the copy's `scenario_id`, and the caller as `user_id`. Every kept column is byte-equal to its source row, matched by `turn_id`. |
| C15 | `pending_actions` becomes `[]`. `suggested_actions` and `suggested_actions_run_key` become NULL. The model-version markers become NULL. The source turn has all five set. |
| C16 | Claim markers (`%:claim`) are not copied, and the other 3 turns are. |
| C17 | No handler facts are copied, so the Run stays with the guest (control, as in v1). |
| C19 | Every copied turn is earlier than the copy's `created_at`. This is how the UI shows "From before you signed in". |
| C18 | A replay copies no turn twice. |
| C20 | A failure while inserting the turns rolls the whole copy back, so no scenario is left without its conversation. An injected trigger error proves this. |
| C21 | A second user's copy has its own turn rows. Mine are unchanged. |
| C22 | Column manifest: every turn column is classified as kept, re-keyed or reset (20 of 20). |
| C2–C13 | v1's rows, re-run. C2b covers every guest turn row, byte for byte. C11b also shadows `v5_conversation_turns` with a TEMP table. |

The mutants were each applied to the v2 file on its own; all were RED.

| Mutant | Rows it turns RED |
|---|---|
| `pending_actions` copied verbatim | C15 |
| Claim markers copied | C14, C16, C18, C19, C21, C12 |
| Turns keep the guest owner (NULL) | C14, C20, C21, C12 |
| Conversation not copied (v1 behaviour) | C14, C15, C16, C18, C19, C20, C21, C11b, C12 |
| `brief_text` not copied | C1 |
| `created_at` restamped with `now()` | C14, C19 |
| Run key carried | C15 |
| Idempotent lookup removed | C3, C12 |
| Unqualified turns table + `search_path = pg_temp, public` | C10, C11b, C12 |
