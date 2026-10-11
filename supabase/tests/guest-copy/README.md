This is a dry run of `copy_guest_scenario` on PGlite (Postgres running in-process). It never touches Supabase.

- `setup.sql` mirrors the live `scenarios` table (columns, defaults, CHECK constraints, self-FK, trigger; read 1 Oct 2026) and Supabase's default ACL, which grants EXECUTE on every new public function to anon, authenticated and service_role. So a migration that forgot its REVOKE would be callable here, as it would be live.
- The guest fixture is shaped like what the guest turn path leaves: a graph, the brief, the CAS hash, a Run (analysis columns, CEE's analysis brief, events, a model version) and turn + fact rows.
- Success/replay/refusal rows pin the stated ids, error codes/messages or snapshots; metadata/trigger/ACL rows pin those specific claims. The script exits 1 if an acceptance row or named mutant control fails, or no migration is given.

```bash
cd supabase/tests/guest-copy
node run.mjs ../../migrations/20261011100000_checked_guest_copy_function.sql
```

| Row | Claim |
|---|---|
| C1, C1b | The owner copy is a new row owned by the caller. It carries `graph` and `title` only (DL condition 1). C1 reads every column EXCEPT `id`, `created_at` and `updated_at` (the id is asserted separately by the returned identity; the shipped INSERT omits both timestamps), so any other column copied by mistake turns it red: every other column is at its never-run default (stage `frame`, status `none`, hash anchor NULL). No turns, no facts. |
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

The runner applies setup + unchanged legacy baseline, then the additive checked migration.
The 18 legacy rows run before and after; new rows cover the required-argument checked
function, destination tuples, real trigger-driven revision changes, recovery replay,
JSON value equality (stored 1.0 may equal checked 1), ACLs, TEMP shadow and SQL rollback.
`scenarios_bump_revision()` is verbatim CEE 20261008190000; its trigger is verbatim
20261008160000 (the later migration only replaces the function).
Mutants are independent: equality removed -> C15eq RED; REVOKE removed -> checked
C5/C10 RED; comparison before replay -> C17 RED; NULL preflight removed -> C20 RED;
isolation guard removed -> C25 RED.
Legacy C5/C10 remain green when only the checked function's REVOKE is removed.
Deploy DB first (nothing existing changes), then CEE; rollback CEE first, then drop
only the checked function. Legacy callers stay unchecked; CEE must never call them.
Catalog/sequential evidence is not PostgREST rollout or multi-session race proof.

**Isolation and grants.** The new checked function rejects non-READ-COMMITTED
transactions with SQLSTATE `25000`, immediately after the NULL preflight and before
any auth read, advisory lock or replay lookup. Legacy isolation is unchanged;
its callers must use READ COMMITTED for the mixed-call one-copy guarantee. Other
legacy isolation remains unproved. The checked function owner is assigned to
`postgres` inside the migration; C10checked asserts owner, SECURITY DEFINER,
empty search_path and direct EXECUTE grantees `{postgres,service_role}`. Direct
ACL membership does not rule out inherited-role/superuser access.
C23 asserts destination owner/source and EXACT graph text equal to stored `1.0`,
while the checked `1` has different text. C24 brackets both replay calls with total
row counts and before/after whole-row snapshots of every destination.

**PostgREST readiness (DL only).** Forward and rollback notify
`pgrst, 'reload schema'` inside their transaction. Notification/catalog shape
is NOT readiness proof. Apply DB first; before CEE rollout, use a service-role
HTTP POST to `/rest/v1/rpc/copy_guest_scenario_checked` with apikey and Bearer
service-role headers and all four named args:
```json
{"p_source_scenario_id":"<throwaway guest id confirmed absent>","p_user_id":"<known auth user>","p_checked_source_graph":{"nodes":[],"edges":[]},"p_checked_source_revision":0}
```
Use a genuine UUID formerly belonging to a throwaway guest and confirmed deleted;
expect typed `CG404`, or `22023` from a deliberate NULL/unknown-auth-user probe,
NOT `PGRST202`. Do not roll out CEE until this is observed. Live probe is UNRUN
by this lane. Legacy function is untouched. Rollback CEE first, then drop only
checked, then verify cache reload; rollback SQL has exactly one BEGIN.

**Race (`race.mjs`, local real Postgres).** Uses installed `embedded-postgres`
17.6.0-beta.15 + `pg`, a disposable loopback cluster and fresh DB per scenario.
No Supabase URL/key is read. It widens BOTH legacy/checked bodies' own
lookup->insert gap using the existing `pg_sleep(0.3)` injection, only in test DBs.
A leader is observed inside that gap before seven other prepared sessions start:
8 checked, and 4 legacy + 4 checked in each first-arrival order. Shipped variants
must have one id / one created:true / one destination. Removing ONLY checked's
advisory lock must create multiple destinations, including in both mixed orders.
Real `pg_blocking_pids` observations gate graph UPDATE and claim
(`SELECT FOR UPDATE` + owner UPDATE) races in both commit orders: writer-first
must refuse `CG412` without insertion; copy-first copies the checked guest graph
before the writer can commit. Thus an old guest copy can coexist with a later
claim; it is not a copy performed after a claim-first commit. REPEATABLE READ
must refuse `25000` with zero destinations. The script fails on missing lock-wait
observations or wrong tuples/counts; all connections/cluster/throwaway data are
cleaned in finally blocks. This is local concurrency evidence, not live rollout
or PostgREST readiness proof.

```bash
cd supabase/tests/guest-copy
node race.mjs ../../migrations/20261011100000_checked_guest_copy_function.sql
```
