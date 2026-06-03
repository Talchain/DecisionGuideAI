# Multi-user collaboration capabilities: design recommendations v1

**Brief:** COLLAB-MULTIUSER-DESIGN-v2.1
**Date:** 2026-06-04
**Branch:** `claude/collab-multiuser-design`, cut from the v1.5 lineage (`9d670e76`, off staging `eab0365f`)
**Type:** Design investigation and recommendation only. No implementation. No source files were modified; the only file changed is this deliverable.
**Governing spec:** tenancy and RLS migration spec **v1.5** (`docs/specs/tenancy-rls-migration-spec-v1_5-draft.md`), used as the hard input gate (confirmed present).
**Method:** `rg`/grep, file reads, `git show`, read-only Supabase MCP against `etmmuzwxtcjipwphdola`. No row payloads beyond counts and schema metadata. No product or runtime LLM calls. Base commits in Appendix A.

This document is the design layer between the collaboration scope/audits/spec and the implementation briefs. It recommends how to build each capability safely in the live `AppPoC` V5 product, within the eleven locked decisions, preserving every v1.5 security invariant. Track B (TAE 2.0) appears only as P3 future-proofing notes.

---

## 1. Executive summary

The live app is `AppPoC` (`src/main.tsx:108,206`), a single-user V5 product with **no realtime collaboration today**: `supabase` is a singleton client (`src/lib/supabase.ts:49`) with Supabase Realtime available but unused, and there is no `.channel`/broadcast/presence anywhere in `src/poc`/`src/canvas` (only SSE via `openSSE` in `pocEngine`). Presence and collaboration are greenfield in code; the legacy `canvas_*` stack is prior art only.

Headline recommendations:
- **Realtime substrate:** Supabase Realtime presence plus broadcast, with refetch for canonical data. **Defer Yjs** (declared in `package.json:117-118`, imported nowhere; unwarranted at 2 to 5 users; locked decisions 4 and 5 keep CRDT out of model semantics and realtime out of canonical data). Realtime carries notifications and awareness only.
- **Edit lock:** a dedicated **`scenario_edit_locks` table** (not a column on `scenarios`), with acquire/heartbeat/release/force-release RPCs and a **guarded save RPC** that replaces the current last-write-wins direct `UPDATE` (`src/services/scenarioService.ts:152`), enforcing lock holder, membership, role, and optimistic concurrency (`event_seq` plus `graph_hash`).
- **Absolute graph-mutation gate:** no multi-user graph mutation surface ships until the edit lock, the guarded save RPC, optimistic concurrency, and consistent event logging are all in place.
- **Suggestion queue and event log:** a `patch_suggestions` table, and a single consistent logged, attributed write path that all three mutation sources (manual host edits, accepted suggestions, AI patches) traverse, wrapping `apply_patch_and_log`. The current event log is half-blind because manual saves bypass it.
- **Conversation scoping (corrected by live evidence):** `v5_conversation_turns` is **not display-ready** (it is a session/accounting store with no content column). The display-shaped per-user `conversation_turns` exists but is empty. Recommendation framed as options, not a final decision.
- **First shippable slice:** workspace foundation plus switcher, members, invite lifecycle skeleton, and scenario presence, with **no graph mutation**.

Three largest design risks: (1) graph saves are last-write-wins today, so any multi-user editing before the lock/guarded-RPC gate would lose data (P1); (2) the event log only sees AI patches, so collaboration history and attribution are incomplete until the three-path consistency lands (P1); (3) there is no durable, display-ready conversation store populated today, so per-user conversation history needs a deliberate home before it can be shared safely under multi-tenancy (P1).

---

## 2. Recommended build sequence

1. **Workspace foundation and identity (first slice).** Workspace tables and lifecycle RPCs (per v1.5), workspace context and switcher in `AppPoC`, members panel, invite lifecycle skeleton, and scenario presence. No graph mutation. Independently shippable and testable.
2. **Edit lock and guarded save (the gate).** `scenario_edit_locks`, lock RPCs, guarded save RPC replacing the direct `UPDATE`, optimistic concurrency, and consistent event logging for manual edits. Unlocks safe single-host multi-user editing.
3. **Suggestion queue.** `patch_suggestions` plus the unified logged/attributed path for manual edits, accepted suggestions, and AI patches; ghost overlays. Ships only after step 2.
4. **Element comments.** `element_comments`, inspector mount, broadcast/refetch.
5. **Snapshots and review mode.** `workspace_id` on snapshots, read-only canvas mode, reviewer mode, snapshot comments, publish linkage.
6. **Conversation path.** Durable per-user UI conversation store (revive `conversation_turns` or a projection), or a clearly-bounded in-memory MVP.

Parallelisable across agents once steps 1 and the realtime substrate exist: presence UX, element comments, and the workspace members/invite UI are largely independent. Sequential and on the critical path: edit lock then suggestion queue (the queue depends on the lock and the consistent event log).

---

## 3. Realtime substrate (Task 1)

**1. Current code state.** No Supabase Realtime in the live app: `supabase` singleton (`src/lib/supabase.ts:49`); zero `.channel`/`broadcast`/presence in `src/poc`, `src/canvas`, or `pocEngine` (grep). The only realtime is SSE for analysis/token streaming (`src/lib/pocEngine.ts:73` `openSSE`, `EventSource`). Provider tree: `StrictMode > QueryClientProvider > HashRouter > AuthProvider > Routes` (`src/poc/AppPoC.tsx:893-937`). `yjs` and `y-websocket` are declared (`package.json:117-118`) but imported nowhere. Legacy Supabase Realtime exists only in the unmounted `DecisionContext` (`src/contexts/DecisionContext.tsx`), not in the live tree.

**2. Options.** (a) Supabase Realtime presence plus broadcast, refetch for canonical data. (b) Supabase broadcast plus refetch without presence. (c) Yjs awareness. (d) Yjs documents for shared state.

**3. Recommended design.** Option (a). Supabase Realtime presence for awareness, broadcast for change notifications, and refetch of canonical rows on notification. **Defer Yjs**: it is unused, adds a sync server and CRDT complexity, and locked decisions 4 and 5 keep CRDT out of model semantics and realtime out of canonical data. At 2 to 5 users with single-host editing, presence plus broadcast/refetch is sufficient. Record the Yjs deferral as a scope-contract delta (§14).

**4. Data shape or contract.** Channel topology is **hybrid**: a per-scenario channel `scenario:{scenario_id}` (presence state, plus broadcast events `lock_changed`, `suggestion_changed`, `comment_changed`, `graph_event_appended`) and a per-workspace channel `workspace:{workspace_id}` (broadcast events `member_changed`, `invite_changed`). Broadcast payloads carry only identifiers and a change kind, never canonical content (for example `{ kind: 'suggestion_changed', suggestion_id, scenario_id }`); receivers refetch.

**5. State owner.** A new `RealtimeProvider` (and a small presence store) owns channel lifecycle. Canonical data stays owned by Postgres and the existing stores; Realtime owns only ephemeral awareness and notifications.

**6. Enforcement points.** None of the security model depends on Realtime. RLS and the guarded RPCs are the authority; Realtime cannot grant access. Channel authorisation uses Supabase Realtime RLS so a non-member cannot subscribe to a workspace or scenario channel (membership-gated, consistent with v1.5).

**7. Realtime mechanics and failure behaviour.** Mount `RealtimeProvider` inside `AuthProvider`, scoped to the current workspace and open scenario. On **drop**: awareness degrades (presence list greys out, a reconnecting indicator shows) but the app stays fully usable, because canonical reads/writes go through Postgres, not Realtime. On **reconnect**: re-join channels, re-track presence, and refetch the canonical sets (locks, suggestions, comments, members) to resynchronise. **Stale presence** is cleared by Realtime presence-leave events plus a heartbeat timeout (a peer absent beyond the timeout is dropped from the list). **Tab duplication**: a per-tab client id distinguishes two tabs of the same user; presence dedupes by `user_id` for display but tracks tabs for lock/heartbeat. **Canonical recovery**: comments, suggestions, and lock state always recover by refetch, since broadcast is a hint, not a source of truth. **Graph writes remain safe** regardless of Realtime state because write authority is server-side (guarded save RPC plus lock plus optimistic concurrency, §5), not Realtime.

**8. UX implications.** A presence avatar row and lightweight change toasts/badges. No hard dependency on a live connection for correctness.

**9. Effort:** M.

**10. Risks:** P1 (foundational; failure handling must be explicit so a dropped socket never corrupts or blocks canonical writes). P2 (channel authorisation must be membership-gated).

**11. Implementation-brief implications.** One brief for the realtime substrate and provider, landing before presence, comments, and suggestion notifications. Yjs deferral recorded as a scope-contract delta.

---

## 4. Presence and awareness UX (Task 2)

**1. Current code state.** Selection is per-client in the canvas store (`src/canvas/store.ts:302`, `selection.nodeIds/edgeIds/anchorPosition`), never persisted; viewport is React Flow internal (`ReactFlowGraph.tsx:346`), not persisted. `canvas_presence` (3 rows, prior art) has `canvas_id, user_id, cursor_position, last_seen, editing_block_id`.

**2. Options.** Full live cursors versus focused-element indicators; viewport sharing in or out; presence in canvas store versus a dedicated store.

**3. Recommended design.** Present-user awareness with **focused-element indicators, no live cursors and no viewport sharing for MVP**. Presence lives in a **dedicated presence store**, not the canvas store, to avoid graph re-render churn (the canvas store drives React Flow; mixing high-frequency presence into it would re-render the graph). `canvas_presence` is prior art only (its `editing_block_id` informs the focused-element idea; it is not reused).

**4. Data shape or contract.** Presence entry: `{ user_id, display_name, colour, focused_element_id: string | null, tab_id, last_seen }`, carried in the `scenario:{id}` Realtime presence state (ephemeral, never persisted).

**5. State owner.** The presence store (ephemeral, client-side), fed by Realtime presence.

**6. Enforcement points.** None (awareness only). Channel membership-gated (§3).

**7. Realtime mechanics.** Track presence on the scenario channel; update `focused_element_id` on selection change (throttled); clear on leave/timeout.

**8. UX implications.** Avatar row (top of canvas), coloured ring on the focused node/edge keyed to the user's colour. Avatar-on-element on hover. No cursor trails.

**9. Effort:** S to M. **10. Risks:** P2 (re-render churn if presence is wrongly placed in the canvas store). **11. Brief implications.** Pairs with the realtime substrate brief; presence store is additive.

---

## 5. Edit lock and lost-update prevention (Task 3)

**1. Current code state (P1).** Graph saves are **last-write-wins**: `scenarioService.saveGraph` is a direct `UPDATE scenarios SET graph` with no version guard (`src/services/scenarioService.ts:152-168`); `saveFraming` mirrors it. The only logged write path is `apply_patch_and_log` (`scenarioService.ts:372`), used for AI patch accept/reject. `scenarios` has `events` and `event_seq` columns (live) and a `scenarios_updated_at` trigger.

**2. Options.** Lock home: a dedicated `scenario_edit_locks` table, or a lock column on `scenarios`. Enforcement: client-side advisory versus server-side mandatory.

**3. Recommended design.** **One lock home: a dedicated `scenario_edit_locks` table.** Reasoning: lock state is ephemeral collaboration/session state, not canonical scenario content; heartbeat and stale-lock expiry are cleaner in a separate table; force-release and audit are easier to reason about; it avoids noisy writes to (and trigger churn on) the `scenarios` row; it supports two-tabs, reconnect, and crash recovery; and it aligns with the single-host edit-lock model. The lock-column alternative is simpler to query but couples ephemeral lock churn to the canonical row and muddies optimistic-concurrency on `graph`; rejected for those reasons. Enforcement is **server-side and mandatory**: replace the direct `saveGraph` `UPDATE` with a **guarded save RPC**.

**4. Data shape or contract.** `scenario_edit_locks`: `scenario_id uuid pk references scenarios(id) on delete cascade`, `workspace_id uuid` (derived server-side from the parent scenario, §6 invariant), `holder_user_id uuid`, `holder_tab_id text`, `acquired_at`, `last_heartbeat_at`, `expires_at`. RPCs: `acquire_edit_lock(p_scenario_id)`, `heartbeat_edit_lock(p_scenario_id)`, `release_edit_lock(p_scenario_id)`, `force_release_edit_lock(p_scenario_id)`. Guarded save RPC `save_graph_guarded(p_scenario_id, p_graph, p_expected_event_seq, p_expected_graph_hash, ...)`.

**5. State owner.** Postgres owns the lock (single source of truth); the client mirrors it for UX and refetches on `lock_changed`.

**6. Enforcement points.** The guarded save RPC checks, server-side: caller holds the lock; caller is a workspace member; caller has the editor-or-above capability; and **optimistic concurrency** holds (`p_expected_event_seq` equals current `event_seq` and `p_expected_graph_hash` equals the current graph hash). On mismatch it rejects with a typed stale error and the client refetches. `workspace_id` on the lock is derived from the parent scenario, never trusted from the client (§6).

**7. Realtime mechanics.** Lock acquire/release/force-release broadcast `lock_changed` on the scenario channel; peers refetch lock state. Heartbeat every N seconds; `expires_at` lets a stale lock be reclaimed after a holder crash.

**8. UX implications.** Non-holders see a read-only canvas with "X is editing" and a request-control affordance; idle-timeout warning before auto-release; explicit host handoff (release then acquire); two tabs of the same user reconcile by `tab_id` (the second tab is read-only or prompts to take over).

**9. Effort:** L. **10. Risks:** P1. **11. Brief implications.** This is the gate. **Absolute graph-mutation gate: no multi-user graph mutation surface ships until the edit lock, the guarded save RPC, optimistic concurrency, and consistent event logging are all in place.** CEE write paths and the UI save path must both move onto the guarded RPC.

---

## 6. Suggestion queue and event-log consistency (Task 4)

**1. Current code state (P1).** Two write paths exist: the logged `apply_patch_and_log` RPC (AI patches, writes `scenarios.graph` plus an event), and the unlogged direct `saveGraph` `UPDATE` (manual edits). So the event log is **half-blind**: it never sees manual edits. `GhostOptionNode` (`src/canvas/nodes/GhostOptionNode.tsx`, injected in `ReactFlowGraph.tsx`) is an existing provisional-overlay pattern.

**2. Options.** Per-source ad hoc logging versus one unified logged/attributed path; CRDT merge (excluded by locked decision 4).

**3. Recommended design.** A `patch_suggestions` table plus **one consistent logged, attributed write path** that all three mutation sources traverse: manual host edits (via the guarded save RPC, which appends an event), accepted suggestions (the accept RPC validates, applies, and appends an event), and AI patches (existing `apply_patch_and_log`). All three wrap or share the same append-event-with-author core, so the event log is complete and attributed. Validate-patch remains mandatory on every structural change. Ghost overlays reuse the `GhostOptionNode` pattern.

**4. Data shape or contract.** `patch_suggestions`: `id`, `scenario_id`, `workspace_id` (server-derived, §6), `proposed_by`, `base_graph_hash`, `base_event_seq`, `patch jsonb`, `status text check (status in ('pending','accepted','rejected','stale'))`, `resolved_by`, `accepted_by`, `created_at`, `resolved_at`. Staleness: a suggestion is stale when `base_event_seq` or `base_graph_hash` no longer matches the live scenario; revalidate through validate-patch before accept.

**5. State owner.** Postgres owns suggestions and the event log; the client renders ghosts and refetches on `suggestion_changed`.

**6. Enforcement points.** Propose: member with the proposer capability (per the matrix, §11). Accept/reject: the lock holder and the accept capability (owner/admin by default, §11). Accept re-runs validate-patch and the optimistic-concurrency check before applying; a stale base is rejected and the proposer is asked to rebase.

**7. Realtime mechanics.** Propose/accept/reject broadcast `suggestion_changed`; peers refetch the queue and re-render ghosts.

**8. UX implications.** Non-host proposes a patch rendered as a ghost overlay; host sees pending suggestions with accept/reject; accept applies through the guarded path; reject records `resolved_by`.

**9. Effort:** L. **10. Risks:** P1. **11. Brief implications.** **The suggestion queue must not ship until manual edits, accepted suggestions, and AI patches all use one consistent event/audit path.** Extends `apply_patch_and_log` (or wraps it in a shared core) and the guarded save RPC.

---

## 7. Element comments (Task 5)

**1. Current code state.** No `element_comments` table anywhere (confirmed live and in migrations). Prior art `canvas_comments` (36 rows): `canvas_id, block_id, parent_id, content, position, resolved, resolved_by`. Inspector panels carry a stable `nodeId`/`edgeId`; the shared `PrimaryControlCard` is the natural mount (used by all nine panels).

**2. Options.** Reuse `canvas_comments` (rejected, V1 prior art only) versus a fresh `element_comments`.

**3. Recommended design.** A fresh `element_comments` table anchored to node/edge ids, with optional `snapshot_id` for snapshot-scoped review comments, threading via `parent_id`, a label enum, resolve state, and read tracking. Mount in the inspector at `PrimaryControlCard`. Viewers may comment (locked decision 8); mutation of the graph remains gated.

**4. Data shape or contract.** `element_comments`: `id`, `scenario_id`, `workspace_id` (server-derived, §6), `snapshot_id uuid null`, `element_type text check ('node','edge')`, `element_id text`, `parent_id uuid null`, `author_id`, `label text check ('challenge','evidence','note')`, `body text`, `resolved boolean`, `resolved_by uuid null`, `created_at`, `updated_at`. Read state: a small `element_comment_reads(comment_id, user_id, read_at)` for unread badges.

**5. State owner.** Postgres; client refetches on `comment_changed`.

**6. Enforcement points.** RLS: workspace members read; author or owner/admin resolve (per matrix, §11); `workspace_id` server-derived and immutable. Anchoring survives id normalisation (`src/utils/nodeIdNormalisation.ts`).

**7. Realtime mechanics.** Create/resolve broadcast `comment_changed`; peers refetch the thread and unread counts.

**8. UX implications.** Comment affordance on the selected element in the inspector; thread with labels and resolve; unread badges. Snapshot-scoped comments shown in review mode.

**9. Effort:** M. **10. Risks:** P2. **11. Brief implications.** New table plus inspector integration; pairs with snapshots for review comments.

---

## 8. Snapshots and review mode (Task 6)

**1. Current code state.** `scenario_snapshots` live: 0 rows, 11 columns, RLS plus FORCE, 2 policies (`auth.uid()=user_id`), `create_snapshot` RPC present (SECURITY DEFINER), immutable (SELECT/INSERT only), cascade from `scenarios`.

**2. Options.** Extend the existing table versus a new one (extend; it is already immutable and shaped).

**3. Recommended design.** Extend `scenario_snapshots` with `workspace_id` (server-derived, §6) and a `label`/`tag`; keep immutable; `create_snapshot` requires editor-or-above (default, §11). A **read-only canvas mode** renders a snapshot's graph without mutation affordances. Authenticated reviewer mode lets workspace members view and comment on a snapshot. Snapshot comments are `element_comments` with `snapshot_id` set. Publish links a snapshot to a shared brief through `create_shared_brief`, gated by `approver_flag`.

**4. Data shape or contract.** `scenario_snapshots` + `workspace_id`, `label text null`. Review comments via `element_comments.snapshot_id`.

**5. State owner.** Postgres (immutable snapshots).

**6. Enforcement points.** RLS workspace-shared read; `create_snapshot` editor-or-above; publish requires `approver_flag` (locked decision 9).

**7. Realtime mechanics.** Snapshot creation broadcasts a workspace/scenario notification; review comments use `comment_changed`.

**8. UX implications.** Snapshot list, open in read-only canvas, comment in review mode, publish if approver.

**9. Effort:** M overall; **read-only snapshot canvas mode costed separately at M** (reuses the React Flow renderer with interaction and mutation disabled). **10. Risks:** P2. **11. Brief implications.** Snapshot `workspace_id` backfill follows the child-consistency rule; read-only canvas mode is a self-contained UI brief.

---

## 9. Conversation scoping (Task 7)

**1. Current code state (verified live, changes the picture).** `scenarios.thread` **does not exist** live; `append_thread_entries` and `update_thread_block_state` RPCs are **absent** (migration `20260308000000_thread_persistence.sql` unapplied). `conversation_turns` is **display-shaped** (`role, content, structured_blocks, client_turn_id`) but has **0 rows**. `v5_conversation_turns` (1543 rows) is a **session/accounting store with no content column** (`turn_id, turn_class, handler_id, request_hash, response_emitted, llm_calls_used, duration_ms, pending_actions, coaching_state`), so it is **not directly display-ready**. Assistant narrative lives scattered in `v5_handler_facts.payload`.

**2. Options.** (a) Read the UI conversation from `v5_conversation_turns` directly: not viable, no content. (b) Revive `conversation_turns` as the durable per-user UI store (it has `content` and `structured_blocks`). (c) Build a new UI-facing projection assembled from `v5_conversation_turns` plus `v5_handler_facts.payload`. (d) Keep UI conversation in-memory for MVP with clear limits.

**3. Recommended design (framed as a recommendation, not a final decision).** For durable per-user conversation history, **revive `conversation_turns` as the UI projection** (option b): it is already display-shaped, per-user RLS, and the right privacy class; populate it on each turn (UI write or a CEE-side write keyed to the authenticated user). If reviving it proves heavier than the MVP needs, **keep conversation in-memory for MVP with an explicit limit** (no cross-session history) and adopt option b or c in a follow-up. Do **not** read `v5_conversation_turns` directly for display. The `conversation_turns` fate is a **recommendation**: revive as a UI projection (preferred), supersede with a new projection, or leave dormant if in-memory MVP is accepted. The fate of `20260308000000_thread_persistence.sql` is likewise a **recommendation, not an implementation decision**: abandon the `scenarios.thread` portion (absent live and a shared-thread privacy hazard under multi-tenancy), and reconcile or forward-plan the per-user `conversation_turns` portion; the live schema, not the migration file, is the source of truth.

**4. Data shape or contract.** If revived, `conversation_turns` gains `workspace_id` (server-derived, §6) and keeps per-user RLS (`auth.uid()=user_id and is_workspace_member(workspace_id)`).

**5. State owner.** Per-user: Postgres `conversation_turns` (durable) plus the in-memory UI store (live session).

**6. Enforcement points.** Per-user RLS (SEC-10): a user reads only their own turns, even within a shared workspace. CEE writes resolve the user server-side and never inject cross-user turns.

**7. Realtime mechanics.** None required; conversation is per-user and not shared. No broadcast.

**8. UX implications.** With a durable store, conversation history survives reload and device switch; in-memory MVP loses history on reload (state the limit clearly).

**9. Effort:** M. **10. Risks:** P1 (no durable display-ready store today; per-user privacy must hold under multi-tenancy). **11. Brief implications.** A conversation-persistence brief decides revive-versus-projection-versus-in-memory.

**SEC-10 test points.** User A cannot read User B `conversation_turns`; User A cannot read User B `v5_conversation_turns`; User A cannot read User B `v5_handler_facts`; the CEE context builder never injects cross-user turns or facts; a revived `conversation_turns` write sets `workspace_id` from the parent scenario, not the client.

---

## 10. Workspace identity, members and invites (Task 8)

**1. Current code state.** `AppPoC` mounts only `QueryClientProvider` and `AuthProvider` (`src/poc/AppPoC.tsx:893-937`); no workspace context. Legacy teams UI (`MyTeams`, `TeamDetails`, `ManageTeamMembersModal`, `InviteCollaborators`) and `send-team-invite` (Brevo) live in the unmounted `App.tsx` tree, prior art only.

**2. Options.** Rebuild fresh versus port legacy teams UI (rebuild; legacy carries V1 role and decision-scoped assumptions, teams-disposition audit).

**3. Recommended design.** A new `WorkspaceProvider` inside `AuthProvider` holds the current-workspace context, defaulting to the user's personal workspace. A workspace switcher in the app shell; a members panel; an invite modal; a pending-invite list; role change and remove member, all through the v1.5 lifecycle RPCs (RPC-only, owner-atomic creation). Invite acceptance uses verified email plus a hashed single-use token (v1.5 §8.8). The email path is rebuilt fresh on the `send-team-invite` Brevo pattern (payload `team_id` becomes `workspace_id`, new template).

**4. Data shape or contract.** Per v1.5 §8: `workspaces`, `workspace_members` (owner/admin/editor/viewer), `workspace_invites` (hashed token, expiry, status). Current-workspace context is client state plus a server-side membership check on every workspace-scoped read.

**5. State owner.** Postgres (canonical membership and invites); `WorkspaceProvider` holds the current-workspace selection.

**6. Enforcement points.** All lifecycle via RPCs with the v1.5 constraints (admin cannot remove or grant owner, no self-escalation, personal-owner non-removable). Membership gates every workspace-scoped channel and query.

**7. Realtime mechanics.** `member_changed` and `invite_changed` on the `workspace:{id}` channel; the members panel and pending list refetch.

**8. UX implications.** Switcher in the shell; personal workspace default so single users are unaffected; invite-by-email with verified-email acceptance.

**9. Effort:** L. **10. Risks:** P1 (gates the whole MVP; lifecycle correctness). **11. Brief implications.** First slice. CEE RPC signatures gain `workspace_id` resolution (v1.5 §13, §15).

---

## 11. Role and capability matrix (Task 9)

**Intent: propose, do not resolve.** The table below is the recommended default with reasoning; product-sensitive cells are marked **[sign-off]** for Paul and are not final. It reconciles with v1.5 §11 and the §15.2 per-RPC permission table; it does **not** create a parallel permission model. Roles: owner > admin > editor > viewer.

| Capability | Owner | Admin | Editor | Viewer | Status |
|---|---|---|---|---|---|
| Read workspace scenarios | yes | yes | yes | yes | locked (v1.5) |
| Create scenario | yes | yes | yes | no | proposed |
| Edit graph (holding lock) | yes | yes | yes | no | proposed |
| Acquire edit lock | yes | yes | yes | no | proposed |
| Force-release lock | yes | yes | no | no | **[sign-off]** |
| Propose patch | yes | yes | yes | no | proposed |
| Accept/reject patch | yes | yes | no | no | **[sign-off]** (editor accept only if lock holder, if allowed) |
| Comment | yes | yes | yes | yes | **[sign-off]** (viewers comment, locked decision 8 unless v1.5 overrides) |
| Resolve own comment | yes | yes | yes | yes | proposed |
| Resolve any comment | yes | yes | no | no | **[sign-off]** |
| Create snapshot | yes | yes | yes | no | **[sign-off]** |
| Publish brief | yes if `approver_flag` | yes if `approver_flag` | yes if `approver_flag` | no | **[sign-off]** (does `approver_flag` lift editor to publish?) |
| Invite member | yes | yes | no | no | locked (v1.5) |
| Remove member | yes | yes, except owner | no | no | locked (v1.5) |
| Change member role | yes | yes, except owner, cannot grant owner | no | no | locked (v1.5) |
| Manage workspace settings | yes | yes | no | no | proposed |
| Delete workspace | forbidden in MVP | forbidden | forbidden | forbidden | locked (v1.5) |
| Transfer ownership | deferred | no | no | no | locked (v1.5) |

Cells needing Paul sign-off (proposed defaults shown, decision his): whether viewers can comment (default yes); whether editors can accept/reject patches (default no, propose-only, accept only if lock holder and explicitly allowed); who can force-release locks (default owner/admin); who can resolve any comment (default owner/admin, editors own-only); who can create snapshots (default editor-or-above); how `approver_flag` interacts across roles, in particular whether an editor with `approver_flag = true` may publish (default yes, the flag gates publishing independent of base role). Publish always requires `approver_flag` (locked decision 9).

---

## 12. Cross-capability state map and build order (Task 10)

| State | Location | Privacy class | Writer | Reader | Realtime? | Enforcement point | Notes |
|---|---|---|---|---|---|---|---|
| Workspace | `workspaces` | workspace | creation RPC | members | no (workspace channel notifies) | RLS `is_workspace_member`; owner-atomic create | v1.5 §8.2 |
| Membership | `workspace_members` | workspace | lifecycle RPCs | members | `member_changed` | RPC-only; admin cannot touch owner | v1.5 §8.3 |
| Invites | `workspace_invites` | owner/admin + invitee | lifecycle RPCs | owner/admin + invitee | `invite_changed` | hashed token, verified email | v1.5 §8.4, §8.8 |
| Presence | Realtime presence + presence store | ephemeral, per-client | client | scenario members | yes (presence) | channel membership-gated | not persisted; §4 |
| Edit lock | `scenario_edit_locks` | workspace | lock RPCs | scenario members | `lock_changed` | guarded save RPC checks holder | §5; `workspace_id` server-derived |
| Patch suggestions | `patch_suggestions` | workspace | propose/accept/reject RPCs | scenario members | `suggestion_changed` | validate-patch + OCC on accept | §6 |
| Comments | `element_comments` | workspace | comment RPCs | members | `comment_changed` | RLS; author/owner resolve | §7; `workspace_id` server-derived |
| Snapshots | `scenario_snapshots` | workspace (immutable) | `create_snapshot` | members | workspace notify | editor-or-above; immutable | §8; add `workspace_id` |
| Reviewer comments | `element_comments` (snapshot_id) | workspace | comment RPCs | members | `comment_changed` | as comments | §7/§8 |
| Conversation turns | `conversation_turns` (if revived) | per-user | UI/CEE write | the user only | no | RLS `auth.uid()=user_id` + membership | §9; not display via `v5_conversation_turns` |
| Handler facts | `v5_handler_facts` | per-user | CEE service-role | the user only | no | per-user RLS + CEE filter | v1.5; SEC-10 |
| Event log | `scenarios.events` / `event_seq` | workspace | guarded save / accept / `apply_patch_and_log` | members | `graph_event_appended` | one consistent attributed path | §6; currently half-blind |
| Public brief | `shared_briefs` via slug | public (allowlisted) | `create_shared_brief` | anon by slug | no | allowlist, no ids/PII | v1.5 §16 |
| Future TAE (P3) | n/a (estimate records, dissent logs, calibration) | TBD | TBD | TBD | n/a | n/a | §13 P3 notes only |

**Build order and dependencies.** First independently shippable slice: **workspace foundation, switcher, members, invite skeleton, scenario presence, no graph mutation** (depends on the v1.5 workspace tables and the realtime substrate). Then the edit-lock gate (§5), then the suggestion queue (depends on lock plus consistent event log), then comments, then snapshots and review mode, then the conversation path. **No multi-user graph edits are exposed until the Task 3 and Task 4 gates are satisfied.** Parallelisable across agents after the foundation: presence UX, element comments, members/invite UI. CEE RPC-signature impact: the 12 user-callable RPCs convert ownership to membership, the three service-role RPCs add server-side workspace resolution, and new RPCs appear for locks, suggestions, workspace lifecycle, and the conversation projection. UI complexity hotspots: presence overlay without graph re-render churn, ghost-overlay suggestions, read-only snapshot canvas mode, and workspace-context propagation through `AppPoC`.

---

## 13. Risks, escalations and unknowns (Task 11)

- **P0 (live exposure):** none found in this design pass. (Carried from the environment audit: `anon` holds DML grants on `v5_conversation_turns`/`v5_handler_facts`, contained today by RLS; it is a latent P2 to fix in the v1.5 H-1+ step, not a live exposure.)
- **P1 (MVP blockers):** last-write-wins graph saves until the lock plus guarded RPC plus OCC land (§5); the half-blind event log until the three-path consistency lands (§6); no durable display-ready conversation store populated today (§9); the v1.5 hardening (FORCE RLS, revoke anon DML, public-to-authenticated policy) must precede multi-tenant exposure.
- **P2 (build risks):** presence re-render churn if placed in the canvas store (§4); channel authorisation must be membership-gated (§3); read-only snapshot canvas mode is non-trivial (§8); invite token and verified-email correctness (§10).
- **P3 (backlog/future-proofing, Track B):** if TAE 2.0 later needs estimate records, dissent logs, deliberation stages, calibration snapshots, or contribution tracking, the event log's attribution (author on every event, §6) and the per-user privacy model are the right foundations; no core MVP data-model change is required now. Keep these as notes only.
- **Locked decisions:** none found unworkable. All eleven hold given the code evidence; the conversation-store correction (§9) is within locked decision 6 (per-user privacy), not a conflict.
- **Questions only Paul can answer:** the role-matrix sign-off cells (§11); the deployed `VITE_SUPABASE_URL` and prod/staging label (carried from the environment audit); rehearsal-environment provisioning; the conversation-store choice (revive versus projection versus in-memory MVP); the fate of `20260308000000`.

---

## 14. Governing document deltas (Task 12)

**Tenancy/RLS v1.5 (additive, preserve all invariants):**
- Add the new collaboration tables to the in-scope set with the same rules: `scenario_edit_locks`, `patch_suggestions`, `element_comments` (and `element_comment_reads`). Each carries `workspace_id` derived server-side from the parent `scenarios.workspace_id` (the §9/child-consistency invariant), immutable, with membership-aware RLS; mutations are RPC-controlled.
- Snapshots gain `workspace_id` under the same child-consistency rule.
- The guarded save RPC and the unified event path are new RPCs subject to the §15 service-role and per-RPC rules.

**Collaboration scope contract (provisional, pending v1.2 source document, which is not on disk):**
- **Yjs and cursors delta:** defer Yjs for the MVP; use Supabase Realtime presence plus broadcast/refetch; **no live cursors for MVP**; use focused-element and presence indicators instead; reason: 2 to 5 users, single-host editing, no CRDT model semantics, and avoiding canvas re-render churn.
- **Manual-edit event-log requirement:** manual host edits, accepted suggestions, and AI patches all enter one consistent logged, attributed path; the suggestion queue does not ship until this holds.
- **Graph-mutation gate:** no multi-user graph mutation surface ships until the edit lock, guarded save RPC, optimistic concurrency, and consistent event logging are all in place.
- **Conversation path:** `v5_conversation_turns` is not display-ready; the durable UI conversation store is `conversation_turns` (revive as a projection) or a new projection, or in-memory for MVP with stated limits; `conversation_turns` fate is a recommendation.
- **Role matrix:** the sign-off cells in §11.

**Boundary contract:**
- Realtime is awareness and notification only, never a canonical boundary; canonical state crosses through RPCs and validate-patch as today. No new cross-service boundary is introduced (no fifth service, locked decision 3).

**Future implementation briefs:** realtime substrate; workspace foundation and identity UI; edit lock plus guarded save; suggestion queue; element comments; snapshots and review mode; conversation persistence. The lock and suggestion-queue briefs are gated per §5/§6.

**Track B foundation notes (P3):** keep event-author attribution and per-user privacy as the foundations that future TAE capabilities would build on; no MVP data-model change now.

---

## Appendix A: base commits and method

- **DecisionGuideAI:** branch `claude/collab-multiuser-design` at `9d670e76` (the v1.5 lineage, off staging `eab0365f`). This deliverable adds exactly one file; no source files were modified. No push.
- **olumi-assistants-service:** `ac93197e` (read-only reference for the boundary contract and CEE paths).
- **Governing spec:** tenancy and RLS migration spec v1.5 (`9d670e76`); confirmed present (hard gate passed).
- **Companion audits:** phase-0 (`1e1028bf`), surface-recon (`5c98a57c`), teams disposition (`a9d80d12`), environment/namespace verification (`22b8135e`).
- **Method:** `rg`/grep, file reads, `git show`, read-only Supabase MCP against `etmmuzwxtcjipwphdola` (counts and schema metadata only). No row payloads. No product or runtime LLM calls. Prior audits treated as evidence; load-bearing claims (realtime absence, save path, conversation-store columns) re-verified live.

## Appendix B: evidence references

- Live app and providers: `src/main.tsx:108,206`; `src/poc/AppPoC.tsx:893-937`.
- Supabase client singleton: `src/lib/supabase.ts:49`. SSE: `src/lib/pocEngine.ts:73` (`openSSE`, `EventSource`). Yjs declared, unused: `package.json:117-118`. No `.channel`/presence in the live tree (grep).
- Graph save paths: `src/services/scenarioService.ts:152` (`saveGraph`, last-write-wins), `:372` (`apply_patch_and_log`). `scenarios.events`/`event_seq` columns; `scenarios_updated_at` trigger.
- Canvas state: `src/canvas/store.ts:302` (per-client selection); `ReactFlowGraph.tsx:346` (viewport). Ghost overlay: `src/canvas/nodes/GhostOptionNode.tsx`. Inspector mount: `src/canvas/ui/inspector-v2/shared/PrimaryControlCard.tsx`. Id normalisation: `src/utils/nodeIdNormalisation.ts`.
- Conversation stores (verified live 2026-06-04): `conversation_turns` has `role, content, structured_blocks, client_turn_id` (display-shaped, 0 rows); `v5_conversation_turns` has `turn_id, turn_class, handler_id, request_hash, response_emitted, llm_calls_used, duration_ms, pending_actions, coaching_state` (no content, 1543 rows); `v5_handler_facts.payload` holds narrative. `scenarios.thread` absent; `append_thread_entries`/`update_thread_block_state` absent.
- Snapshots: `scenario_snapshots` 0 rows, RLS plus FORCE, `create_snapshot` RPC. Prior art: `canvas_presence` (`cursor_position, last_seen, editing_block_id`), `canvas_comments` (`block_id, parent_id, position, resolved_by`).
- Legacy teams UI prior art (unmounted): `src/components/teams/*`, `src/components/InviteCollaborators.tsx`, `supabase/functions/send-team-invite/`.

---

*End of design recommendations v1*
