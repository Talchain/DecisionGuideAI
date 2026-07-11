# Migration drift register — "applied, pending ledger row"

**Purpose (adopted by A1, `parallel-briefs/A1-RULING-F3-AND-GATE1-2026-07-12.md`):** every
database change applied outside `supabase_migrations.schema_migrations` is recorded HERE at
execution time, so drift is *recorded*, never silent. This register is an input to — not a
replacement for — the Gate-6 ledger-reconciliation plan (W&I lane; equivalence proof = full
catalog diff, not body hashes). **Nothing new executes over unreconciled history except under
a recorded emergency-security exception** (Gate-1 verdict; exception criteria: live
PII/security exposure + single reversible statement + immediate register entry).

## Applied, pending ledger row

Each entry distinguishes FOUR artefacts (they are not interchangeable): the **executed
script + transcript** (byte-exact, what actually ran), the **canonical replay migration**
(idempotent repo record — the sha256 column hashes THIS file, not the executed script),
**behavioural evidence**, and **rollback/recreation SQL**.

| # | Replay migration (repo path) | Replay-file sha256 | Executed script + transcript | Applied | Authority | Behavioural evidence | Rollback | Ledger row |
|---|---|---|---|---|---|---|---|---|
| 1 | `supabase/migrations/20260712063000_f3_drop_cross_org_profile_policy.sql` (DGAI) | `b935116fafb3bcf8f4d3587a9dc9db5f46ec7f0d16f66709b097e82c3fa22d63` | `acceptance-evidence/security/F3-CONTAINMENT-2026-07-12.md` Phase B (SQL-as-run incl. simulated-JWT checks + statement tags; ids redacted to prefixes) | 2026-07-11 18:24:50 UTC, A1 direct, transactional | Emergency-security exception, `A1-RULING-F3-AND-GATE1-2026-07-12.md` §F3 | Same file, Phases A/C (pre-drop leak live: cross-read 1 row; post-drop + fresh session: self 1 / cross 0) + `workspace-lane-evidence/gate0/` (8-pair quantification) | `rollback/20260712063000_..._rollback.sql.do-not-apply` (**re-opens the leak — emergency only**) | **PENDING** reconciliation plan |

## Known pre-existing drift (Gate-0 finding F1 — inventory, not register entries)

Three divergence classes across 18 files, catalogued with content hashes in
`parallel-briefs/workspace-lane-evidence/gate0/migration-registry-2026-07-11.txt`:
11 CEE files ledgered under different version stamps (NAME-ONLY) · 6 applied-but-unledgered
(5 CEE + DGAI shared_snapshots) · 1 authored-never-applied (DGAI thread_persistence) · plus
the cross-repo version collision `20260226010000` (two different contents, one ledger row).
Disposition of ALL of these = the Gate-6 reconciliation plan (A1-approved before any
ledger-row insertion; Gate-2 CI gains a cross-repo version-collision reject).

## Rules for future entries
1. An entry is written in the SAME session as the execution, by the executor.
2. The file must exist in the owning repo (merged or in the executing PR) before execution.
3. The sha256 column hashes the **replay migration file**; the executed-script column names
   the byte-exact record (transcript). Where the two are identical, say so explicitly.
   Re-authored replay files get a refreshed hash in place with a dated note — the executed
   record never changes.
4. When the reconciliation plan inserts a ledger row, the last column flips to the inserted
   version id — entries are never deleted.
