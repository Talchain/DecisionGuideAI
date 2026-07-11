# Migration drift register — "applied, pending ledger row"

**Purpose (adopted by A1, `parallel-briefs/A1-RULING-F3-AND-GATE1-2026-07-12.md`):** every
database change applied outside `supabase_migrations.schema_migrations` is recorded HERE at
execution time, so drift is *recorded*, never silent. This register is an input to — not a
replacement for — the Gate-6 ledger-reconciliation plan (W&I lane; equivalence proof = full
catalog diff, not body hashes). **Nothing new executes over unreconciled history except under
a recorded emergency-security exception** (Gate-1 verdict; exception criteria: live
PII/security exposure + single reversible statement + immediate register entry).

## Applied, pending ledger row

| # | Migration file (repo path) | Content sha256 | Applied | Authority | Evidence | Ledger row |
|---|---|---|---|---|---|---|
| 1 | `supabase/migrations/20260712063000_f3_drop_cross_org_profile_policy.sql` (DGAI) | `fa946a710e708c189ff70f9f623766a76993f5b37db550f581de905989ad07f3` | 2026-07-12 ~06:00, A1 direct (transactional, strengthened pre/post-checks + simulated-JWT allow/deny) | Emergency-security exception, `A1-RULING-F3-AND-GATE1-2026-07-12.md` §F3 | `acceptance-evidence/security/F3-CONTAINMENT-2026-07-12.md` + `parallel-briefs/workspace-lane-evidence/gate0/` (exposure quantification) | **PENDING** reconciliation plan |

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
3. `sha256` is of the exact file content executed; re-authored files get a new entry.
4. When the reconciliation plan inserts a ledger row, the entry's last column flips to the
   inserted version id — entries are never deleted.
