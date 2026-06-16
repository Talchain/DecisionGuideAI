# Tenancy and collaboration migration spec v1.7 (draft)

**Status:** Draft for Codex delta-check. Specification only. No migration has been started.
**Date:** 2026-06-04 (follow-up clarifications folded in 2026-06-16).
**Supersedes:** v1.6 (`docs/specs/tenancy-collab-migration-spec-v1_6-draft.md`, kept for history). **v1.7 is the working baseline.**
**Reason for v1.7:** Codex reviewed v1.6 and returned approve with required amendments. The core security model is sound; v1.7 is a narrow precision pass addressing five gaps before implementation briefs, plus two follow-up clarifications requested on 16 June 2026: the migration window must explicitly cover the CEE service-role write paths, and the first implementation brief is fixed as graph-mutation-free. All v1.6 content is carried unless amended below; all v1.5/v1.6 security invariants are preserved.
**Scope:** specification and decision record only. No code, schema, migration, prompt, package, lockfile, generated, test, config, or SQL changes. Illustrative SQL is documentation, not a migration file.

---

## 0. v1.6 to v1.7 changelog

Five Codex-required amendments:

1. **`accept_suggestion` is a guarded mutation RPC** (§15.2, §15.4): it mutates canonical graph state, so owner/admin permission alone is insufficient; it must obey the same guarded-mutation contract as a manual edit (hold or internally validate the active scenario edit lock, revalidate the suggestion, check `base_event_seq` and `base_graph_hash`, apply optimistic concurrency, append a logged attributed event) and must reject if another valid lock exists. `reject_suggestion` does not mutate the graph but still requires owner/admin and logs/attributes the resolution.
2. **Workspace updates constrained to allowlisted safe settings fields** (§8.2): security and lifecycle fields are immutable or RPC-only; personal-workspace invariants cannot be changed through generic update paths.
3. **`element_comment_reads` privacy and parent consistency specified** (§12.1, §21): per-user metadata, server-derived immutable `user_id`, own-only mutation, unique `(comment_id, user_id)`, parentage derived through `element_comments` and its scenario.
4. **New-write handling during the migration window defined** (§20): a write freeze or a dual-compatible/trigger-derived assignment, a final delta backfill and assertion gate, and an abort on any NULL or mismatched `workspace_id`; no mixed state at cutover.
5. **Readiness blockers expanded** (§22, §23): Codex findings must be addressed before implementation briefing; the first implementation brief remains graph-mutation-free, with the first slice fixed; existing blockers retained.

Two follow-up clarifications (16 June 2026), each refining one of the amendments above:

6. **Migration window covers the CEE service-role write paths** (§15.1, §20, §21): refines amendment 4. `append_turn_atomic`, `ensure_scenario_exists`, and `store_draft_graph` bypass RLS, so any scenario or child row they create during the expand/backfill/switch window must receive a valid `workspace_id` immediately through the approved server-side resolution path; the final delta backfill and assertion gate cover rows written by both user-callable RPCs and CEE service-role RPCs.
7. **First implementation brief fixed as graph-mutation-free** (§22, §23): refines amendment 5. The first slice is fixed at workspace context, workspace switcher, members list, invite lifecycle skeleton, and scenario presence, with no graph mutation; graph-mutation work cannot enter the first slice. Three additional hard blockers (CEE service-role verification as a cross-repo workstream, a rehearsal environment, and an executable security matrix) are added to the migration/cutover gate.

Everything else from v1.6 (environment and namespace findings; live-schema corrections; the migration gates and expanded preflight; H-1+ hardening; SECURITY DEFINER helper hardening; the service-role `p_workspace_id` trust rule and scenario-creation semantics; owner-atomic workspace creation; member/invite lifecycle boundaries; invite privacy hardening; the signed-off role matrix; child-consistency and `workspace_id` immutability; the public brief allowlist; Realtime channel authorisation; the thread decision and conversation-store open choice; the TAE checkpoint closure) is carried forward unchanged.

---

## 1. Purpose and scope

As v1.6: convert the V5 surface to workspace-scoped multi-tenancy with fresh `workspaces`/`workspace_members`/`workspace_invites`, plus the collaboration tables (`scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`) and `scenario_snapshots.workspace_id`, under one canonical membership-based RLS model. Out of scope: legacy teams/decisions (C-lite, frozen), the orphan `canvas_*`/`organisations` stack (untouched), V1 decommission, the collaboration UI build, and any schema or code change.

---

## 2. Locked decisions (carried from v1.6)

C-lite legacy disposition; fresh workspace model; `v5_handler_facts` per-user; the blocking migration gates; the signed-off role and capability matrix (Paul, 4 June 2026); the thread decision (abandon the `scenarios.thread` portion of `20260308000000`; conversation-store choice open); the TAE checkpoint closure (Track A zero TAE dependency). The matrix remains as in v1.6 §11 with no `[sign-off]` cells; v1.7 only tightens how `accept_suggestion` enforces its owner/admin cell (§15).

---

## 3. Environment and namespace findings (carried from v1.6)

`etmmuzwxtcjipwphdola` is the only viable target and holds canonical V5 data (UI and CEE share it). Formal prod/staging label partially unresolved (shared dev/staging plus early-pilot). No rehearsal environment exists; one must be provisioned. Confirm the deployed `VITE_SUPABASE_URL`. Namespace gate passes (no live `workspaces`/`workspace_members`/`workspace_invites`/`element_comments`). Orphan `organisations`/`canvas_*` untouched, prior art only.

---

## 4. Live-schema corrections (carried from v1.6)

`scenarios.thread` absent; thread RPCs absent (`20260308000000` unapplied). `conversation_turns` display-shaped (`content`, `structured_blocks`) but 0 rows. `v5_conversation_turns` is session/accounting (no content), not display-ready. Narrative scattered in `v5_handler_facts.payload`. Live `create_shared_brief` is the CEE variant. Specs are written against the live schema, not migration files.

---

## 5. Migration gates (carried from v1.6)

Environment identity gate (hard); namespace/orphan gate (passes, do not touch orphans); live verification checklist; expanded preflight (function/table owners, default privileges, exposed schemas, PostgREST grants, duplicate helper/RPC names, live-versus-repo bodies, grants to `anon`/`authenticated`/`service_role`). `cee_prompt_observations` RLS disabled (0 rows, security backlog).

---

## 6. Tables in scope and out of scope (carried from v1.6)

In scope: the six V5 tables plus the new collaboration tables (`scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`); `scenario_snapshots` gains `workspace_id`. Out of scope/frozen: `teams`, `team_members`, `invitations`, `decisions`, `decisions.team_ids`, `decision_collaborators`. Orphans untouched.

---

## 7. Current live baseline (carried; verified 2026-06-04)

Six V5 tables as in v1.6 §7: scenarios (391, RLS+FORCE, 4 policies), shared_briefs/scenario_snapshots/conversation_turns (0 rows, RLS+FORCE), `v5_conversation_turns` (1543) and `v5_handler_facts` (496) lack FORCE RLS and grant `anon` (H-1+ targets). New collaboration tables do not yet exist (greenfield, no collision).

---

## 8. Target workspace model (carried, amendment 2 applied)

Centralised role hierarchy `owner` > `admin` > `editor` > `viewer`; SECURITY DEFINER helpers `is_workspace_member` and `is_workspace_role` (recursion-safe). `workspace_members` and `workspace_invites` and their lifecycle/invite-privacy rules are carried verbatim from v1.6 §8.3, §8.4, §8.6 to §8.8 (owner-atomic creation, RPC-only lifecycle, hashed single-use tokens, verified-email acceptance, member-or-invitee visibility, non-member inference prevention).

### 8.2 `workspaces` (amended: constrained updates)

Columns: `id`, `name`, `is_personal`, `created_by`, `created_at`, `updated_at`. Grants `authenticated`/`service_role`, no anon. FORCE RLS. SELECT `is_workspace_member(id)`; INSERT only via the owner-atomic creation RPC; DELETE forbidden in MVP.

**UPDATE is constrained (amendment 2).** A workspace update (by `is_workspace_role(id, 'admin')`) may modify only an **explicit allowlist of safe settings fields**: `name` (display name), `description`, and any non-security presentation/settings field explicitly listed in the spec. The following are **immutable or RPC-only** and must not be changeable through the generic update path:
- `id`,
- `created_by`,
- `is_personal`,
- owner membership (owner is changed only by a dedicated, deferred transfer RPC, never a workspace update),
- role and security-policy fields,
- any billing, compliance, or security field, unless separately designed later.

Enforcement: the UPDATE policy `WITH CHECK` (and/or a trigger) permits changes only to the allowlisted columns and rejects any change to an immutable field; **personal-workspace invariants (single owner member, no invites, `is_personal` true) cannot be mutated through any generic update path**. The allowlist is the contract; new settings fields are added to it explicitly, never by widening the policy.

---

## 9. Parent/child workspace consistency invariant (carried from v1.6)

Any child row with both `scenario_id` and `workspace_id` derives `workspace_id` server-side from `scenarios.workspace_id`; client/caller values are never trusted. Enforced by the preferred composite foreign key (`(scenario_id, workspace_id)` references `scenarios(id, workspace_id)`), plus RPC-only writes that set it from the parent, or a validating trigger. Applies to `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`, `scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads` (the last via its parent comment, see §12.1), and any future child table.

---

## 10. workspace_id immutability (carried from v1.6)

`workspace_id` is immutable once set on all migrated and workspace-linked tables, except through a dedicated transfer RPC. Applies to the six V5 tables and the new collaboration tables and snapshots. `user_id`/author columns retained as authorship.

---

## 11. Role and capability matrix (carried from v1.6, signed off)

Unchanged from v1.6 §11 (no `[sign-off]` cells): viewers may comment; editors propose patches but do not accept; force-release owner/admin; resolve-own anyone who can comment; resolve-any owner/admin; create snapshot editor-and-above; publish any non-viewer with `approver_flag`; workspace deletion forbidden in MVP; ownership transfer deferred. v1.7 clarifies that the owner/admin "accept or reject patch" cell is additionally gated by the guarded-mutation contract for `accept_suggestion` (§15), since acceptance is a canonical graph mutation.

---

## 12. In-scope table RLS migration (carried, amendment 3 applied)

Expand, backfill, switch (see §20 for the amended migration-window handling). Privacy classes as v1.6: scenarios/shared_briefs/scenario_snapshots workspace-shared; conversation_turns/v5_conversation_turns/v5_handler_facts per-user (SEC-10). New collaboration tables carry server-derived immutable `workspace_id`, FORCE RLS, no anon grants, membership-aware policies; mutations are RPC-controlled. H-1+ hardening for the two CEE tables carried (§13). Snapshot creation requires editor-or-above.

### 12.1 `element_comments` and `element_comment_reads` (amendment 3)

`element_comments` (carried from v1.6): `id`, `scenario_id`, `workspace_id` (server-derived, §9), optional `snapshot_id`, `element_type`, `element_id`, `parent_id`, `author_id`, `label` (`challenge`/`evidence`/`note`), `body`, `resolved`, `resolved_by`, timestamps. Create by any commenter (viewers included); resolve own by anyone who can comment, resolve any by owner/admin (§11). RLS workspace-shared read.

**`element_comment_reads` (amended, per-user read/unread metadata):**
- **Per-user metadata.** Columns: `comment_id` (references `element_comments(id)` on delete cascade), `user_id`, `read_at`.
- **`user_id` is server-derived** from the current authenticated user and **immutable**; it is never accepted from the client.
- **Own-only.** A user can create, update, or delete only their own read state (`auth.uid() = user_id`), for both the row check and the with-check.
- **Unique constraint `(comment_id, user_id)`** is required; duplicate writes are rejected or handled as an idempotent upsert.
- **Parentage and consistency are derived through the parent `element_comments` row and its parent scenario** (workspace and scenario are not stored redundantly on the read row; they are reached via `comment_id` to `element_comments` to `scenarios`). A read row may exist only for a comment the user can access (a comment in a workspace the user is a member of).
- The client cannot create: a read row for another user; an orphan read row (no valid `comment_id`); a read row for a comment outside the user's workspace; or a read row with mismatched workspace/scenario parentage. The first is blocked by the server-derived `user_id`; the rest by the FK to `element_comments` plus the membership check on the parent comment's workspace.

Tests for these rules are in §21 (SEC-34 to SEC-37).

---

## 13. H-1+ hardening cluster (carried from v1.6)

For `v5_conversation_turns` and `v5_handler_facts`: add FORCE RLS; SELECT policy role `public` to `authenticated`; revoke `anon` DML; writes service-role-only; anon and cross-user denial tests.

---

## 14. SECURITY DEFINER helper hardening (carried from v1.6)

`SET search_path = pg_catalog, public`; schema-qualified tables; fixed non-superuser owner; `REVOKE EXECUTE FROM PUBLIC` then grant to required roles only; recursion avoidance; boolean-only helpers; non-member denial tests.

---

## 15. RPC migration, per-RPC permissions, and service-role semantics

### 15.1 Service-role trust rules (carried from v1.6, blocker-class)

CEE never trusts `p_workspace_id`: resolve `scenario_id` to `workspace_id` server-side, verify membership, reject mismatch. `ensure_scenario_exists` resolves an authorised workspace server-side for both exists and not-exists paths. Applies to `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`, and `build-turn-context.ts` fact reads (filter `user_id = current_user`).

These three service-role paths bypass RLS, so they also govern the migration window: any scenario or child row they write during expand/backfill/switch must receive a valid `workspace_id` at insert time through this same server-side resolution path, never a client- or caller-supplied value (§20). The three RPCs are confirmed present and live in the target project by live database introspection (environment and namespace audit, 2026-06-04); their implementation bodies live in the `olumi-assistants-service` repository, not in this repository's migrations, so the server-side workspace-resolution behaviour they require is a cross-repo verification item, not a repo-migration fact (§22, §23).

### 15.2 Per-RPC permission table (amendment 1 applied to `accept_suggestion`)

| RPC | workspace_id derivation | Required role/capability | Child consistency | Notes |
|---|---|---|---|---|
| `append_scenario_event` | from `scenarios` | editor-or-above | n/a | idempotent on `(scenario_id, event_id)` |
| `apply_patch_and_log` | from `scenarios` | editor-or-above, lock holder | n/a | logged patch path |
| `save_graph_guarded` | from `scenarios` | editor-or-above, **lock holder**, OCC (`event_seq` + `graph_hash`) | n/a | replaces last-write-wins `saveGraph`; attributed event |
| `store_analysis_and_log` / `store_analysis_failure` / `store_brief_and_log` / `set_stage_and_log` | from `scenarios` | editor-or-above (or system) | n/a | idempotent on event_id |
| `create_shared_brief` | from `scenarios` | non-viewer with `approver_flag` | yes | publish; public read by slug (§16) |
| `create_snapshot` | from `scenarios` | editor-or-above | yes | immutable |
| `insert_conversation_turn` | from `scenarios` | member; writes own row | yes | per-user; idempotent on `client_turn_id` |
| `get_shared_brief_by_slug` | none (slug) | public | n/a | allowlisted public fields only (§16) |
| `acquire_edit_lock` / `heartbeat_edit_lock` / `release_edit_lock` | from `scenarios` | editor-or-above (member) | yes | single-host lock; heartbeat and expiry |
| `force_release_edit_lock` | from `scenarios` | owner/admin only | yes | per §11 |
| `propose_suggestion` | from `scenarios` | editor-or-above | yes | records base `graph_hash` + `event_seq` |
| **`accept_suggestion`** | from `scenarios` | **owner/admin AND guarded-mutation contract** (holds the active scenario edit lock, or internally acquires/validates the same lock contract); **rejects if another valid lock exists**; revalidates the suggestion; checks `base_event_seq` and `base_graph_hash`; applies optimistic concurrency; appends a logged attributed event | yes | **guarded mutation RPC** (amendment 1) |
| `reject_suggestion` | from `scenarios` | owner/admin only | n/a (no graph mutation) | logs and attributes the resolution |
| `create_comment` | from `scenarios` | any commenter (incl viewer) | yes | viewers may comment |
| `resolve_comment` | from `scenarios` | author (own) or owner/admin (any) | yes | per §11 |
| Workspace lifecycle RPCs | n/a / from workspace | owner-atomic create; admin invite/remove/role per §11 | n/a | RPC-only lifecycle; constrained workspace update (§8.2) |

### 15.3 Service-role scenario creation semantics (carried from v1.6, blocker-class)

`ensure_scenario_exists`: exists path resolves and verifies membership and rejects a mismatched `p_workspace_id`; not-exists path resolves an authorised workspace server-side (verify membership if supplied, else the user's personal/default workspace via server-side lookup), creates with the server-resolved workspace, and rejects unauthorised or mismatched IDs.

### 15.4 Unified, guarded event path (amendment 1)

All canonical graph mutations append to `scenarios.events` through one shared, attributed core, and all obey the guarded-mutation contract:
- **Manual host edits** via `save_graph_guarded` (lock holder, OCC, attributed event).
- **Accepted suggestions** via `accept_suggestion`, which is itself a **guarded mutation RPC**: owner/admin permission alone is not sufficient; the RPC is the authority and client-side lock state is never trusted. It validates the current scenario edit lock server-side, and if another valid lock exists it rejects. If the caller holds the valid lock, the RPC validates that server-side; if the RPC supports internal lock acquisition, that acquisition is atomic and fails if any competing valid lock exists. The same `event_seq` and `graph_hash` optimistic-concurrency checks apply before mutation, the suggestion is revalidated before applying, and the mutation appends a logged, attributed event. This prevents a second graph-mutation path running while another user holds the lock.
- **AI patches** via `apply_patch_and_log` (lock holder, attributed event).

Validate-patch remains mandatory on every structural change. `reject_suggestion` does not mutate the graph but still requires owner/admin and records an attributed resolution. The suggestion queue does not ship until all canonical mutation sources use this consistent guarded, attributed path.

---

## 16. Public brief allowlist (carried from v1.6)

Public `get_shared_brief_by_slug` returns only `brief`, `graph_hash` (if needed and non-sensitive), `created_at`, `expires_at`. `seed_used` and `response_hash` dropped by default (sign-off if needed). Never ids, member/invite data, conversation/thread, the per-user tables, debug, or unsafe provenance. Leak tests required.

---

## 17. Realtime channel authorisation (carried from v1.6)

Private/authorised channels for `scenario:{id}` and `workspace:{id}`; server-side authorisation against `workspace_members` (RLS-backed channel policies); no reliance on obscurity; broadcast carries identifiers and change kinds only; failure/reconnect degrades awareness but never canonical correctness; graph writes safe because authority is server-side. Negative and revocation tests (§21 SEC-25 to SEC-28).

---

## 18. Conversation scoping and thread decision (carried from v1.6)

`v5_conversation_turns` not display-ready; `conversation_turns` display-shaped but empty. Thread decision recorded: abandon the `scenarios.thread` portion of `20260308000000`; reconcile/forward-plan only the per-user store. The final `conversation_turns` choice remains open and gates the conversation implementation brief (revive as a UI projection versus a new projection versus a bounded in-memory MVP). Per-user RLS and server-derived `workspace_id` apply whichever is chosen.

---

## 19. Track B / TAE checkpoint closure (carried from v1.6)

No foundation-level TAE data structures required for the collaboration MVP. Event-author attribution (the unified guarded event path, §15.4) and per-user privacy are sufficient foundations. Estimate records, dissent logs, deliberation stages, calibration snapshots, contribution tracking remain post-MVP / P3. Track A proceeds with zero TAE dependency.

---

## 20. Rollback, rehearsal, and migration-window handling (amendment 4)

Rehearse on a clone or fresh project before touching canonical data (none exists; provision one). Sequence: gates pass; expand (additive, including the composite-FK consistency mechanism for all child tables); backfill personal workspaces and child `workspace_id` from parents; verify; switch policies, add FORCE RLS, enforce immutability, rewrite RPCs, land CEE enforcement together. Reversible expand/backfill; switch behind a clear release boundary with CEE checks reverted in lockstep. No-rollback point once workspace-shared writes or member changes occur. Reconcile counts.

**Migration-window handling (amendment 4).** New scenario or child rows can be created between the initial backfill and the policy switch. To prevent a mixed state:
- Before the policy switch, do one of:
  - run a **short write freeze** for scenario and child-table writes during the cutover window, or
  - deploy a **dual-compatible write path or trigger-derived `workspace_id` assignment** before backfill, so every new row gets a valid `workspace_id` at insert time.
- **Any new scenario or child row created during the migration window must receive a valid `workspace_id` immediately** (via the dual-compatible path/trigger, or it is blocked by the freeze).
- A **final delta backfill and an assertion gate run immediately before the policy switch**, catching any late writes.
- The **switch aborts** if any in-scope table has `workspace_id IS NULL` or a parent/child `workspace_id` mismatch. **No mixed state is allowed at cutover.**

**CEE service-role write paths during the window (follow-up clarification, 16 June 2026).** The strategy above must explicitly cover the CEE service-role write paths, because they bypass RLS: `append_turn_atomic`, `ensure_scenario_exists`, and `store_draft_graph`.
- Every scenario or child row created by these service-role paths during the expand, backfill, and switch window must receive a valid `workspace_id` immediately, derived through the approved server-side workspace resolution path (§15.1, §15.3), never a client- or caller-supplied value.
- The final delta backfill and assertion gate must cover rows written by **both** user-callable RPCs and CEE service-role RPCs. A row written by CEE during the window is in scope for the pre-switch assertion gate exactly as a user-written row is.
- Because the service-role RPC bodies live in `olumi-assistants-service` (not this repository), the proof that they derive `workspace_id` server-side during the window is a cross-repo verification item and a hard migration/cutover blocker (§22, §23). This repository can specify the requirement but cannot prove it alone.

**Rehearsal checks (follow-up clarification).** The rehearsal on the clone or fresh project must assert each of:
- rows created during the migration window receive a `workspace_id`;
- service-role writes (the three CEE RPCs) receive a `workspace_id`;
- the delta backfill catches late writes;
- the policy switch aborts on any NULL or mismatched `workspace_id`.

**Abort criteria:** rehearsal failure, NULL backfill, count mismatch, any cross-user denial test failure, or any NULL/mismatched `workspace_id` at the pre-switch assertion gate (for user-callable or CEE service-role writes). **Proceed criteria:** rehearsal green (including the four rehearsal checks above), all SEC/TEN tests pass, reconciliation exact, the delta backfill clean, and the environment gate signed off.

---

## 21. SEC/TEN test matrix (carried plus v1.7 additions)

Carried from v1.6: SEC-01 to SEC-33 and TEN-01 to TEN-14 (membership, role, per-user privacy, service-role, anon, public brief, invite, ownerless/personal-workspace, child-consistency, immutability, lifecycle-bypass, realtime channel authorisation negative/revocation, and the signed-off-matrix tests).

v1.7 additions:

| ID | Test | Expect |
|---|---|---|
| SEC-34 | User A creates or updates User B's `element_comment_reads` row | denied (server-derived `user_id`) |
| SEC-35 | Non-member creates or reads `element_comment_reads` | denied |
| SEC-36 | Read row points to an inaccessible or mismatched comment (out-of-workspace, orphan, or mismatched parentage) | rejected |
| SEC-37 | Duplicate `(comment_id, user_id)` read row | rejected or idempotently upserted |
| SEC-38 | `accept_suggestion` while another user holds a valid edit lock | rejected (guarded mutation) |
| SEC-39 | `accept_suggestion` with a stale `base_event_seq`/`base_graph_hash` | rejected (revalidate + OCC) |
| SEC-40 | Workspace update attempts to change `id`, `created_by`, `is_personal`, owner membership, or a security field | rejected (allowlist) |
| SEC-41 | Generic workspace update attempts to alter a personal-workspace invariant | rejected |
| TEN-15 | Row created during the migration window | receives a valid `workspace_id` immediately |
| TEN-16 | Delta backfill before switch | catches all late writes |
| TEN-17 | Policy switch with any `workspace_id IS NULL` or parent/child mismatch | aborts |
| TEN-18 | CEE service-role write (`append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`) during the migration window | receives a valid `workspace_id` via server-side resolution; covered by the pre-switch delta backfill and assertion gate |
| TEN-19 | Pre-switch assertion gate over both user-callable and CEE service-role writes | no NULL or mismatched `workspace_id` from either source; otherwise aborts |

---

## 22. Migration-readiness verdict (amendment 5)

- **Ready for Codex delta-check: yes**, on **v1.7**.
- **Ready for implementation: no.** Codex review findings (this v1.7 amendment set) must be addressed and the delta-check clean before implementation briefing. Implementation also remains blocked until the deployed `VITE_SUPABASE_URL` is confirmed and a rehearsal environment is provisioned or approved.
- **First implementation brief is graph-mutation-free.** Codex review findings (this v1.7 amendment set) must be addressed before implementation briefing. Graph-mutation work cannot enter the first slice. The first slice is fixed: workspace context, workspace switcher, members list, invite lifecycle skeleton, scenario presence, and no graph mutation. The edit-lock, guarded-save, suggestion-queue, and `accept_suggestion` work (all graph-mutating) come in later slices, behind the absolute graph-mutation gate.
- **Migration and cutover hard blockers (promoted, 16 June 2026).** Migration implementation and cutover are additionally blocked until each of the following holds. The spec may be approved before they are satisfied, but no migration implementation or cutover may proceed without them:
  - **CEE service-role workspace-resolution verified.** That `append_turn_atomic`, `ensure_scenario_exists`, and `store_draft_graph` derive `workspace_id` server-side (including during the migration window, §15.1, §20) is a separate cross-repo workstream in `olumi-assistants-service`; this repository can specify the requirement but cannot prove it. Any implementation brief touching migration, service-role writes, or tenancy cutover must include CEE verification or explicitly wait for that workstream.
  - **Rehearsal environment provisioned or approved.** A rehearsal Supabase environment or approved clone is required before any destructive or canonical tenancy migration work (none exists today, §3).
  - **Executable security matrix.** The SEC/TEN matrix (§21) must be executable before cutover is considered safe. If CI cannot currently run the relevant security and RLS matrix, that is a hard implementation and cutover blocker, not a documentation concern.
- Ready for SQL or code: no.

---

## 23. Manual blockers (carried plus amendment 5)

1. Codex delta-check on v1.7 is clean (the five amendments and the two follow-up clarifications addressed).
2. Paul confirms the deployed `VITE_SUPABASE_URL`.
3. Paul provisions or approves a rehearsal environment (hard migration/cutover blocker, §22).
4. The `conversation_turns` choice is made in the conversation implementation brief (the `scenarios.thread` portion is abandoned, §18).
5. The first implementation brief remains graph-mutation-free (the fixed first slice, §22).
6. CEE service-role workspace-resolution is verified as a cross-repo workstream in `olumi-assistants-service` before any migration, service-role-write, or cutover brief proceeds (hard migration/cutover blocker, §15.1, §20, §22).
7. The SEC/TEN security matrix is executable (working CI) before cutover; a CI that cannot run the security and RLS matrix is itself a hard cutover blocker (§21, §22).
8. Any remaining v1.2 source-reference markers are resolved if the source documents are supplied.

The role and capability matrix is signed off (v1.6 §2.1 / §11); no open matrix cells remain.

---

## Appendix A: source reconciliation

v1.2 source documents not on disk; requirements reconstructed from the audits, the design recommendations, and the Codex reviews; `[v1.2 ref pending]` markers to resolve when supplied. SEC/TEN identifiers are this document's own. The v1.6 Codex review (approve with required amendments) is addressed by the five amendments here, and the two follow-up clarifications of 16 June 2026 (CEE service-role coverage in the migration window; the fixed graph-mutation-free first slice) are folded in; the earlier reviews are folded in v1.5/v1.6.

## Appendix B: base commits and lineage

- **Branch:** v1.7 content lives on `claude/tenancy-collab-spec-v1_6` (PR #190). The original v1.7 commit (`afb94975`) added this draft; the 16 June 2026 revision folds the two follow-up clarifications into this same file and adds a companion read-only audit (`docs/audits/collab-acceleration-architecture-stress-test-v1.md`). v1.6 is retained unchanged. No merge.
- **Lineage:** v1.6 (`7b1496de`), v1.5 (`9d670e76`), design (`2bf8b774`), environment (`22b8135e`), v1.4 (`e62e5f11`), v1.3 (`7b2ce689`), teams disposition (`a9d80d12`), surface-recon (`5c98a57c`), phase-0 (`1e1028bf`).
- **Live introspection (2026-06-04, read-only, `etmmuzwxtcjipwphdola`):** as v1.6; new collaboration tables confirmed absent (greenfield); the three CEE service-role RPCs confirmed present live (their workspace-resolution behaviour is a cross-repo verification item, §15.1). Load-bearing live-code claims re-verified on the staging head, 2026-06-16.
- **Method:** specification only; no code, schema, migration, prompt, package, lockfile, generated, test, config, or SQL files changed.

---

*End of draft v1.7*
