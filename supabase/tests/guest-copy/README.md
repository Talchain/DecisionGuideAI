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
