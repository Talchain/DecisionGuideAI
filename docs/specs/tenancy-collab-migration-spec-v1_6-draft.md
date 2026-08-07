# Tenancy and collaboration migration spec v1.6 (draft)

**Status:** Draft for Codex review. Specification only. No migration has been started.
**Date:** 2026-06-04
**Supersedes:** v1.5 (`docs/specs/tenancy-rls-migration-spec-v1_5-draft.md`). **v1.6 is the working baseline. Run the next Codex review on v1.6.** All v1.5 content is carried forward unless superseded below; all v1.5 security invariants are preserved.
**Consolidates:** v1.5; the multi-user collaboration design recommendations (`docs/designs/collab-multiuser-design-recommendations-v1.md`, commit `2bf8b774`, §14 deltas); the four audits (phase-0 `1e1028bf`, surface-recon `5c98a57c`, teams disposition `a9d80d12`, environment/namespace `22b8135e`); and Paul's signed-off decisions of 4 June 2026 (§2).
**Scope:** specification and decision record only. No code, schema, migration, prompt, package, lockfile, generated, test, or config changes. Illustrative SQL is documentation, not a migration file.

---

## 0. v1.5 to v1.6 changelog

- **Signed-off role and capability matrix** (Paul, 4 June 2026): folded into §11 and the per-RPC table §15.2; no `[sign-off]` cells remain; the "editor may accept patches if lock holder" nuance is removed entirely.
- **New collaboration tables join the in-scope set** under the existing child-consistency rule: `scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads` (§6, §9, §10, §12). `scenario_snapshots` gains `workspace_id` under the same rule.
- **New RPCs** join the per-RPC table: the guarded save RPC and the unified event path, plus lock, suggestion, and comment RPCs (§15).
- **Realtime channel authorisation** specified as a mechanism, not only tests (§17): private/authorised channels, server-side membership authorisation, no reliance on obscurity, plus negative and revocation tests.
- **Thread persistence decision recorded** (§18): abandon the `scenarios.thread` portion of `20260308000000_thread_persistence.sql`; reconcile or forward-plan only the per-user conversation-store portion; the `conversation_turns` choice remains open for the conversation implementation brief.
- **TAE checkpoint closed for Track A** (§19): no foundation-level TAE data structures required for the collaboration MVP; Track A proceeds with zero TAE dependency.
- **Readiness restated** (§22): v1.6 is intended to be ready for Codex review, not implementation.

Everything else from v1.5 (environment and namespace findings, live-schema corrections, the migration gates and expanded preflight, H-1+ hardening, SECURITY DEFINER helper hardening, the service-role `p_workspace_id` trust rule and service-role scenario creation semantics, owner-atomic workspace creation, member/invite lifecycle boundaries, invite privacy hardening, the public brief allowlist, rollback and rehearsal) is carried forward and tightened where noted.

---

## 1. Purpose and scope

Convert the V5 surface from single-user ownership (`auth.uid() = user_id`) to workspace-scoped multi-tenancy, with fresh `workspaces` / `workspace_members` / `workspace_invites` tables and membership-aware RLS, plus the collaboration tables needed for the MVP (locks, suggestions, comments), without reusing the legacy V1 teams or organisations models. In scope: the six V5 tables, the new collaboration tables (§6), their RLS, the SECURITY DEFINER RPCs, the CEE service-role paths, the new workspace tables, and Realtime channel authorisation. Out of scope: legacy teams and decisions (frozen, C-lite), the orphan `canvas_*`/`organisations` stack (untouched), V1 decommission, the collaboration UI build, and any schema or code change.

---

## 2. Locked decisions (carried plus signed off 4 June 2026)

Carried from v1.5: C-lite legacy disposition; fresh V5 workspace model; `v5_handler_facts` stays per-user; the migration gates are blocking.

### 2.1 Role and capability matrix, final for MVP (signed off)

- Viewers can comment: yes.
- Editors accept or reject patches: no. Editors propose; owner/admin accepts. The "editor may accept if lock holder, if allowed" nuance is removed entirely.
- Force-release locks: owner/admin only.
- Resolve own comments: anyone who can comment.
- Resolve any comment: owner/admin only.
- Create snapshots: editor and above.
- Publish brief: any non-viewer with `approver_flag`.
- Workspace deletion: forbidden in MVP.

Reflected in §11 and §15.2; no `[sign-off]` cells remain; no parallel permission model.

### 2.2 Thread persistence decision (recorded verbatim)

- Abandon the `scenarios.thread` portion of `20260308000000_thread_persistence.sql`.
- Reason: `scenarios.thread` is absent live and would be a shared-thread privacy hazard under multi-tenancy.
- Reconcile or forward-plan only the per-user conversation-store portion.
- The final `conversation_turns` choice remains open for the later conversation implementation brief: revive as a UI projection versus a new projection versus a bounded in-memory MVP.

### 2.3 Track B / TAE interim checkpoint (closed for Track A)

- No foundation-level TAE data structures are required for the collaboration MVP.
- Event-author attribution and per-user privacy are sufficient foundations for future TAE capabilities.
- Estimate records, dissent logs, deliberation stages, calibration snapshots, and contribution tracking remain post-MVP / P3 unless a later TAE design proves otherwise.
- Track A proceeds with zero TAE dependency.

---

## 3. Environment and namespace findings (carried from v1.5)

`etmmuzwxtcjipwphdola` ("Olumi") is the only viable migration target and holds canonical V5 data; UI and CEE share this one project. Formal production/staging label remains partially unresolved (shared dev/staging plus early-pilot: 16 `auth.users`, about 8 test, no signups since 2025-07-19; deployed CSP points at staging backends). No separate rehearsal environment exists; one must be provisioned before destructive steps. Paul must confirm the deployed `VITE_SUPABASE_URL`. Namespace gate passes: no live `workspaces`, `workspace_members`, `workspace_invites`, or `element_comments`. Orphan `organisations`/`organisation_members`/`canvas_*` remain untouched; conceptual overlaps are prior art only; do not create or alter any orphan table.

---

## 4. Live-schema corrections (carried from v1.5)

`scenarios.thread` does not exist live; `append_thread_entries` and `update_thread_block_state` are absent (`20260308000000` unapplied). `conversation_turns` exists, full-shape (10 columns incl `content` and `structured_blocks`), RLS plus FORCE, but 0 rows. `v5_conversation_turns` is a session/accounting store with no content column (so not directly display-ready). Durable narrative is scattered in `v5_handler_facts.payload`. 13 of 15 tracked RPCs are live; the live `create_shared_brief` is the CEE variant (`v_shared_id`). Migration specs are written against the live schema, not repo migrations alone.

---

## 5. Migration gates (blocking; carried from v1.5)

5.1 Environment identity gate (hard): confirm the role of the target, the canonical-data project, and a separate production environment if any; provision a rehearsal environment; confirm the deployed `VITE_SUPABASE_URL`. 5.2 Namespace and orphan-table gate: passes; record an orphan disposition; do not touch orphans. 5.3 Live verification checklist: `pg_tables`, `pg_policies`, `pg_proc`, triggers, grants, row counts, FORCE RLS, namespace collisions, duplicate definitions, live `create_shared_brief` body, `conversation_turns` shape, v5 FORCE RLS; treat migration files as intent, not state; reconcile drift; confirm `cee_prompt_observations` RLS (disabled, 0 rows, security backlog). 5.4 Expanded preflight: function owners, table owners, default privileges, exposed schemas, PostgREST grants, duplicate helper/RPC names, live-versus-repo bodies, existing grants to `anon`/`authenticated`/`service_role`.

---

## 6. Tables in scope and out of scope

In scope (workspace_id plus membership-aware RLS):
- Existing six V5 tables: `scenarios`, `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`.
- New collaboration tables (v1.6): `scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`.
- `scenario_snapshots` gains `workspace_id` under the child-consistency rule.

Out of scope, frozen: `teams`, `team_members`, `invitations`, `decisions`, `decisions.team_ids`, `decision_collaborators`. Orphans (`canvas_*`, `organisations`, `organisation_members`): do not touch, do not collide.

---

## 7. Current live baseline (verified 2026-06-04)

| Table | Rows | RLS | FORCE | Policies | Grants |
|---|---|---|---|---|---|
| `scenarios` | 391 | yes | yes | 4 (`auth.uid()=user_id`) | authenticated, service_role |
| `shared_briefs` | 0 | yes | yes | 1 | authenticated, service_role |
| `scenario_snapshots` | 0 | yes | yes | 2 | authenticated, service_role |
| `conversation_turns` | 0 | yes | yes | 2 | authenticated, service_role |
| `v5_conversation_turns` | 1543 | yes | **no** | 1, role public | **anon**, authenticated, service_role |
| `v5_handler_facts` | 496 | yes | **no** | 1, role public | **anon**, authenticated, service_role |

New collaboration tables do not exist yet (greenfield; no namespace collision).

---

## 8. Target workspace model (carried from v1.5)

Centralised role hierarchy `owner` > `admin` > `editor` > `viewer`; helpers `is_workspace_member(p_workspace_id)` and `is_workspace_role(p_workspace_id, p_min_role)`, both SECURITY DEFINER to bypass RLS and avoid recursion. `workspaces` (owner-atomic creation via RPC; FORCE RLS; SELECT members; UPDATE admin; DELETE forbidden in MVP). `workspace_members` (roles, unique (workspace_id, user_id); lifecycle via RPCs; exactly one owner; personal workspace single-member). `workspace_invites` (hashed single-use token, expiry, status; admin-or-invitee visibility). Non-member inference prevention across all three. Owner-atomic creation, member/invite lifecycle boundaries, and invite privacy hardening are carried verbatim from v1.5 §8.6 to §8.8.

---

## 9. Parent/child workspace consistency invariant (carried, extended)

Any child row with both `scenario_id` and `workspace_id` derives `workspace_id` server-side from the parent `scenarios.workspace_id`; client and caller values are never trusted. Enforced via the preferred composite foreign key (`(scenario_id, workspace_id)` references `scenarios(id, workspace_id)` with a unique constraint on `scenarios(id, workspace_id)`), plus RPC-only writes that set `workspace_id` from the parent, or a validating trigger.

**Applies to (v1.6, extended set):** `shared_briefs`, `scenario_snapshots`, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`, and the new `scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`, plus any future child table with both columns.

---

## 10. workspace_id immutability (carried, extended)

`workspace_id` is immutable once set on all migrated and workspace-linked tables, except through a dedicated transfer RPC. Applies to the six V5 tables and the new collaboration tables (`scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`) and snapshots. Enforce by excluding `workspace_id` from the updatable set or a trigger. Preserve `user_id`/author columns as authorship attribution.

---

## 11. Role and capability matrix (signed off, Paul 4 June 2026)

No `[sign-off]` cells remain. Reconciles with the per-RPC table (§15.2); no parallel permission model. Roles: owner > admin > editor > viewer.

| Capability | Owner | Admin | Editor | Viewer | Status |
|---|---|---|---|---|---|
| Read workspace scenarios | yes | yes | yes | yes | signed off |
| Create scenario | yes | yes | yes | no | signed off |
| Edit graph (holding lock) | yes | yes | yes | no | signed off |
| Acquire edit lock | yes | yes | yes | no | signed off |
| Force-release lock | yes | yes | no | no | signed off (owner/admin only) |
| Propose patch | yes | yes | yes | no | signed off |
| Accept or reject patch | yes | yes | no | no | signed off (editors propose only; nuance removed) |
| Comment | yes | yes | yes | yes | signed off (viewers may comment) |
| Resolve own comment | yes | yes | yes | yes | signed off (anyone who can comment) |
| Resolve any comment | yes | yes | no | no | signed off (owner/admin only) |
| Create snapshot | yes | yes | yes | no | signed off (editor and above) |
| Publish brief | yes if `approver_flag` | yes if `approver_flag` | yes if `approver_flag` | no | signed off (any non-viewer with `approver_flag`) |
| Invite member | yes | yes | no | no | signed off |
| Remove member | yes | yes, except owner | no | no | signed off |
| Change member role | yes | yes, except owner and cannot grant owner | no | no | signed off |
| Manage workspace settings | yes | yes | no | no | signed off |
| Delete workspace | forbidden | forbidden | forbidden | forbidden | signed off (forbidden in MVP) |
| Transfer ownership | deferred | no | no | no | signed off (deferred) |

Publishing always requires `approver_flag` (locked decision 9); the flag lifts any non-viewer (owner, admin, or editor) to publish.

---

## 12. In-scope table RLS migration (carried, extended)

Expand, backfill, switch per v1.5. Privacy classes: scenarios/shared_briefs/scenario_snapshots are workspace-shared; conversation_turns/v5_conversation_turns/v5_handler_facts are per-user within workspace (SEC-10). New collaboration tables: `scenario_edit_locks` (workspace-shared read among scenario members; mutations via lock RPCs), `patch_suggestions` (workspace-shared read; mutations via suggestion RPCs), `element_comments` (workspace-shared read; create by any commenter, resolve per §11), `element_comment_reads` (per-user). All new tables carry server-derived immutable `workspace_id` (§9, §10), FORCE RLS, no anon grants, and membership-aware policies. Snapshot creation requires editor-or-above (§11). H-1+ hardening for the two CEE tables is carried from v1.5 §13 (add FORCE RLS; SELECT role `public` to `authenticated`; revoke `anon` DML; writes service-role-only).

---

## 13. H-1+ hardening cluster (carried from v1.5)

For `v5_conversation_turns` and `v5_handler_facts`: add FORCE RLS; change the SELECT policy role from `public` to `authenticated`; revoke `anon` table grants; keep writes service-role-only; add anon read/write denial and cross-user denial tests (§21).

---

## 14. SECURITY DEFINER helper hardening (carried from v1.5)

Every helper and SECURITY DEFINER RPC: `SET search_path = pg_catalog, public`; schema-qualified tables; fixed non-superuser owner; `REVOKE EXECUTE FROM PUBLIC` then grant only to required roles; recursion avoidance; centralised role hierarchy; boolean-only helpers with no existence differentiation; non-member denial tests.

---

## 15. RPC migration, per-RPC permissions, and service-role semantics

### 15.1 Service-role trust rules (carried from v1.5, blocker-class)

CEE never trusts caller-supplied `p_workspace_id`: it resolves `scenario_id` to `workspace_id` server-side, verifies the authenticated user's membership, and rejects on mismatch. `ensure_scenario_exists` resolves an authorised workspace server-side for both the exists and not-exists paths. Applies to `append_turn_atomic`, `ensure_scenario_exists`, `store_draft_graph`, and the `build-turn-context.ts` fact reads (filter `user_id = current_user`).

### 15.2 Per-RPC permission table (signed-off roles, plus new collaboration RPCs)

| RPC | workspace_id derivation | Required role/capability | Child consistency | Notes |
|---|---|---|---|---|
| `append_scenario_event` | from `scenarios` | editor-or-above | n/a (writes `scenarios.events`) | idempotent on `(scenario_id, event_id)` |
| `apply_patch_and_log` | from `scenarios` | editor-or-above, lock holder | n/a | AI/accepted-patch path; one logged event |
| `save_graph_guarded` (new) | from `scenarios` | editor-or-above, **lock holder**, optimistic-concurrency (`event_seq` + `graph_hash`) | n/a | replaces last-write-wins `saveGraph`; appends an attributed event |
| `store_analysis_and_log` | from `scenarios` | editor-or-above (or system) | n/a | idempotent on event_id |
| `store_analysis_failure` | from `scenarios` | editor-or-above (or system) | n/a | |
| `store_brief_and_log` | from `scenarios` | editor-or-above | n/a | |
| `set_stage_and_log` | from `scenarios` | editor-or-above | n/a | |
| `create_shared_brief` | from `scenarios` | **non-viewer with `approver_flag`** | yes (`shared_briefs.workspace_id`) | publish gate; public read by slug (§16) |
| `create_snapshot` | from `scenarios` | **editor-or-above** | yes (`scenario_snapshots.workspace_id`) | immutable |
| `insert_conversation_turn` | from `scenarios` | member; writes own row | yes (`conversation_turns.workspace_id`) | per-user; idempotent on `client_turn_id` |
| `get_shared_brief_by_slug` | none (slug) | public (anon + authenticated) | n/a | allowlisted public fields only (§16) |
| `acquire_edit_lock` / `heartbeat_edit_lock` / `release_edit_lock` (new) | from `scenarios` | editor-or-above (member) | yes (`scenario_edit_locks.workspace_id`) | single-host lock; heartbeat and expiry |
| `force_release_edit_lock` (new) | from `scenarios` | **owner/admin only** | yes | per §11 |
| `propose_suggestion` (new) | from `scenarios` | editor-or-above | yes (`patch_suggestions.workspace_id`) | base `graph_hash` + `event_seq` recorded |
| `accept_suggestion` / `reject_suggestion` (new) | from `scenarios` | **owner/admin only** | yes | accept re-runs validate-patch + OCC, appends attributed event |
| `create_comment` (new) | from `scenarios` | any commenter (incl viewer) | yes (`element_comments.workspace_id`) | viewers may comment (§11) |
| `resolve_comment` (new) | from `scenarios` | author (own) or owner/admin (any) | yes | per §11 |
| Workspace lifecycle RPCs (carried) | n/a / from workspace | owner-atomic create; admin invite/remove/role per §11 | n/a | RPC-only lifecycle (v1.5 §8.6 to §8.8) |

Absent live RPCs (documented): `append_thread_entries`, `update_thread_block_state` (migration `20260308000000` unapplied; see §18).

### 15.3 Service-role scenario creation semantics (carried from v1.5, blocker-class)

`ensure_scenario_exists`: if the scenario exists, resolve and verify membership and reject a mismatched `p_workspace_id`; if it does not, resolve an authorised workspace server-side (verify membership if `p_workspace_id` supplied, else the user's personal/default workspace via server-side lookup), create with the server-resolved workspace, and reject unauthorised or mismatched IDs.

### 15.4 Unified event path (v1.6)

Manual host edits (`save_graph_guarded`), accepted suggestions (`accept_suggestion`), and AI patches (`apply_patch_and_log`) all append to `scenarios.events` through one shared, attributed core (author recorded on every event). Validate-patch remains mandatory on every structural change. The suggestion queue does not ship until all three sources use this consistent path.

---

## 16. Public brief allowlist (carried from v1.5)

Public `get_shared_brief_by_slug` may return only `brief`, `graph_hash` (if needed and confirmed non-sensitive), `created_at`, `expires_at`. `seed_used` and `response_hash` are dropped by default (pending Paul/ChatGPT sign-off if reproducibility needs them). Never `workspace_id`, `scenario_id`, `user_id`, member or invite data, private conversation/thread data, `conversation_turns`, `v5_conversation_turns`, `v5_handler_facts`, debug, or unsafe provenance fields. Public brief leak tests required (§21).

---

## 17. Realtime channel authorisation (v1.6, mechanism specified)

Realtime is for awareness and notification only, never canonical data (carried locked decision). The mechanism is required, not only the tests:

- **Private or authorised channels** for `scenario:{id}` and `workspace:{id}`. Public channels are not acceptable.
- **Server-side authorisation against workspace membership.** Channel join is authorised against `workspace_members` (consistent with the table RLS model): for a `workspace:{id}` channel the joiner must be a member of that workspace; for a `scenario:{id}` channel the joiner must be a member of the scenario's workspace (resolved server-side from `scenarios.workspace_id`). Use Supabase Realtime authorisation (RLS-backed channel policies) so the database, not the client, decides who may join, track presence, and receive broadcasts.
- **No reliance on obscurity** of the `scenario:{id}` or `workspace:{id}` identifiers, on client-side UI gating, or on guessed-private channel names.
- **Broadcast payloads carry identifiers and change kinds only**, never canonical content; receivers refetch through the RLS-protected tables and RPCs.
- **Failure and recovery:** on drop, awareness degrades but the app stays usable; on reconnect, re-join (re-authorised) and refetch canonical state; stale presence cleared by heartbeat and presence-leave; graph writes remain safe because write authority is server-side (the guarded save RPC plus lock plus optimistic concurrency), not Realtime.

Negative and revocation tests are in §21 (SEC-25 to SEC-28).

---

## 18. Conversation scoping and thread decision (v1.6)

`v5_conversation_turns` is not directly display-ready (session/accounting store, no content column). The display-shaped per-user `conversation_turns` exists but is empty. **Thread decision (recorded, §2.2):** abandon the `scenarios.thread` portion of `20260308000000_thread_persistence.sql` (absent live, shared-thread privacy hazard under multi-tenancy); reconcile or forward-plan only the per-user conversation-store portion. **The final `conversation_turns` choice remains open** and gates the conversation implementation brief, not this spec: revive as a UI projection versus a new projection versus a bounded in-memory MVP. Whichever is chosen keeps per-user RLS (`auth.uid()=user_id and is_workspace_member(workspace_id)`) and a server-derived `workspace_id`; the CEE never injects cross-user turns. SEC-10 test points carried (§21).

---

## 19. Track B / TAE checkpoint closure (v1.6)

Recorded decision (§2.3): no foundation-level TAE data structures are required for the collaboration MVP. Event-author attribution (the unified event path, §15.4) and the per-user privacy model are sufficient foundations for future TAE capabilities. Estimate records, dissent logs, deliberation stages, calibration snapshots, and contribution tracking remain post-MVP / P3 unless a later TAE design proves otherwise. **Track A proceeds with zero TAE dependency.**

---

## 20. Rollback and rehearsal (carried from v1.5)

Rehearse on a clone or fresh project before touching canonical data (none exists today; provision one). Sequence: gates pass; expand (additive, including the composite-FK consistency mechanism for all child tables); backfill personal workspaces and child `workspace_id` from parents; verify no NULLs; switch policies, add FORCE RLS to the two CEE tables, enforce immutability, rewrite RPCs, land CEE enforcement together. Reversible expand/backfill; switch behind a clear release boundary with CEE checks reverted in lockstep. No-rollback point once workspace-shared writes or member changes occur. Reconcile counts. Dual-compatibility during expand/backfill. Abort on rehearsal failure, NULL backfill, count mismatch, or any cross-user denial test failure.

---

## 21. SEC/TEN test matrix (carried plus v1.6 additions)

Carried from v1.5: SEC-01 to SEC-24 and TEN-01 to TEN-11 (non-member read denial; membership-inference prevention; viewer cannot mutate; editor propose; editor cannot publish without `approver_flag`; owner/admin invite/remove; admin cannot remove or grant owner; removed member loses access; cross-user `conversation_turns`/`v5_conversation_turns`/`v5_handler_facts` denial; CEE cross-user fact prevention; CEE `p_workspace_id` mismatch rejected; anon denial on the two CEE tables; public brief allowlist; editor accept/reject denied; self-escalation denied; invite email visibility; verified-email mismatch; token reuse; expired token; ownerless workspace; personal workspace invariant; owner-atomic creation; child `workspace_id` mismatch; `workspace_id` immutability; direct member/invite lifecycle bypass).

v1.6 additions:

| ID | Test | Expect |
|---|---|---|
| SEC-25 | Non-member subscribes to `scenario:{id}` or `workspace:{id}` channel | denied (server-side authorisation) |
| SEC-26 | Non-member tracks presence on a scenario/workspace channel | denied |
| SEC-27 | Non-member receives broadcasts from a scenario/workspace channel | denied |
| SEC-28 | Removed member retains channel access after removal and reconnect | denied (access revoked on reconnect) |
| SEC-29 | Editor accepts or rejects a patch | denied (owner/admin only; nuance removed) |
| SEC-30 | Editor force-releases a lock | denied (owner/admin only) |
| SEC-31 | Viewer creates a snapshot | denied (editor-or-above) |
| SEC-32 | Viewer comments | allowed (signed off) |
| SEC-33 | Editor resolves another user's comment | denied (owner/admin only); resolves own: allowed |
| TEN-12 | Child `workspace_id` mismatch on `scenario_edit_locks`/`patch_suggestions`/`element_comments` | rejected (composite FK / trigger) |
| TEN-13 | `workspace_id` updated on a new collaboration table (no transfer RPC) | rejected |
| TEN-14 | Manual edit, accepted suggestion, and AI patch all append an attributed event | all three logged consistently |

---

## 22. Migration-readiness verdict

- **Ready for Codex review: yes**, on **v1.6** (not v1.5).
- **Ready for implementation: no.** Implementation remains blocked until: the Codex review of v1.6 is clean; the deployed `VITE_SUPABASE_URL` is confirmed; and a rehearsal environment is provisioned or approved.
- Ready for SQL or code: no.

---

## 23. Manual blockers (carried, still gating implementation)

1. Paul confirms the deployed `VITE_SUPABASE_URL`.
2. Paul provisions or approves a rehearsal environment.
3. The `conversation_turns` choice is made in the conversation implementation brief (revive / new projection / in-memory MVP); the `scenarios.thread` portion is abandoned per §2.2.
4. The role and capability matrix is signed off (done, §2.1 / §11).
5. Any remaining v1.2 source-reference markers are resolved if the source documents are supplied.

---

## Appendix A: source reconciliation

v1.2 source documents not on disk; requirements reconstructed from the audits, the design recommendations, and the Codex reviews; markers `[v1.2 ref pending]` to be resolved when supplied. SEC/TEN identifiers are this document's own; reconcile to the canonical scope-contract identifiers (SEC-10 etc.) when v1.2 arrives. The first and second Codex reviews of v1.3/v1.4 and the signed-off matrix are folded in; if the original review texts are later supplied, reconcile any finding not already covered.

## Appendix B: base commits and lineage

- **Branch:** `claude/tenancy-collab-spec-v1_6`, cut from `claude/collab-multiuser-design` (`2bf8b774`). Adds exactly two files (this spec and the branch inventory). No push.
- **Inputs:** v1.5 (`9d670e76`); design recommendations (`2bf8b774`); environment audit (`22b8135e`); v1.4 (`e62e5f11`); v1.3 (`7b2ce689`); teams disposition (`a9d80d12`); surface-recon (`5c98a57c`); phase-0 (`1e1028bf`).
- **Live introspection (2026-06-04, read-only, `etmmuzwxtcjipwphdola`):** six V5 tables RLS/FORCE/policies/grants/counts; new collaboration tables confirmed absent (greenfield); `conversation_turns` display-shaped and empty; `v5_conversation_turns` not display-ready.
- **Method:** specification only; no code, schema, migration, prompt, package, lockfile, generated, test, or config files changed.

---

*End of draft v1.6*
