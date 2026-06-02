# Tenancy and RLS migration spec v1.3 (draft)

**Status:** Draft for review. Specification only. No migration has been started.
**Date:** 2026-06-02
**Supersedes:** Tenancy and RLS migration spec v1.2 (see §0; the v1.2 source document is not present on disk, so this is a standalone draft with provisional section references).
**Inputs folded in:** `docs/audits/collab-phase0-audit-v1.md` (commit `1e1028bf`), `docs/audits/collab-surface-recon-v1.md` (commit `5c98a57c`), `docs/audits/collab-teams-disposition-audit-v1.md` (commit `a9d80d12`), and a live read-only Supabase introspection dated 2026-06-02.
**Scope of this document:** specification and decision record only. It defines what the migration must do and the gates it must pass. It does not contain migration SQL files and starting the migration is out of scope.

---

## 0. Document status and source reconciliation

The named source document `olumi-tenancy-rls-migration-spec-v1_2.md` is not present in any local repo, branch, or worktree (verified exhaustively across `DecisionGuideAI`, `olumi-assistants-service`, `olumi-schemas`, `Inference-Service-Layer`, `plot-lite-service`). This draft is therefore **standalone**. Where it would normally cite a v1.2 section, it is marked **[v1.2 ref pending]**. When the v1.2 source is supplied, these markers should be resolved to concrete section references and any divergence reconciled. The `olumi-collaboration-mvp-scope-contract-v1_2.md` and `olumi-cc-development-standards-v3.md` are likewise absent; provisions that depend on them are marked **[scope contract ref pending]**.

The phase-0 audit is the substantive predecessor and its findings are treated as the working baseline for tenancy structure, RLS predicates, and the RPC inventory.

---

## 1. Purpose and scope

Move the V5 surface from single-user ownership (`auth.uid() = user_id`) to workspace-scoped multi-tenancy, with fresh `workspaces` / `workspace_members` / `workspace_invites` tables and membership-aware RLS, without reusing the legacy V1 teams model. This unblocks the collaboration MVP (workspace UI, presence, suggest-mode, comments, snapshots) on V5 `scenarios`.

In scope: the six V5 tables in §4, their RLS policies, the SECURITY DEFINER RPCs that touch them, the CEE service-role paths that read and write them, and the new workspace tables.

Out of scope: legacy teams and decisions (frozen, see §12), V1 decommission, the collaboration UI implementation itself, schema or code changes (this is a spec), and PLoT/ISL (tenancy-blind by design, confirmed in phase-0 §6.3).

---

## 2. Locked decisions (v1.3)

1. **Legacy teams/decisions disposition: C-lite.** Freeze or leave frozen. Do not migrate `teams`, `team_members`, `team_invitations`/`invitations`, or `decisions.team_ids` into the workspace model. Harvest useful UX and data-model patterns as prior art only (Appendix A). V1 decommission is a separate future workstream. (MS-1 to MS-5, §12.)
2. **Fresh V5 workspace model.** Build new `workspaces`, `workspace_members`, `workspace_invites`. Do not reuse legacy teams as the tenancy foundation. Keep the collaboration MVP aligned to V5 `scenarios`, not legacy `decisions`.
3. **`v5_handler_facts` stays per-user.** Close the previous audit gate that contemplated workspace-wide widening. Handler facts carry narrative free-text and an open `enrichment` record, so SEC-10 applies (phase-0 §5). CEE service-role paths must filter by the current user explicitly and must not rely on RLS (§9).
4. **Two mandatory pre-migration gates.** The environment identity gate (§3.1) and the namespace collision and orphan-table verification gate (§3.2, MS-6) must both pass before any migration SQL is written or applied.

---

## 3. Migration gates (must pass before any migration SQL)

These gates are blocking. No expand, backfill, or switch step may begin until both gates pass and the live verification checklist (§3.3) has been completed against the confirmed target project.

### 3.1 Environment identity gate (hard, not optional)

The active Supabase project is named "Olumi" (`etmmuzwxtcjipwphdola`, us-east-1, active) and holds the live V5 data, but its formal role is **unresolved**: project notes label it staging, yet it carries canonical V5 usage (scenarios active to 2026-05-30). A second active project, "Olumi-EarlyAccess" (`ewyskeampbmbagyclvfn`, eu-west-2), is a stub (one `early_access` table, 0 rows). A third project is inactive.

Before any cutover, confirm and record in writing:
- Whether "Olumi" (`etmmuzwxtcjipwphdola`) is staging, production, shared/dev, or hybrid.
- Which Supabase project will receive the migration.
- Which project contains the canonical V5 live data.
- Whether staging and production are separate projects, and if so, the migration order across them.

No migration cutover may proceed until environment identity is explicit and signed off. This gate exists because the audits could not resolve prod versus staging from introspection, and a tenancy migration applied to the wrong project, or to a project shared with an unknown other consumer, is unsafe.

### 3.2 Namespace collision and orphan-table verification gate (MS-6)

The live "Olumi" project contains data-bearing tables with **no migration provenance in this repo and no current application code** (surface-recon §8): `canvas_blocks`, `canvas_comments`, `canvas_versions`, `canvas_version_comments`, `canvas_permissions`, `canvas_presence`, `canvases`, `organisations`, `organisation_members`. These are remnants of an earlier product generation sharing the same project.

Before writing migration SQL, verify against the live target project:
- The full `public` table list, and for each planned new table (`workspaces`, `workspace_members`, `workspace_invites`, and any new presence/comments tables such as a future `element_comments`) confirm there is **no existing table of that name**.
- Whether planned names collide conceptually with orphans: `organisations`/`organisation_members` versus `workspaces`/`workspace_members`; `canvas_presence` versus a new presence table; `canvas_comments` versus a new `element_comments`.
- A disposition for each orphan that conceptually overlaps: leave untouched, rename out of the way, archive, or schedule for the V1 decommission workstream. The migration must not silently create a table whose name or purpose overlaps a live orphan.

This gate fails if any planned name already exists, or if an orphan's disposition is undecided. The namespace is not clean and must be treated as such.

### 3.3 Live database verification checklist

Run against the confirmed target project (read-only) and attach the output to the migration PR. Confirm:
- `pg_tables` for the public schema (full inventory, including orphans).
- `pg_policies` for every in-scope table (predicate, command, roles) matches this spec.
- `pg_proc` for every in-scope RPC (existence, argument signature, SECURITY DEFINER flag).
- Triggers on in-scope tables (for example the `scenarios_updated_at` trigger).
- Grants on in-scope tables and RPCs (`authenticated`, `anon`, `service_role`).
- Row counts per in-scope table (to size backfill).
- FORCE RLS status per in-scope table (see §5; two tables currently lack it).
- Namespace collisions and duplicate or orphaned tables (per §3.2).
- Duplicate migration or function definitions across repos. Specifically the same-named `20260226010000_scenario_schema_v2_0_1_hardening.sql` exists in both `DecisionGuideAI` and `olumi-assistants-service` with differing `create_shared_brief` bodies (phase-0 §3.3). Determine which body is live.
- Whether the live `create_shared_brief` body matches the canonical repo definition.
- Whether `conversation_turns` is live and at full shape (see §5).
- Whether `v5_conversation_turns` and `v5_handler_facts` have FORCE RLS (they do not as of 2026-06-02, see §5).

---

## 4. Tables in scope and out of scope

**In scope (must receive `workspace_id` and membership-aware RLS):**
- `scenarios`
- `shared_briefs`
- `scenario_snapshots`
- `conversation_turns`
- `v5_conversation_turns`
- `v5_handler_facts`

These six are the phase-0 V5-relevant set. The phase-0 spec inventory must be extended to include `conversation_turns` and `scenario_snapshots` (phase-0 §7.3); both are confirmed live, RLS-enabled, FORCE-enabled, and policy-bearing (§5).

**Explicitly out of scope (frozen, not migrated, see §12):**
- `teams`
- `team_members`
- `team_invitations` (note: no such table exists live; invites are realised in the unified `invitations` table)
- `invitations` (live unified invite table): legacy prior art only
- `decisions`
- `decisions.team_ids`
- `decision_collaborators`: prior art only (Appendix A)

Orphaned legacy tables (`canvas_*`, `organisations`, `organisation_members`) are out of scope for migration but in scope for the namespace gate (§3.2).

---

## 5. Current observed state (live-verified 2026-06-02)

Read-only introspection of the "Olumi" project:

| Table | RLS enabled | FORCE RLS | Columns | Policies | Notes |
|---|---|---|---|---|---|
| `scenarios` | yes | yes | 22 | 4 | SELECT/INSERT/UPDATE/DELETE, all `auth.uid() = user_id` |
| `shared_briefs` | yes | yes | 10 | 1 | SELECT only; writes via `create_shared_brief` RPC |
| `scenario_snapshots` | yes | yes | 11 | 2 | SELECT/INSERT, immutable |
| `conversation_turns` | yes | yes | 10 | 2 | Full shape (10 cols), append-only, but 0 rows live (read path unwired, surface-recon §2) |
| `v5_conversation_turns` | yes | **no** | 12 | 1 | SELECT policy only; writes via service-role RPC; **FORCE RLS missing** |
| `v5_handler_facts` | yes | **no** | 10 | 1 | SELECT policy only; writes via service-role RPC; **FORCE RLS missing** |

Total RLS policies across the six tables: 11, all keyed on `auth.uid() = user_id`. This matches phase-0 §3.1.

**Hardening item H-1 (fold into the switch step):** add `FORCE ROW LEVEL SECURITY` to `v5_conversation_turns` and `v5_handler_facts`. Without FORCE, a table owner connection bypasses RLS; the CEE service-role path already bypasses RLS by design, which makes the explicit caller-layer filters in §9 mandatory regardless, but FORCE closes the gap for any non-service-role owner access. (Phase-0 §7.7, now live-verified.)

**Note on `conversation_turns`:** it is at full shape and hardened but has 0 rows, because the displayed conversation thread is currently read from the shared `scenarios.thread` JSONB, not from this per-user table (surface-recon §2). See §11.

---

## 6. Target tenancy model (fresh workspaces)

New tables (built fresh, not derived from teams):

- `workspaces` (id, name, created_by, timestamps).
- `workspace_members` (workspace_id, user_id, role, timestamps; unique on (workspace_id, user_id)). Roles: `owner`, `admin`, `editor`, `viewer`. This hierarchy is richer than the legacy admin/member binary and must not be derived from it.
- `workspace_invites` (id, workspace_id, email, role, invited_by, status, timestamps). A clean table, not the overloaded legacy `invitations` table.

Membership helper (illustrative, not a migration file):

```sql
-- illustrative; final form set at implementation
create function is_workspace_member(p_workspace_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;
-- plus a role-aware variant is_workspace_role(p_workspace_id, min_role) for write gating
```

Each in-scope table gains a `workspace_id uuid` referencing `workspaces(id)`. Personal use is modelled as a single-member personal workspace per user, created during backfill (§7).

---

## 7. RLS migration per table (expand, backfill, switch)

Apply the standard three-phase pattern to each in-scope table. No destructive step runs before backfill is verified.

**Phase expand (additive, non-breaking):**
- Create `workspaces`, `workspace_members`, `workspace_invites`, and `is_workspace_member()`.
- Add nullable `workspace_id` to each in-scope table.
- Keep existing `auth.uid() = user_id` policies in place.

**Phase backfill:**
- Create one personal workspace per existing distinct `user_id` and add that user as `owner` in `workspace_members`.
- Set `workspace_id` on each existing row to the owning user's personal workspace.
- Verify zero NULL `workspace_id` on each table, then set `workspace_id NOT NULL`.

**Phase switch (per-table policy replacement and hardening):**
- Replace ownership predicates with membership-aware predicates, classified by privacy:

| Table | Privacy class | SELECT predicate (illustrative) | Write predicate (illustrative) |
|---|---|---|---|
| `scenarios` | Workspace-shared | `is_workspace_member(workspace_id)` | `is_workspace_role(workspace_id, 'editor')` |
| `shared_briefs` | Workspace-shared (plus public-by-slug RPC, unchanged) | `is_workspace_member(workspace_id)` | via `create_shared_brief` RPC only |
| `scenario_snapshots` | Workspace-shared, immutable | `is_workspace_member(workspace_id)` | INSERT only, member |
| `conversation_turns` | **Per-user within workspace (SEC-10)** | `auth.uid() = user_id and is_workspace_member(workspace_id)` | INSERT own only |
| `v5_conversation_turns` | **Per-user within workspace (SEC-10)** | `auth.uid() = user_id and is_workspace_member(workspace_id)` | service-role RPC only (§9) |
| `v5_handler_facts` | **Per-user within workspace (SEC-10)** | `auth.uid() = user_id and is_workspace_member(workspace_id)` | service-role RPC only (§9) |

- Add FORCE RLS to `v5_conversation_turns` and `v5_handler_facts` (H-1).
- Keep `get_shared_brief_by_slug` public and unchanged (it already excludes `user_id`/`scenario_id`, phase-0 §3.2).
- Confirm `anon` remains revoked on all six tables.

The workspace-shared versus per-user split is the crux: scenario content (graph, framing, analysis, brief, snapshots) is the collaborative artefact and is readable by all members; conversation and handler-fact content is per-user even within a shared workspace, because it is the private record of one user's turns (phase-0 §4, §5).

---

## 8. RPC migration (user-callable versus service-role)

There are two rewrite patterns. Do not apply the user-callable pattern to service-role RPCs.

**User-callable SECURITY DEFINER RPCs (12).** These run with the end user's JWT and currently assert `auth.uid() = user_id` on the scenario. Rewrite the ownership check to derive the scenario's `workspace_id` and assert `is_workspace_member(workspace_id)` (and a role check for writes):
`append_scenario_event`, `apply_patch_and_log`, `store_analysis_and_log`, `store_analysis_failure`, `store_brief_and_log`, `set_stage_and_log`, `create_shared_brief`, `create_snapshot`, `append_thread_entries`, `update_thread_block_state`, `insert_conversation_turn`. Plus `get_shared_brief_by_slug` stays public and unchanged (the twelfth).

**Service-role RPCs (3).** `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph` run with the service-role key and cannot use `auth.uid()`. The membership check must move to the CEE caller layer (§9), and the RPCs gain a `p_workspace_id` argument where they write workspace-scoped rows. (Phase-0 §7.5.)

---

## 9. CEE service-role path requirements

This section is mandatory and distinct from §8. The CEE bypasses RLS by using the service-role key, so RLS cannot be the enforcement boundary for these paths. Enforcement must be explicit in CEE code, before any service-role read or write.

Affected paths:
- `append_turn_atomic` (writes `v5_conversation_turns`, `v5_handler_facts`, `scenarios.graph`) via `olumi-assistants-service/src/orchestrator-v5/session/supabase-store.ts`.
- `ensure_scenario_exists` and `store_draft_graph` (service-role, write `scenarios`).
- Fact reads in `olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:355-407`, which currently read all facts for a scenario regardless of user (phase-0 §5.4).

Requirements (the CEE must, before any service-role access):
- Resolve the current authenticated end user for the turn.
- Assert that user is a member of the scenario's workspace before any scenario access. Single-user-per-scenario equivalence no longer holds once scenarios are multi-tenant.
- Apply an explicit per-user filter when reading `v5_conversation_turns`.
- Apply an explicit per-user filter when reading `v5_handler_facts`.
- Never inject another user's facts or turns into the context pack. The context builder must filter `user_id = current_user`, not rely on scenario-scoped reads.

These requirements are the server-side counterpart to the per-user RLS in §7; without them, multi-tenancy would leak one user's conversation and handler facts into another user's context.

---

## 10. `v5_handler_facts` per-user decision

Locked: per-user. The previous audit gate that contemplated widening handler facts to workspace-wide is **closed**.

Rationale (phase-0 §5): four fact types carry AI-generated narrative free-text (`run_analysis.summary`, `explain_result.narrative`, `compare_options.narrative`, `what_would_flip.narrative`), and `enrichment` is an open record of unspecified future content. Narrative reveals what a specific user asked on a turn, which is conversational context under SEC-10 ("user A's row must not appear in user B's context"). Workspace-wide widening is therefore not safe under the current handler design.

Spec consequence: drop the "audit gate" sentence in the v1.2 §5.3 [v1.2 ref pending] that allowed widening if handler facts were found free of private context. Retain per-user RLS (`auth.uid() = user_id and is_workspace_member(workspace_id)`) and the §9 caller-layer filters. A future audit may revisit only if narrative is refactored out of facts and into `v5_conversation_turns.content`.

---

## 11. Conversation thread privacy (scenarios.thread), tenancy-relevant

The displayed conversation thread is currently hydrated from `scenarios.thread`, a JSONB column on the scenario row, which is per-scenario shared, not per-user (surface-recon §2: `useScenario.ts:470` then `useConversation.ts:1448`). The per-user `conversation_turns` table exists with correct RLS but is unwired (0 rows). Under single-user scenarios this is invisible; under workspace multi-tenancy, a shared `scenarios.thread` would expose every member's conversation to all members, which violates SEC-10.

Spec requirement (T-1): before scenarios become multi-tenant, the conversation display read path must move off the shared `scenarios.thread` onto the per-user `conversation_turns` store (or `scenarios.thread` must be partitioned per user). This is a precondition for multi-tenant scenarios, tracked here because it is a tenancy-privacy boundary even though the read-path switch itself is UI work. Classify as a blocking precondition for the conversation surface, coordinated with the collaboration MVP conversation brief.

---

## 12. Legacy teams/decisions disposition (C-lite): MS-1 to MS-5

Folded from the teams disposition audit (commit `a9d80d12`).

- **MS-1.** The spec does not migrate legacy `teams` / `team_members` into `workspaces` / `workspace_members`. The workspace tables are built fresh (§6).
- **MS-2.** The spec does not migrate `decisions.team_ids`. It is a `uuid[]` with no foreign key and no RLS-enforced membership, and all rows are developer/test (teams audit §5). It is left inert.
- **MS-3.** Legacy teams and decisions are non-blocking for workspace tenancy. They are unmounted and unreachable in the live app (live app is `AppPoC`; teams/decisions routes live only in the unmounted `App.tsx`), have no V5 coupling, and no test or account-deletion path depends on them (teams audit §3, §6). The spec can finalise without resolving them.
- **MS-4.** Old member and invite UX is pattern reference only. No legacy component or context is reused as-is (Appendix A).
- **MS-5.** V1 decommission (removing the dead `App.tsx` routes; dropping `teams`, `team_members`, `decisions`, `invitations`, `decision_collaborators`; retiring `send-team-invite`) is a separate future workstream, sequenced after V1 sunset, and is out of this tenancy and RLS migration.

If real usage is later found on teams or decisions (none is evident; all data is developer/test and dormant), the minimum safe path is freeze and do not delete, snapshot before any structural change, and gate any drop on explicit confirmation that no row belongs to a real user.

---

## 13. Migration sequencing and rollback

1. Pass the environment identity gate (§3.1) and the namespace gate (§3.2). Run the live verification checklist (§3.3).
2. Expand (additive) across the six tables and create the workspace tables and helper (§6, §7).
3. Backfill personal workspaces and `workspace_id` values; verify no NULLs; set NOT NULL (§7).
4. Switch policies per table, add FORCE RLS to the two CEE tables (H-1), and rewrite RPCs (§8). Land the CEE caller-layer enforcement (§9) in the same release window as the per-user policy switch, since the two together close the leak.
5. Resolve T-1 (conversation read-path) before exposing any scenario to a second member (§11).
6. Verify with the full checklist post-switch.

Rollback: the expand and backfill phases are additive and reversible (drop the nullable column, drop the new tables). The switch phase should be deployed behind a clear release boundary so policies can be reverted to the `auth.uid() = user_id` form if a regression appears, with the CEE caller-layer checks reverted in lockstep.

---

## 14. Open decisions and provisional items

- **Environment identity (blocking, §3.1).** Prod versus staging for "Olumi" is unresolved and must be confirmed before cutover.
- **v1.2 source reconciliation.** All [v1.2 ref pending] and [scope contract ref pending] markers must be resolved against the supplied v1.2 documents; any divergence reconciled.
- **Role model details.** The exact `workspace_members` role hierarchy semantics (what `editor` versus `admin` can do per surface) are a product decision feeding the workspace UI brief.
- **Orphan disposition (§3.2).** Each conceptually-colliding orphan (`organisations`, `canvas_presence`, `canvas_comments`) needs a leave/rename/archive decision; deferred to the V1 decommission workstream but must be acknowledged by the namespace gate before migration.
- **`cee_prompt_observations` RLS disabled.** Out of tenancy scope but flagged for the security backlog (surface-recon §8): the table has RLS disabled (0 rows, latent).
- **Duplicate hardening migration.** Resolve which `create_shared_brief` body is live (§3.3) and reconcile the two-repo duplicate before the switch touches `create_shared_brief`.

---

## Appendix A: prior art (reference, not reuse)

None of the following becomes a canonical V5 table or a reused component without fresh review. They inform fresh V5 design only.

- `ManageTeamMembersModal`: reference for the workspace members and invite UX (tabbed invite by email and directory, pending-invite management, edge-function health check).
- `send-team-invite` (Edge Function, Brevo): reference for the invite-email delivery path; port with payload (`team_id` to `workspace_id`) and template changes.
- `decision_collaborators`: reference for a role plus granular-permissions (`can_rate`/`can_comment`/`can_suggest`) plus invite-lifecycle (`invited`/`joined`) data model. Reference only; build `workspace_members` fresh.
- `canvas_presence`: reference for presence and a per-element edit lock (`cursor_position`, `last_seen`, `editing_block_id`). Reference only; the new presence layer is designed against the V5 canvas store and is greenfield in code.
- `canvas_comments`: reference for threaded, positioned, resolvable per-element comments (`block_id`, `parent_id`, `position`, `resolved_by`). Reference only; a future `element_comments` is a fresh table.

---

## Appendix B: evidence and base commits

- **Branch:** `claude/tenancy-rls-migration-spec-v1_3`, cut from staging head `eab0365f`. This draft adds exactly one file. No push.
- **Audits folded in:** phase-0 (`1e1028bf`), surface-recon (`5c98a57c`), teams disposition (`a9d80d12`).
- **Live introspection (2026-06-02, read-only, project `etmmuzwxtcjipwphdola`):** RLS, FORCE RLS, column counts, and policy counts per in-scope table (§5); confirms the FORCE RLS asymmetry on the two CEE tables and that `conversation_turns` is full-shape with 0 rows.
- **Method:** specification only; no code, schema, migration, prompt, package, lockfile, config, or test files changed. Illustrative SQL in §6 and §7 is documentation, not a migration file.

---

*End of draft v1.3*
