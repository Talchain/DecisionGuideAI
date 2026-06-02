# Tenancy and RLS migration spec v1.5 (draft)

**Status:** Draft for Codex re-review. Specification only. No migration has been started.
**Date:** 2026-06-02
**Supersedes:** v1.4 (`docs/specs/tenancy-rls-migration-spec-v1_4-draft.md`). **v1.5 is the baseline for the next Codex re-review. Do not resubmit v1.3 or v1.4.**
**Reason for v1.5:** the second Codex review of v1.4 returned **block pending spec changes**. All findings are accepted and folded in here.
**Scope:** specification and decision record only. No code, schema, migration, prompt, package, lockfile, generated, test, or config changes. Illustrative SQL is documentation, not a migration file.

---

## 0. v1.4 to v1.5 changelog

v1.5 accepts every second-round Codex finding and adds:

- **Parent/child `workspace_id` consistency enforcement** (§9): any child row with both `scenario_id` and `workspace_id` derives `workspace_id` server-side from the parent `scenarios.workspace_id`; client and caller values are never trusted.
- **Service-role scenario creation semantics** (§15.3): `ensure_scenario_exists` exists-versus-not-exists behaviour, blocker-class.
- **Owner-atomic workspace creation** (§8.6): no ownerless workspaces; RPC inserts `workspaces` and owner `workspace_members` in one transaction.
- **Member and invite lifecycle boundaries** (§8.7): RPC-only lifecycle, with explicit constraints.
- **`workspace_id` immutability** (§10): immutable once set, except through a dedicated transfer RPC.
- **Per-RPC permission table** (§15.2): derivation, role, trusted and rejected inputs, idempotency, grants, child-consistency per RPC.
- **Invite privacy hardening** (§8.8): verified email, hashed single-use tokens, expiry, restricted visibility.
- **Final public brief allowlist** (§16): finalised fields, with `seed_used` and `response_hash` dropped by default pending sign-off.
- **Expanded preflight checks** (§5.4): owners, default privileges, exposed schemas, PostgREST grants, duplicates, live-versus-repo bodies.
- **Expanded test matrix** (§18): new SEC/TEN cases, all v1.4 cases preserved.

Everything else from v1.4 (environment and namespace findings, live-schema corrections, H-1+ hardening, SECURITY DEFINER helper hardening, the service-role `p_workspace_id` trust rule, rollback and rehearsal, the role matrix, manual blockers) is carried forward and, where Codex sharpened it, tightened below.

---

## 1. Purpose and scope

Convert the V5 surface from single-user ownership (`auth.uid() = user_id`) to workspace-scoped multi-tenancy, with fresh `workspaces` / `workspace_members` / `workspace_invites` tables and membership-aware RLS, without reusing the legacy V1 teams or organisations models. In scope: the six V5 tables (§6), their RLS, the SECURITY DEFINER RPCs, the CEE service-role paths, and the new workspace tables. Out of scope: legacy teams and decisions (frozen, C-lite), the orphan `canvas_*`/`organisations` stack (untouched), V1 decommission, the collaboration UI build, and any schema or code change.

---

## 2. Locked decisions

1. Legacy teams/decisions: C-lite (freeze, do not migrate, prior art only; V1 decommission separate).
2. Fresh V5 workspace model (build workspaces tables fresh; no reuse of teams or orphan organisations).
3. `v5_handler_facts` stays per-user (widening gate closed; SEC-10 applies; CEE filters per-user, §15).
4. Migration gates are blocking (§5): environment identity, namespace/orphan, expanded preflight and live verification, the service-role `p_workspace_id` trust rule (§15.1), and the parent/child consistency invariant (§9).

---

## 3. Environment and namespace findings (carried from v1.4)

- `etmmuzwxtcjipwphdola` ("Olumi") is the only viable migration target and holds canonical V5 data; UI and CEE share this one project.
- Formal production/staging label remains partially unresolved; evidence points to shared dev/staging plus early-pilot (16 `auth.users`, about 8 test, no signups since 2025-07-19; deployed CSP points at staging backends).
- No separate rehearsal environment exists; one must be provisioned before destructive steps (§17).
- Paul must confirm the deployed `VITE_SUPABASE_URL`.
- Namespace gate passes: no live `workspaces`, `workspace_members`, `workspace_invites`, or `element_comments`.
- Orphan tables (`organisations`, `organisation_members`, `canvas_*`) remain untouched; conceptual overlaps are prior art only. Do not create or alter any orphan table.

---

## 4. Live-schema corrections (carried from v1.4)

- `scenarios.thread` does not exist live; `append_thread_entries` and `update_thread_block_state` are absent (`20260308000000_thread_persistence.sql` unapplied).
- `conversation_turns` exists, is full-shape (10 columns), RLS plus FORCE, but has 0 rows.
- Durable conversation history currently lives in `v5_conversation_turns` (per-user).
- 13 of 15 tracked RPCs are live; the live `create_shared_brief` is the CEE variant (`v_shared_id`).
- The shared-thread privacy risk is latent, not live. Migration specs are written against the live schema, not repo migrations alone. If `scenarios.thread` is ever introduced it must be per-user or excluded from private conversation display and export. No shared JSONB thread writes, backfills, exports, or debug bundles may expose one user's private turns to another member.

---

## 5. Migration gates (blocking)

### 5.1 Environment identity gate (hard)

Confirm the role of `etmmuzwxtcjipwphdola`, the migration target, the canonical-data project, and whether a separate production environment exists. Provision a rehearsal environment (none exists). Confirm the deployed `VITE_SUPABASE_URL`. No cutover until signed off.

### 5.2 Namespace and orphan-table gate (passes, with actions)

No planned name exists live. Record a disposition for each conceptually-overlapping orphan and confirm provenance before any future decommission. The migration must not touch orphan tables.

### 5.3 Live database verification checklist

`pg_tables`, `pg_policies` (predicate, command, roles), `pg_proc` (existence, signature, SECURITY DEFINER), triggers, grants, row counts, FORCE RLS per table, namespace collisions, duplicate tables, duplicate function definitions, confirm the live `create_shared_brief` body, confirm `conversation_turns` shape, confirm `v5_conversation_turns` and `v5_handler_facts` FORCE RLS. Treat migration files as intent, not state; reconcile drift (for example `20260308000000`) first. Also confirm `cee_prompt_observations` RLS status (disabled, 0 rows): out of tenancy scope, security backlog.

### 5.4 Expanded preflight checks (new in v1.5)

Before writing any migration SQL, capture and review:
- **Function owners** for every in-scope and helper function (no superuser ownership; fixed owner).
- **Table owners** for every in-scope and new table.
- **Default privileges** (`ALTER DEFAULT PRIVILEGES` in `public`) that might grant unexpected access to new objects.
- **Exposed schemas** (PostgREST `db-schemas`) to confirm only intended schemas are API-exposed.
- **PostgREST grants** (the `anon`/`authenticated` API roles) on tables and functions.
- **Duplicate helper names** and **duplicate RPC names** (overloads or cross-repo redefinitions).
- **Live function bodies versus repo definitions** (drift), starting with `create_shared_brief` (confirmed CEE variant) and the absent thread RPCs.
- **Existing grants to `anon`, `authenticated`, and `service_role`** on all in-scope tables (the `anon` DML grants on the two CEE tables are the known issue, §13).

---

## 6. Tables in scope and out of scope

In scope: `scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`. Out of scope, frozen: `teams`, `team_members`, `invitations`, `decisions`, `decisions.team_ids`, `decision_collaborators`. Orphans (`canvas_*`, `organisations`, `organisation_members`): do not touch, do not collide.

---

## 7. Current live baseline (verified 2026-06-02)

| Table | Rows | Cols | RLS | FORCE | Policies | Grants |
|---|---|---|---|---|---|---|
| `scenarios` | 391 | 22 | yes | yes | 4 (`auth.uid()=user_id`) | authenticated, service_role |
| `shared_briefs` | 0 | 10 | yes | yes | 1 SELECT | authenticated, service_role |
| `scenario_snapshots` | 0 | 11 | yes | yes | 2 | authenticated, service_role |
| `conversation_turns` | 0 | 10 | yes | yes | 2 | authenticated, service_role |
| `v5_conversation_turns` | 1543 | 12 | yes | **no** | 1 SELECT, role public | **anon**, authenticated, service_role |
| `v5_handler_facts` | 496 | 10 | yes | **no** | 1 SELECT, role public | **anon**, authenticated, service_role |

No `scenarios.thread` column. All eleven in-scope policies use `auth.uid() = user_id`.

---

## 8. Target workspace model: full table, RLS, and lifecycle specification

Built fresh. Illustrative DDL and policies are normative in intent; final form set at implementation.

### 8.1 Centralised role hierarchy and helpers

Single source of role order: `owner` > `admin` > `editor` > `viewer`. All gating uses `is_workspace_member(p_workspace_id)` and `is_workspace_role(p_workspace_id, p_min_role)`, both SECURITY DEFINER so they bypass RLS and avoid the recursion trap (see §14).

### 8.2 `workspaces`

Columns: `id uuid pk`, `name text not null`, `is_personal boolean not null default false`, `created_by uuid not null references auth.users(id)`, `created_at`, `updated_at`. Grants: `authenticated`, `service_role`; no anon. FORCE RLS.
Policies: SELECT `is_workspace_member(id)`; INSERT only via the creation RPC (§8.6); UPDATE `is_workspace_role(id,'admin')`; DELETE forbidden in MVP (no policy).

### 8.3 `workspace_members`

Columns: `id uuid pk`, `workspace_id uuid not null references workspaces(id) on delete cascade`, `user_id uuid not null references auth.users(id)`, `role text not null check (role in ('owner','admin','editor','viewer'))`, `created_at`, `updated_at`, `unique (workspace_id, user_id)`. Grants: `authenticated`, `service_role`; no anon. FORCE RLS.
Policies: SELECT `is_workspace_member(workspace_id)`; INSERT/UPDATE/DELETE via lifecycle RPCs only (§8.7). Invariants: exactly one `owner` per workspace; a personal workspace has exactly one member (the owner) and permits no invites.

### 8.4 `workspace_invites`

Columns: `id uuid pk`, `workspace_id uuid not null references workspaces(id) on delete cascade`, `email text not null`, `role text not null check (role in ('admin','editor','viewer'))`, `invited_by uuid not null references auth.users(id)`, `status text not null check (status in ('pending','accepted','revoked','expired')) default 'pending'`, `token_hash text not null`, `created_at`, `expires_at not null`. Grants: `authenticated`, `service_role`; no anon. FORCE RLS. Privacy and lifecycle in §8.8.

### 8.5 Non-member inference prevention

A non-member SELECT on any of the three tables returns zero rows, with no error that distinguishes "exists but forbidden" from "does not exist". Membership, invites, and workspace existence are not inferable by non-members.

### 8.6 Owner-atomic workspace creation (new)

Workspace creation must never produce an ownerless workspace. Approved pattern (preferred): an **RPC-only** `create_workspace(p_name)` that, in a single transaction, inserts the `workspaces` row and the creator's `owner` row in `workspace_members`. Acceptable alternative: a trigger that creates the owner membership on workspace insert, with strict rollback so a failure leaves no workspace. **Direct table insert into `workspaces` is not allowed unless it guarantees owner membership atomically.** A personal workspace is created the same way with `is_personal = true` and no further members.

Tests: ownerless-workspace rejection; personal-workspace invariant; owner membership created in the same transaction (§18).

### 8.7 Member and invite lifecycle boundaries (new)

Lifecycle is **RPC-only**: workspace creation, invite create, invite accept, invite revoke/expire, member remove, and role change all go through SECURITY DEFINER RPCs. No direct table policy grants these mutations. If any direct policy is later retained, it must specify exact `WITH CHECK` constraints and the lifecycle guards below.

Constraints, enforced in the RPCs:
- An admin cannot remove the owner.
- An admin cannot grant `owner` (only an owner-level transfer, deferred, can move ownership).
- No member can escalate their own role.
- A removed member loses access immediately (membership row deleted).
- Owner transfer is deferred unless separately designed.
- The personal-workspace owner cannot be removed.
- Invite status transitions are constrained: `pending` may go to `accepted`, `revoked`, or `expired`; no transition out of a terminal state; no backward transitions.

Tests: direct member-lifecycle bypass rejection; direct invite-lifecycle bypass rejection; admin cannot remove or grant owner; self-escalation rejection; removed-member access loss (§18).

### 8.8 Invite privacy hardening (new)

- Invite self-view and acceptance require a **verified email** matching the invite; an email mismatch is rejected.
- Tokens are **hashed at rest** (`token_hash`, never the raw token), **single-use**, and **expiry-enforced**; token reuse is rejected; an expired token is rejected.
- Pending invite email visibility is restricted to the workspace **owner/admin and the invitee** only; no other member or non-member can read invite email addresses.

Tests: verified-email mismatch rejection; token reuse rejection; expired-invite rejection; pending-invite-email visibility restriction (§18).

---

## 9. Parent/child workspace consistency invariant (new, blocking)

**Any child row that carries both `scenario_id` and `workspace_id` must derive `workspace_id` server-side from `scenarios.workspace_id`. Client-supplied and caller-supplied `workspace_id` is never trusted.**

Applies to: `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`, a future `element_comments`, future patch and suggestion tables, and any future child table with both columns.

Enforcement (use at least one DB-level mechanism, not RPC discipline alone):
- **Preferred: composite foreign key.** Add a unique constraint on `scenarios(id, workspace_id)` (trivially unique since `id` is the primary key), then declare each child FK as `(scenario_id, workspace_id) references scenarios(id, workspace_id)`. This makes an inconsistent child `workspace_id` impossible at the database level.
- **And: RPC-only writes** that set the child `workspace_id` from the parent (`select workspace_id from scenarios where id = p_scenario_id`), so clients never supply it.
- **Or: a trigger** that sets or validates `NEW.workspace_id = (select workspace_id from scenarios where id = NEW.scenario_id)` and rejects a mismatch.

Tests: child `workspace_id` mismatch rejection for each child table (§18).

---

## 10. `workspace_id` immutability (new)

Once set, `workspace_id` is **immutable** on all migrated and workspace-linked tables, unless a dedicated, audited transfer RPC exists. Applies to the six V5 tables, the new workspace-linked tables, and future comments/suggestions tables. Enforce by excluding `workspace_id` from the updatable column set (UPDATE policy `WITH CHECK` that requires `workspace_id` unchanged) or a trigger that rejects a change. Preserve `user_id` as creator/authorship attribution unless explicitly retired.

Tests: `workspace_id` immutability (UPDATE attempt rejected) on each in-scope table (§18).

---

## 11. Role and capability matrix (proposed default, pending Paul sign-off)

**Tag: proposed default, pending Paul sign-off.** Do not implement until signed off. The per-RPC table (§15.2) uses this default and marks dependencies on final sign-off. v1.5 recommended default refines v1.4: viewers can read and comment; editors propose patches but do not accept them; publishing is gated by `approver_flag` regardless of base role.

| Capability | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Read workspace scenarios | yes | yes | yes | yes |
| Create scenario | yes | yes | yes | no |
| Edit graph directly when holding lock | yes | yes | yes | no |
| Propose patch | yes | yes | yes | no |
| Accept or reject patch | yes | yes | no (propose only) | no |
| Comment | yes | yes | yes | yes |
| Resolve own comment | yes | yes | yes | yes |
| Resolve any comment | yes | yes | no (own only) | no |
| Create snapshot | yes | yes | yes | no |
| Publish brief | yes if `approver_flag` | yes if `approver_flag` | yes only if `approver_flag` | no |
| Invite member | yes | yes | no | no |
| Remove member | yes | yes, except owner | no | no |
| Change member role | yes | yes, except owner and cannot grant owner | no | no |
| Manage workspace settings | yes | yes | no | no |
| Delete workspace | forbidden in MVP | forbidden | forbidden | forbidden |
| Transfer ownership | deferred | no | no | no |

Recommended v1.5 default, in words: viewers can read and comment but cannot propose patches, edit, snapshot, or publish; editors can create scenarios, edit the graph when holding the lock, propose patches, create snapshots, and resolve their own comments; owner and admin can accept or reject patches and manage members; publishing a brief requires `approver_flag` regardless of base role; workspace deletion is forbidden in the MVP; ownership transfer is deferred.

Open decisions for sign-off (highlighted): can viewers comment (defaulted yes); can editors accept or reject patches or only propose (defaulted propose-only); how `approver_flag` interacts with owner/admin/editor (defaulted: gate independent of base role); who can resolve comments (defaulted: own only for editor, any for owner/admin); who can create snapshots (defaulted editor-or-above).

---

## 12. In-scope V5 table RLS migration

### 12.1 Expand, backfill, switch

Expand: create workspace tables and helpers; add nullable `workspace_id` to each in-scope table; add the composite-FK consistency mechanism (§9); keep existing `auth.uid()=user_id` policies. Backfill: one personal workspace per existing distinct `user_id` (owner member, owner-atomic per §8.6); set child `workspace_id` from the parent scenario; verify zero NULLs; set NOT NULL. Switch: replace predicates (§12.2), add FORCE RLS to the two CEE tables (§13), enforce immutability (§10), rewrite RPCs (§15), and land CEE caller-layer enforcement together.

### 12.2 Privacy classification and switch predicates

| Table | Class | SELECT | Write |
|---|---|---|---|
| `scenarios` | Workspace-shared | `is_workspace_member(workspace_id)` | `is_workspace_role(workspace_id,'editor')` |
| `shared_briefs` | Workspace-shared (+ public-by-slug, §16) | `is_workspace_member(workspace_id)` | via `create_shared_brief` only |
| `scenario_snapshots` | Workspace-shared, immutable | `is_workspace_member(workspace_id)` | INSERT requires editor-or-above (§12.3) |
| `conversation_turns` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | INSERT own only |
| `v5_conversation_turns` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | service-role only (§15) |
| `v5_handler_facts` | Per-user (SEC-10) | `auth.uid()=user_id and is_workspace_member(workspace_id)` | service-role only (§15) |

### 12.3 Snapshot write permissions

Default: snapshot creation requires editor-or-above; viewers cannot create snapshots. Reviewer snapshots, if wanted later, are a separate design decision.

---

## 13. H-1+ hardening cluster (`v5_conversation_turns`, `v5_handler_facts`)

In the switch step, for both tables: add FORCE RLS; change the SELECT policy role from `public` to `authenticated`; revoke `anon` table grants; keep writes service-role-only (no permissive `authenticated` write policy) unless explicitly justified; add anon read/write denial tests and cross-user denial tests (§18).

---

## 14. SECURITY DEFINER helper hardening

For every helper and SECURITY DEFINER RPC: `SET search_path = pg_catalog, public`; schema-qualify tables; fixed non-superuser owner; `REVOKE EXECUTE FROM PUBLIC` then `GRANT EXECUTE` only to required roles; recursion avoidance (RLS helpers are SECURITY DEFINER so they bypass the policies that call them); centralised role hierarchy; helpers return boolean only and never error-differentiate existence; tests for non-member denial and helper behaviour (§18).

---

## 15. RPC migration, per-RPC permissions, and service-role semantics

### 15.1 Service-role `p_workspace_id` trust blocker (carried, blocker-class)

CEE service-role paths bypass RLS, so a client-supplied `p_workspace_id` is never authority. For every service-role read or write: resolve `scenario_id` to `workspace_id` server-side; verify the authenticated user's membership of that resolved workspace; if a `p_workspace_id` is supplied, compare and reject on mismatch. Applies to `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`, and the `build-turn-context.ts` fact reads (which must filter `user_id = current_user`).

### 15.2 Per-RPC permission table (user-callable RPCs)

Derivation column states how `workspace_id` is obtained. All live user-callable RPCs are SECURITY DEFINER and currently assert `auth.uid() = user_id` on the scenario; the migration converts that to membership and role checks. Roles reference the §11 proposed default (pending sign-off).

| RPC | `workspace_id` derivation | Required role/capability | Trusted inputs | Rejected inputs | Idempotency | Public/anon grant | Child consistency |
|---|---|---|---|---|---|---|---|
| `append_scenario_event` | from `scenarios` by `p_scenario_id` | editor-or-above (member) | `p_event_id`, `p_event_type`, `p_details` | any client `workspace_id` | on `(scenario_id, event_id)` | no anon | n/a (writes `scenarios.events`) |
| `apply_patch_and_log` | from `scenarios` | editor-or-above, lock holder | `p_graph`, `p_event_id` | client `workspace_id` | on `(scenario_id, event_id)` | no anon | n/a (writes `scenarios.graph`) |
| `store_analysis_and_log` | from `scenarios` | editor-or-above (or system) | `p_analysis`, `p_event_id` | client `workspace_id` | on `(scenario_id, event_id)` | no anon | n/a |
| `store_analysis_failure` | from `scenarios` | editor-or-above (or system) | `p_error`, `p_event_id` | client `workspace_id` | on `(scenario_id, event_id)` | no anon | n/a |
| `store_brief_and_log` | from `scenarios` | editor-or-above | `p_brief`, `p_event_id` | client `workspace_id` | on `(scenario_id, event_id)` | no anon | n/a |
| `set_stage_and_log` | from `scenarios` | editor-or-above | `p_new_stage`, `p_event_id` | client `workspace_id`, invalid stage | on `(scenario_id, event_id)` | no anon | n/a |
| `create_shared_brief` | from `scenarios` | `approver_flag` (publish) | `p_scenario_id` | client `workspace_id` | one share per request | no anon (the share read is public via slug, §16) | yes (`shared_briefs.workspace_id` from parent) |
| `create_snapshot` | from `scenarios` | editor-or-above (§12.3) | snapshot payload | client `workspace_id` | per call | no anon | yes (`scenario_snapshots.workspace_id` from parent) |
| `insert_conversation_turn` | from `scenarios` | member; writes own row (`user_id = auth.uid()`) | turn payload, `p_client_turn_id` | client `workspace_id`, other users' `user_id` | on `(scenario_id, client_turn_id)` | no anon | yes (`conversation_turns.workspace_id` from parent) |
| `get_shared_brief_by_slug` | none (slug-keyed) | none (public) | `p_slug` | anything not on the allowlist | n/a | **anon and authenticated** | n/a (returns allowlisted public fields only, §16) |

Absent live RPCs (documented separately): `append_thread_entries` and `update_thread_block_state` are not present live (migration `20260308000000` unapplied). If they are revived, they must derive `workspace_id` from the parent scenario, be per-user, and satisfy the child-consistency invariant (§9). Their fate is a manual decision (§19).

### 15.3 Service-role scenario creation semantics (`ensure_scenario_exists`, new, blocker-class)

If the scenario already exists: CEE resolves `scenario_id` to `workspace_id` server-side; verifies the authenticated user is a member; any supplied `p_workspace_id` must match the resolved value or be rejected.

If the scenario does not exist: CEE must resolve an authorised workspace for the authenticated user before creation; it must not trust `p_workspace_id` as authority; if `p_workspace_id` is supplied, CEE verifies the user is a member of that workspace before creation; if no workspace is supplied, CEE uses the user's personal or default workspace only through a server-side lookup; the row is created with the server-resolved workspace; unauthorised or mismatched workspace IDs are rejected.

This is a blocker-class invariant and pairs with §9 (the created scenario's children inherit `workspace_id` from it) and §15.1.

---

## 16. Public brief allowlist (finalised)

Public `get_shared_brief_by_slug` may return only:
- `brief`,
- `graph_hash`, only if needed for reproducibility and confirmed non-sensitive,
- `created_at`,
- `expires_at`.

Dropped from the public response by default (the live function currently returns them): `seed_used`, `response_hash`. If either should remain public for reproducibility, that is a **decision requiring Paul/ChatGPT sign-off**, not implementation-ready; flag it, do not ship it by default.

The public response must never include: `workspace_id`, `scenario_id`, `user_id`, member data, invite data, private conversation or thread data, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`, internal debug fields, or unsafe provenance fields.

Tests: public brief leak tests for `create_shared_brief` and `get_shared_brief_by_slug` (only allowlisted fields returned) (§18).

---

## 17. Rollback and rehearsal (carried from v1.4)

Rehearse on a clone or fresh project before touching canonical data (none exists today, provision one). Sequence: gates pass; expand (additive, including the composite-FK consistency mechanism); backfill personal workspaces and child `workspace_id` from parents; verify; switch policies, add FORCE RLS, enforce immutability, rewrite RPCs, land CEE enforcement together. Rollback window: expand and backfill are reversible; the switch is behind a clear release boundary with CEE checks reverted in lockstep. No-rollback point: once workspace-shared writes or member changes have occurred, simple revert is unsafe; gate this boundary. Reconcile counts before and after. Maintain dual-compatibility during expand/backfill so the running app is never locked out. Abort if rehearsal fails, backfill leaves NULLs, reconciliation mismatches, or any cross-user denial test fails. Proceed only when rehearsal is green, all SEC/TEN tests pass, reconciliation is exact, and the environment gate is signed off.

---

## 18. SEC/TEN test matrix (expanded; all v1.4 cases preserved)

| ID | Test | Expect |
|---|---|---|
| SEC-01 | Non-member reads a workspace scenario | denied |
| SEC-02 | Non-member infers workspace membership or existence | not inferable |
| SEC-03 | Viewer mutates a scenario | denied |
| SEC-04 | Editor proposes a patch | allowed |
| SEC-05 | Editor publishes a brief without `approver_flag` | denied |
| SEC-06 | Owner or admin invites a member | allowed |
| SEC-07 | Owner or admin removes a member | allowed |
| SEC-08 | Admin removes the owner | denied |
| SEC-09 | Admin grants owner | denied |
| SEC-10 | Removed member retains access | denied (access lost) |
| SEC-11 | User A reads User B `conversation_turns` | denied |
| SEC-12 | User A reads User B `v5_conversation_turns` | denied |
| SEC-13 | User A reads User B `v5_handler_facts` | denied |
| SEC-14 | Service-role context builder injects cross-user facts | prevented |
| SEC-15 | CEE accepts a mismatched `p_workspace_id` | rejected |
| SEC-16 | Anon reads or writes `v5_conversation_turns` | denied |
| SEC-17 | Anon reads or writes `v5_handler_facts` | denied |
| SEC-18 | Public brief slug returns non-allowlisted fields | only allowlisted fields returned |
| SEC-19 | Editor accepts or rejects a patch (no lock/role) | denied (propose-only default) |
| SEC-20 | Member escalates own role | denied |
| SEC-21 | Pending invite email visible to non-admin member | not visible |
| SEC-22 | Invite accept with mismatched verified email | rejected |
| SEC-23 | Invite token reused | rejected |
| SEC-24 | Expired invite token used | rejected |
| TEN-01 | Migration touches orphan `canvas_*` or `organisations` | no change to orphans |
| TEN-02 | Rollback rehearsal on clone or fresh project | passes |
| TEN-03 | Backfill leaves any NULL `workspace_id` | none; reconciliation exact |
| TEN-04 | Pending invite email visible to non-admin (data-layer) | not visible |
| TEN-05 | Ownerless workspace created | rejected |
| TEN-06 | Personal workspace invariant (single owner, no invites) | enforced |
| TEN-07 | Owner membership created in same transaction as workspace | enforced |
| TEN-08 | Child row `workspace_id` mismatches parent scenario | rejected (each child table) |
| TEN-09 | `workspace_id` updated after set (no transfer RPC) | rejected (each in-scope table) |
| TEN-10 | Direct member-lifecycle mutation bypassing RPC | rejected |
| TEN-11 | Direct invite-lifecycle mutation bypassing RPC | rejected |

---

## 19. Manual blockers (carried, still gating implementation)

1. Paul confirms the deployed `VITE_SUPABASE_URL`.
2. Paul provisions or approves a rehearsal environment.
3. Paul decides the fate of `20260308000000_thread_persistence.sql` (forward-plan, abandon, or reconcile later).
4. Paul signs off the role and capability matrix (§11), including the highlighted open decisions.
5. Any remaining v1.2 source-reference markers are resolved if the source documents are supplied.

---

## 20. Migration-readiness verdict

- **Ready for Codex re-review: yes**, with all the above changes included. Run the review on **v1.5**.
- **Ready for implementation brief: no**, not until the Codex re-review of v1.5 is clean and Paul signs off the manual blockers (§19).
- **Ready for SQL or code implementation: no.**

---

## Appendix A: source reconciliation

v1.2 source documents not on disk; requirements reconstructed from the audits and the Codex reviews; markers **[v1.2 ref pending]** to be resolved when supplied. SEC/TEN identifiers are this document's own; reconcile to the canonical scope-contract identifiers when v1.2 arrives. The second Codex review of v1.4 was folded in as conveyed by the v1.5 brief (block pending spec changes, all findings accepted); if the original review text is later supplied, reconcile any finding not already covered here.

## Appendix B: base commits and live evidence

- **Branch:** `claude/tenancy-rls-migration-spec-v1_5`, cut from `claude/tenancy-rls-migration-spec-v1_4` (`e62e5f11`). This draft adds exactly one file. No push.
- **Lineage and inputs:** v1.4 (`e62e5f11`); environment audit (`22b8135e`); v1.3 (`7b2ce689`); phase-0 (`1e1028bf`); teams disposition (`a9d80d12`); surface-recon (`5c98a57c`).
- **Live introspection (2026-06-02, read-only, `etmmuzwxtcjipwphdola`):** six V5 tables RLS/FORCE/policies/grants/counts; `scenarios.thread` and two thread RPCs absent; 13/15 RPCs present; `create_shared_brief` is the CEE variant; orphan inventory; environment signals.
- **Method:** specification only; no code, schema, migration, prompt, package, lockfile, generated, test, or config files changed.

---

*End of draft v1.5*
