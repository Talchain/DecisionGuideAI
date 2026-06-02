# Tenancy and RLS migration spec v1.4 (draft)

**Status:** Draft for Codex/security review. Specification only. No migration has been started.
**Date:** 2026-06-02
**Supersedes:** v1.3 (`docs/specs/tenancy-rls-migration-spec-v1_3-draft.md`). **v1.4 is the working baseline. Run the next Codex/security review on v1.4, not v1.3. Do not resubmit v1.3.**
**Consolidates:** v1.3; the environment and namespace verification audit (`docs/audits/collab-environment-namespace-verification-v1.md`, commit `22b8135e`); the Codex security review of v1.3 (folded in as conveyed by the v1.4 brief; the review document itself was not present on disk); the phase-0 audit (`1e1028bf`), teams disposition audit (`a9d80d12`), and surface-recon audit (`5c98a57c`); and the SEC/TEN test matrix and rollback rehearsal requirements.
**Scope:** specification and decision record only. No code, schema, migration, prompt, package, lockfile, generated, test, or config changes. Illustrative SQL is documentation, not a migration file.

---

## 0. What changed from v1.3, and source status

v1.4 folds in the environment audit and the Codex review and corrects two live-schema assumptions that v1.3 got wrong. Material changes:

- Environment and namespace findings incorporated (§3): single viable target, no rehearsal environment, namespace gate passes.
- Live-schema corrections (§4): `scenarios.thread` and two thread RPCs do not exist live; the shared-thread privacy risk is latent, not live.
- New full workspace table and RLS specification (§8), which Codex correctly blocked v1.3 for only sketching.
- New role and capability matrix for Paul sign-off (§9).
- H-1+ hardening cluster expanded for the two CEE tables (§11).
- SECURITY DEFINER helper hardening (§12).
- The service-role `p_workspace_id` trust blocker, treated as a hard blocker (§13).
- Public brief allowlist (§14), snapshot write permissions (§10.3), rollback and rehearsal (§15), and the SEC/TEN test matrix (§16).

Source status: the v1.2 source documents (`olumi-tenancy-rls-migration-spec-v1_2.md`, `olumi-collaboration-mvp-scope-contract-v1_2.md`, `olumi-cc-development-standards-v3.md`) are not on disk. v1.4 reconstructs the requirements from the audits and the review and marks any unresolved source dependency **[v1.2 ref pending]**. The SEC and TEN identifiers used here are this document's own; reconcile them to the canonical scope-contract identifiers when v1.2 is supplied.

---

## 1. Purpose and scope

Convert the V5 surface from single-user ownership (`auth.uid() = user_id`) to workspace-scoped multi-tenancy, with fresh `workspaces` / `workspace_members` / `workspace_invites` tables and membership-aware RLS, without reusing the legacy V1 teams or organisations models. This unblocks the collaboration MVP (workspace UI, presence, suggest-mode, comments, snapshots) on V5 `scenarios`.

In scope: the six V5 tables (§6), their RLS, the SECURITY DEFINER RPCs that touch them, the CEE service-role paths, and the new workspace tables. Out of scope: legacy teams and decisions (frozen, C-lite), the orphan `canvas_*`/`organisations` stack (left untouched), V1 decommission, the collaboration UI build, and any schema or code change (this is a spec).

---

## 2. Locked decisions

1. **Legacy teams/decisions: C-lite.** Freeze or leave frozen; do not migrate `teams`, `team_members`, `invitations`, or `decisions.team_ids`; harvest patterns as prior art only; V1 decommission is a separate future workstream.
2. **Fresh V5 workspace model.** Build `workspaces`, `workspace_members`, `workspace_invites` fresh. Do not reuse legacy teams or the orphan `organisations` model.
3. **`v5_handler_facts` stays per-user.** The widening gate is closed; handler facts carry narrative free-text and an open `enrichment` record, so SEC-10 applies. CEE must filter per-user explicitly (§13).
4. **Migration gates are blocking** (§5): environment identity, namespace/orphan, live verification, and now the service-role `p_workspace_id` trust rule (§13).

---

## 3. Environment and namespace findings (from the verification audit)

- `etmmuzwxtcjipwphdola` ("Olumi") is the **only viable migration target** and holds canonical V5 data (391 scenarios, 1543 `v5_conversation_turns`, 496 `v5_handler_facts`) and the CEE service-role RPCs. UI and CEE **share this one project**.
- Its **formal production/staging label remains partially unresolved**. Evidence points to **shared dev/staging plus early-pilot**: 16 `auth.users` (about 8 test), 7 domains, no signups since 2025-07-19; the deployed front end's `netlify.toml` CSP points at staging backends.
- **No separate rehearsal environment exists.** "Olumi-EarlyAccess" (`ewyskeampbmbagyclvfn`) is an empty stub; the third project is inactive.
- **Paul must confirm the deployed `VITE_SUPABASE_URL`** (it is environment-injected, not in the repo) to finalise the prod/staging label.
- **A clone or fresh rehearsal project is required before destructive migration steps** (§15).
- **Namespace gate passes:** no live `workspaces`, `workspace_members`, `workspace_invites`, or `element_comments` table.
- **Orphan tables remain untouched:** `organisations` (11), `organisation_members` (14), `canvas_presence` (3), `canvas_comments` (36), and related `canvas_*` (blocks 164, versions 46, version_comments 10, permissions 24, canvases 23). They are data-bearing, RLS plus FORCE enabled, with cascade FKs, but have no migration provenance in this repo and no application code.
- **Conceptual overlaps are prior art only**, not canonical tables: `organisations`/`organisation_members` overlap `workspaces`/`workspace_members`; `canvas_presence`/`canvas_comments` overlap planned presence/comments. The fresh names avoid any direct clash. Do not create a table named `organisations`/`organisation_members`/`canvas_*`.

---

## 4. Live-schema corrections (v1.3 was wrong here)

Verified live 2026-06-02 against `etmmuzwxtcjipwphdola`:

- **`scenarios.thread` does not exist.**
- **`append_thread_entries` and `update_thread_block_state` are absent.**
- **`20260308000000_thread_persistence.sql` was not applied live.**
- **`conversation_turns` exists, is full-shape (10 columns), RLS plus FORCE enabled, but has 0 rows.**
- **Durable conversation history currently lives in `v5_conversation_turns`** (per-user).
- **13 of 15 tracked RPCs are live** (the two absent are the thread RPCs above).
- **The live `create_shared_brief` is the CEE variant** (it declares `v_shared_id`), which resolves the v1.3 duplicate-migration question.

Risk reframing and requirements:
- The shared-thread privacy risk is **latent, not live**: the code reads `row.thread`, but that column does not exist, so nothing is shared today.
- **Migration specs must be written against the live schema, not repo migrations alone.** Run the full §5.3 checklist before any SQL.
- **If `scenarios.thread` is ever introduced, it must be per-user, or excluded from private conversation display and export.**
- **v1.4 requires no shared JSONB thread writes, backfills, exports, or debug bundles that expose one user's private turns to another workspace member.** Private conversation content stays per-user (§10.2, §11, §14).

---

## 5. Migration gates (blocking; all must pass before any SQL)

### 5.1 Environment identity gate (hard)

Confirm and record: whether `etmmuzwxtcjipwphdola` is staging, production, shared/dev, or hybrid; which project receives the migration; which holds canonical V5 data; whether a separate production environment exists. No cutover until explicit and signed off. Add: **a rehearsal environment must be provisioned** (none exists), and the deployed `VITE_SUPABASE_URL` confirmed.

### 5.2 Namespace and orphan-table gate (passes, with recorded actions)

No planned name exists live (pass). For each conceptually-overlapping orphan (`organisations`, `organisation_members`, `canvas_presence`, `canvas_comments`), record a disposition (leave untouched now; archive or decommission in the V1 workstream) and confirm provenance before any future decommission. The migration must not create or alter any orphan table.

### 5.3 Live database verification checklist (run in full, attach to PR)

`pg_tables` (full inventory incl orphans); `pg_policies` (predicate, command, roles per in-scope table) matches this spec; `pg_proc` (existence, signature, SECURITY DEFINER) per in-scope RPC; triggers; grants (`authenticated`, `anon`, `service_role`); row counts; FORCE RLS per in-scope table; namespace collisions; duplicate or orphaned tables; duplicate function definitions across repos; confirm which `create_shared_brief` body is live (currently the CEE variant); whether `conversation_turns` is live and full-shape (it is, 0 rows); whether `v5_conversation_turns` and `v5_handler_facts` have FORCE RLS (they do not). Treat migration files as intent, not state; reconcile drift (for example `20260308000000`) before writing tenancy SQL. Also confirm `cee_prompt_observations` RLS status (currently disabled, 0 rows): out of tenancy scope, recorded on the security backlog.

---

## 6. Tables in scope and out of scope

In scope (receive `workspace_id` and membership-aware RLS): `scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`.

Out of scope, frozen: `teams`, `team_members`, `invitations`, `decisions`, `decisions.team_ids`, `decision_collaborators`. Orphans (`canvas_*`, `organisations`, `organisation_members`): out of scope for migration, in scope for the namespace gate (do not touch, do not collide).

---

## 7. Current live baseline (verified 2026-06-02)

| Table | Rows | Cols | RLS | FORCE | Policies (predicate) | Grants | Notes |
|---|---|---|---|---|---|---|---|
| `scenarios` | 391 | 22 | yes | yes | 4: S/I/U/D `auth.uid()=user_id`, authenticated | authenticated, service_role | `scenarios_updated_at` trigger; no `thread` column |
| `shared_briefs` | 0 | 10 | yes | yes | 1: SELECT `auth.uid()=user_id` | authenticated, service_role | writes via `create_shared_brief` |
| `scenario_snapshots` | 0 | 11 | yes | yes | 2: S/I `auth.uid()=user_id` | authenticated, service_role | immutable |
| `conversation_turns` | 0 | 10 | yes | yes | 2: S/I `auth.uid()=user_id` | authenticated, service_role | full-shape, unwired (0 rows) |
| `v5_conversation_turns` | 1543 | 12 | yes | **no** | 1: SELECT `auth.uid()=user_id`, **role public** | **anon**, authenticated, service_role | H-1+ target |
| `v5_handler_facts` | 496 | 10 | yes | **no** | 1: SELECT `auth.uid()=user_id`, **role public** | **anon**, authenticated, service_role | H-1+ target |

All eleven in-scope policies use `auth.uid() = user_id` and must convert to workspace membership (§10).

---

## 8. Target workspace model: full table and RLS specification

Built fresh. Illustrative DDL and policies follow; final form is set at implementation, but the policy intent is normative.

### 8.1 Centralised role hierarchy and helpers

Single source of role order: `owner` > `admin` > `editor` > `viewer`. All gating uses two helpers, both SECURITY DEFINER so they bypass RLS and **avoid the RLS recursion trap** (a policy on `workspace_members` that calls a helper which itself reads `workspace_members` would recurse if the helper were not SECURITY DEFINER). See §12 for helper hardening.

```sql
-- illustrative
create function is_workspace_member(p_workspace_id uuid) returns boolean
  language sql security definer stable set search_path = pg_catalog, public as $$
  select exists (select 1 from public.workspace_members
                 where workspace_id = p_workspace_id and user_id = auth.uid()); $$;

create function is_workspace_role(p_workspace_id uuid, p_min_role text) returns boolean
  language sql security definer stable set search_path = pg_catalog, public as $$
  select exists (select 1 from public.workspace_members m
                 where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
                 and case p_min_role
                       when 'viewer' then true
                       when 'editor' then m.role in ('owner','admin','editor')
                       when 'admin'  then m.role in ('owner','admin')
                       when 'owner'  then m.role = 'owner' end); $$;
```

### 8.2 `workspaces`

Purpose: tenant boundary. Core columns: `id uuid pk`, `name text not null`, `is_personal boolean not null default false`, `created_by uuid not null references auth.users(id)`, `created_at`, `updated_at`. Grants: `authenticated`, `service_role`; **no anon**. FORCE RLS.

Policies:
- SELECT: `is_workspace_member(id)`. Only members can read workspace metadata; non-members get nothing (no existence inference).
- INSERT: `created_by = auth.uid()`. Any authenticated user can create a workspace; creation must atomically insert an `owner` row in `workspace_members` (via a SECURITY DEFINER RPC, so the creator is owner).
- UPDATE (settings, name): `is_workspace_role(id, 'admin')`.
- DELETE: **forbidden in MVP** (no permissive policy). Workspace deletion is out of MVP scope.

### 8.3 `workspace_members`

Purpose: membership and role. Core columns: `id uuid pk`, `workspace_id uuid not null references workspaces(id) on delete cascade`, `user_id uuid not null references auth.users(id)`, `role text not null check (role in ('owner','admin','editor','viewer'))`, `created_at`, `updated_at`, `unique (workspace_id, user_id)`. Grants: `authenticated`, `service_role`; no anon. FORCE RLS.

Policies:
- SELECT: `is_workspace_member(workspace_id)`. Members can see co-members; non-members cannot enumerate membership (no inference leak).
- INSERT: `is_workspace_role(workspace_id, 'admin')` for adding members, plus the owner self-insert at workspace creation handled by the creation RPC. Cannot insert a second `owner` (enforce one owner per workspace; see invariants).
- UPDATE (role change): `is_workspace_role(workspace_id, 'admin')`, with constraints: an admin **cannot modify the owner row** and **cannot grant `owner`**; only an owner can change owner-level state. Encode as a policy plus a guard in the role-change RPC.
- DELETE (remove member): `is_workspace_role(workspace_id, 'admin')`, with constraint: **cannot remove the owner**. A member may remove themselves (leave), except the owner cannot leave in MVP (ownership transfer deferred).

Invariants:
- Exactly one `owner` per workspace.
- A personal workspace (`is_personal = true`) has exactly one member (the owner), permits no invites, and cannot add members.

### 8.4 `workspace_invites`

Purpose: pending invitations. Core columns: `id uuid pk`, `workspace_id uuid not null references workspaces(id) on delete cascade`, `email text not null`, `role text not null check (role in ('admin','editor','viewer'))` (never `owner`), `invited_by uuid not null references auth.users(id)`, `status text not null check (status in ('pending','accepted','revoked','expired')) default 'pending'`, `token text` (single-use accept token), `created_at`, `expires_at`. Grants: `authenticated`, `service_role`; no anon. FORCE RLS.

Policies and privacy:
- SELECT: `is_workspace_role(workspace_id, 'admin')` for workspace admins to manage invites, **plus** a narrow self-view for the invitee matched on `lower(email) = lower(auth.jwt()->>'email')` limited to their own pending invite. **Invite email addresses must not be visible to non-admin members or to anyone outside the workspace** (pending invite privacy).
- INSERT: `is_workspace_role(workspace_id, 'admin')`.
- UPDATE (accept): the invitee (email match) sets `status = 'accepted'` via a SECURITY DEFINER accept RPC that also inserts the `workspace_members` row; (revoke): `is_workspace_role(workspace_id, 'admin')`.
- Accept flow must not reveal a workspace's existence to arbitrary users; acceptance is keyed on a single-use token plus authenticated email match.

### 8.5 Non-member inference prevention

Across all three tables, a non-member SELECT returns zero rows (no error that distinguishes "exists but forbidden" from "does not exist"). Membership, invites, and workspace existence are not inferable by non-members.

---

## 9. Role and capability matrix (proposed default, for Paul sign-off)

**Tag: for Paul sign-off.** This is the proposed default; do not implement until signed off. Open decisions are marked.

| Capability | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Read workspace scenarios | yes | yes | yes | yes |
| Create scenario | yes | yes | yes | no |
| Edit graph directly when holding lock | yes | yes | yes | no |
| Propose patch | yes | yes | yes | no (open: allow later) |
| Accept or reject patch | yes | yes | editor only if host/lock holder and policy allows (open) | no |
| Comment | yes | yes | yes | open: yes if reviewer comments adopted, else no |
| Resolve own comment | yes | yes | yes | yes |
| Resolve any comment | yes | yes | editor if element owner/host, else no (open) | no |
| Create snapshot | yes | yes | yes | no |
| Publish brief | yes if approver | yes if approver | no unless approver flag allows (open) | no |
| Invite member | yes | yes | no | no |
| Remove member | yes | yes, except owner | no | no |
| Change member role | yes | yes, except owner and cannot grant owner | no | no |
| Manage workspace settings | yes | yes | no | no |
| Delete workspace | forbidden in MVP | forbidden | forbidden | forbidden |
| Transfer ownership | deferred | no | no | no |

Open policy decisions to resolve at sign-off:
- Viewer comments: do reviewers (viewers) get to comment?
- Editor acceptance of patches: only when holding the host lock, or never?
- Approver flag behaviour: which roles may publish a brief, and how is the approver flag granted?

---

## 10. In-scope V5 table RLS migration

### 10.1 Expand, backfill, switch

Expand: create the workspace tables and helpers; add nullable `workspace_id` to each in-scope table; keep existing `auth.uid()=user_id` policies. Backfill: create one personal workspace per existing distinct `user_id` (owner member); set `workspace_id` to that personal workspace; verify zero NULLs; set NOT NULL. Switch: replace predicates per §10.2, add FORCE RLS to the two CEE tables, rewrite RPCs (§13), and land the CEE caller-layer enforcement in the same window.

### 10.2 Privacy classification and switch predicates

| Table | Class | SELECT (illustrative) | Write (illustrative) |
|---|---|---|---|
| `scenarios` | Workspace-shared | `is_workspace_member(workspace_id)` | `is_workspace_role(workspace_id,'editor')` |
| `shared_briefs` | Workspace-shared (+ public-by-slug RPC, §14) | `is_workspace_member(workspace_id)` | via `create_shared_brief` only |
| `scenario_snapshots` | Workspace-shared, immutable | `is_workspace_member(workspace_id)` | INSERT requires editor-or-above (§10.3) |
| `conversation_turns` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | INSERT own only |
| `v5_conversation_turns` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | service-role only (§13) |
| `v5_handler_facts` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | service-role only (§13) |

Scenario content (graph, framing, analysis, brief, snapshots) is the shared artefact; conversation and handler-fact content is per-user even within a shared workspace.

### 10.3 Snapshot write permissions

Default: **snapshot creation requires editor-or-above; viewers cannot create snapshots.** Snapshots are immutable shared history, so unrestricted member inserts could pollute it. Reviewer snapshots, if wanted later, are a separate design decision.

---

## 11. H-1+ hardening cluster (`v5_conversation_turns`, `v5_handler_facts`)

In the switch step, for both tables:
- **Add FORCE RLS** (both currently lack it).
- **Change the SELECT policy role from `public` to `authenticated`.**
- **Revoke `anon` table grants** (both currently grant `anon` full DML; contained today only by RLS being enabled with no permissive write policy).
- **Keep writes service-role-only** unless explicitly justified; do not add permissive INSERT/UPDATE/DELETE policies for `authenticated`.
- **Add explicit denial tests** for anon read and write (§16).
- **Add cross-user denial tests** (User A cannot read User B rows) (§16).

---

## 12. SECURITY DEFINER helper hardening

For `is_workspace_member`, `is_workspace_role`, the workspace-creation RPC, the invite-accept RPC, and every in-scope SECURITY DEFINER function:
- `SET search_path = pg_catalog, public` on every function (the live `create_shared_brief` already does this; apply uniformly).
- Schema-qualify table references (`public.workspace_members`, etc.).
- Fixed, non-superuser function owner; do not let ownership drift.
- `REVOKE EXECUTE FROM PUBLIC` on every helper, then `GRANT EXECUTE` only to the roles that need it (`authenticated`, and `service_role` where used). Do not leave helpers PUBLIC-executable.
- Recursion avoidance: RLS helpers are SECURITY DEFINER so they bypass RLS and do not recurse through the policies that call them.
- Centralised role hierarchy (§8.1); no ad hoc role checks scattered across policies.
- No membership inference leaks: helpers return boolean only and never error-differentiate existence.
- Tests for non-member denial and helper behaviour (§16).

---

## 13. Service-role `p_workspace_id` trust blocker (hard blocker)

This is the sharpest review finding and is treated as a blocker. **CEE service-role paths bypass RLS, so a client-supplied `p_workspace_id` must never be trusted as authority.**

v1.4 requires, for every service-role read or write:
- CEE must **never trust caller-supplied `p_workspace_id` alone**.
- CEE must **resolve `scenario_id` to `workspace_id` server-side** (read the scenario's workspace from the database).
- CEE must **verify the authenticated end user's membership** of that resolved workspace before any service-role read or write.
- If a `p_workspace_id` is supplied, CEE must **compare it to the server-resolved workspace and reject on mismatch**.
- Service-role paths must **not use client-supplied workspace IDs as authority**.

Apply to: `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`, and the fact reads in `olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:355-407` (which currently read all facts for a scenario regardless of user and must filter `user_id = current_user`). User-callable RPCs (the other 12) convert their `auth.uid()=user_id` ownership check to `is_workspace_member(workspace_id)` derived from the scenario; `get_shared_brief_by_slug` stays public and unchanged (§14).

---

## 14. Public brief allowlist

`create_shared_brief` and `get_shared_brief_by_slug` back the public `/brief/:slug` route. Require an **explicit allowlist** on the public payload. The public brief must contain none of:
- `workspace_id`, `scenario_id`, `user_id`,
- member data, invite data,
- private conversation thread,
- `v5_conversation_turns` content, `v5_handler_facts` content,
- internal debug, provenance, or hash fields, unless explicitly approved as public-safe.

The live `get_shared_brief_by_slug` already returns a narrow set (brief, graph_hash, seed_used, response_hash, created_at, expires_at); review each field against the allowlist and approve or drop. Add tests for both RPCs (§16).

---

## 15. Rollback and rehearsal

- **Rehearse on a clone or fresh project before touching canonical data.** No rehearsal environment exists today (§3), so one must be provisioned. This is a precondition for any destructive step.
- **Sequence:** gates pass (§5); expand (additive); backfill personal workspaces and `workspace_id`; verify; switch policies, add FORCE RLS, rewrite RPCs, land CEE enforcement (§13) together.
- **Rollback window:** expand and backfill are additive and reversible (drop the column and the new tables). The switch is deployed behind a clear release boundary so policies can revert to `auth.uid()=user_id` with the CEE caller-layer checks reverted in lockstep.
- **No-rollback point:** once workspace-shared writes or member changes have occurred (a second user has written to a shared scenario, or memberships have been edited), simple policy revert is no longer safe; define this boundary explicitly and gate it.
- **Data reconciliation plan:** after backfill, every in-scope row has a non-null `workspace_id`; reconcile counts before and after; confirm no row lost its owner.
- **Compatibility rule:** during expand and backfill, both old and new policies must permit the owning user (dual-compatibility) so the running app is never locked out mid-migration.
- **Abort criteria:** rehearsal fails, backfill leaves NULL `workspace_id`, count reconciliation mismatches, or any cross-user read passes a denial test, abort the cutover.
- **Proceed criteria:** rehearsal passes on the clone, all SEC/TEN tests green, reconciliation exact, and the environment identity gate signed off.

---

## 16. SEC/TEN test matrix

All must pass on the rehearsal project before cutover, and again post-switch on the target.

| ID | Test | Expect |
|---|---|---|
| SEC-01 | Non-member reads a workspace scenario | denied (0 rows) |
| SEC-02 | Non-member infers workspace membership or existence | not inferable |
| SEC-03 | Viewer mutates a scenario | denied |
| SEC-04 | Editor proposes a patch | allowed |
| SEC-05 | Editor publishes a brief without approver rights | denied |
| SEC-06 | Owner or admin invites a member | allowed |
| SEC-07 | Owner or admin removes a member | allowed |
| SEC-08 | Admin removes the owner | denied |
| SEC-09 | Admin grants owner | denied unless explicitly allowed |
| SEC-10 | Removed member retains access | denied (access lost) |
| SEC-11 | User A reads User B `conversation_turns` | denied |
| SEC-12 | User A reads User B `v5_conversation_turns` | denied |
| SEC-13 | User A reads User B `v5_handler_facts` | denied |
| SEC-14 | Service-role context builder injects cross-user facts | prevented (per-user filter) |
| SEC-15 | CEE accepts a mismatched `p_workspace_id` | rejected |
| SEC-16 | Anon reads or writes `v5_conversation_turns` | denied |
| SEC-17 | Anon reads or writes `v5_handler_facts` | denied |
| SEC-18 | Public brief slug returns non-allowlisted fields | only public-safe fields returned |
| TEN-01 | Migration touches orphan `canvas_*` or `organisations` tables | no change to orphans |
| TEN-02 | Rollback rehearsal on clone or fresh project | passes |
| TEN-03 | Backfill leaves any NULL `workspace_id` | none; reconciliation exact |
| TEN-04 | Pending invite email visible to non-admin member | not visible |

---

## 17. Migration-readiness verdict

- **Ready for Codex/security review: yes.** v1.4 specifies the workspace tables and RLS in full, the role matrix, helper hardening, the service-role trust rule, the public brief allowlist, snapshot permissions, rollback and rehearsal, and the test matrix. Run the review on **v1.4, not v1.3**.
- **Ready for implementation brief: not yet.** Not until the Codex/security review of v1.4 returns clean and Paul confirms the environment and rehearsal decisions (§18).
- **Ready for SQL or code implementation: no.** Not until all hard blockers are closed: environment identity and rehearsal provisioning (§5.1, §15), the service-role `p_workspace_id` trust rule encoded (§13), the role matrix signed off (§9), and the live-schema drift reconciled (§4, §5.3).

---

## 18. Manual decisions still gating implementation

These do not block v1.4 drafting or its review, but they gate implementation:
1. Paul confirms the deployed `VITE_SUPABASE_URL` (finalises prod/staging label).
2. Paul provisions or approves a rehearsal environment (none exists).
3. Paul decides the fate of `20260308000000_thread_persistence.sql`: forward-plan, abandon, or reconcile later.
4. Paul signs off the role and capability matrix (§9), including the open decisions (viewer comments, editor patch acceptance, approver flag).
5. Any remaining v1.2 source-reference markers are resolved if the source documents are supplied.

---

## Appendix A: source reconciliation

- v1.2 source documents not on disk; requirements reconstructed from the audits and the review; markers **[v1.2 ref pending]** to be resolved when supplied. SEC/TEN identifiers are this document's own; reconcile to the canonical scope-contract identifiers (SEC-10 etc.) when v1.2 arrives.
- The Codex security review of v1.3 was folded in as conveyed by the v1.4 brief (the review document was not present on disk). If the original review is later supplied, reconcile any finding not already covered here.

## Appendix B: base commits and live evidence

- **Branch:** `claude/tenancy-rls-migration-spec-v1_4`, cut from `claude/collab-environment-namespace-verification` (`22b8135e`), which carries v1.3 and the environment audit. This draft adds exactly one file. No push.
- **Folded in:** v1.3 spec; environment audit (`22b8135e`); phase-0 (`1e1028bf`); teams disposition (`a9d80d12`); surface-recon (`5c98a57c`).
- **Live introspection (2026-06-02, read-only, `etmmuzwxtcjipwphdola`):** six V5 tables RLS/FORCE/policies/grants/counts (§7); `scenarios.thread` and two thread RPCs absent; 13/15 RPCs present; `create_shared_brief` is the CEE variant; orphan inventory; environment signals (16 users, about 8 test, no signups since 2025-07-19).
- **Method:** specification only; no code, schema, migration, prompt, package, lockfile, generated, test, or config files changed.

---

*End of draft v1.4*
