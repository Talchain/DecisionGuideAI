# Collaboration surface reconnaissance audit

**Brief:** COLLAB-SURFACE-RECON-v1
**Date:** 2026-06-02
**Branch:** `claude/collab-surface-recon` (DecisionGuideAI), cut from `eab0365f`
**Status:** Complete (Tasks 1 to 7 and 9). Task 8 (spec and contract deltas) held pending user-supplied v1.2 documents (see §9).
**Type:** Read-only investigation. No code, schema, or prompt changes.
**Method:** Source and migration inspection (`rg`, file reads, `git show`) plus live Supabase introspection via MCP (read-only `SELECT`/`COUNT` and `information_schema`) across both active projects. Anchors: phase-0 audit (`git show claude/collab-phase0-audit:docs/audits/collab-phase0-audit-v1.md`, commit `1e1028bf`) and boundary contract v1.1 (`olumi-assistants-service/Docs/v5/olumi-boundary-contract-v1_1.md`). The named v1.2 scope contract, tenancy/RLS migration spec, design handover, and AI-experience ownership contract are not on disk anywhere; their model is reconstructed from the brief and phase-0.

---

## 1. Executive summary

### 1.1 The finding that reframes everything: two app shells, only one mounted

`src/main.tsx` mounts `AppPoC` (the V5 product), not `App.tsx` (`src/main.tsx:108,206`). `App.tsx` is imported by nothing in `src/` outside tests; it is an **unmounted legacy shell**. The live app `AppPoC` routes only to scenario, canvas, brief, and sandbox surfaces (`src/poc/AppPoC.tsx:911-931`): `/`, `/scenarios`, `/scenario/:id`, `/canvas`, `/brief/:slug`, `/profile`, `/templates`, `/plot*`, `/sandbox*`. It mounts only `QueryClientProvider` and `AuthProvider` (`src/poc/AppPoC.tsx:894-897`).

Consequences that propagate through this whole audit:

- The entire V1 teams and decisions collaboration UI (`/teams`, `/teams/:teamId`, `/decision/*`, the teams Navbar link, `InviteCollaborators`, `ManageTeamMembersModal`, `DecisionContext`) lives in `App.tsx` and is **unreachable in the shipped product**.
- The `decision_collaborators` Supabase Realtime subscription (`src/contexts/DecisionContext.tsx`) and the `options` subscription (`src/hooks/useDecisionOptions.ts`) are **not active** in the live app, because `AppPoC` never mounts their providers. The only realtime in the live app is SSE for analysis and token streaming.
- Teams is not merely dormant; its UI is dead code.

### 1.2 Three-surface readiness verdict

| Surface | Readiness | Headline gap |
|---|---|---|
| **Inspector** | Closest to ready | Per-user and selection-driven, clean write paths, stable element ids for comment mounts. Only a P2 F.6 tagging gap and the absence of comment-thread mount points. |
| **Canvas** | Store ready, persistence model not | The rendering store is well-positioned for presence and ghost overlays additively (per-client selection and viewport, passthrough node and edge data, an existing ghost-node pattern). The persistence model is the gap: last-write-wins, no concurrency control, and an event log that is half-blind (P1). |
| **AI conversation** | Furthest from ready | The displayed thread is hydrated from `scenarios.thread`, a per-scenario shared column, not from a per-user store (P1). The correctly-shaped per-user table exists but is unwired. Assistant copy is single-addressee, generated server-side. |

**Furthest from collaboration-ready: the AI conversation surface**, because it carries a storage-model conflict with the per-user-private-thread requirement, not merely a missing feature.

### 1.3 Top collaboration risks

- **P1 (conversation privacy model).** The conversation thread the UI renders comes from `scenarios.thread` (per-scenario JSONB, no per-user partition), via `useScenario.ts:470-475` then `useConversation.ts:1448-1456`. There is no live leak today because scenarios are single-user under RLS, but the model is incompatible with per-user-private threads the moment scenarios become multi-tenant. The fix path exists: a per-user `conversation_turns` table is already defined with correct RLS, but it is write-path-only and has zero rows; nothing reads it (`rg` finds no `select` of `conversation_turns` in `src/`).
- **P1 (canvas event log is half-blind, and last-write-wins).** Manual canvas and inspector edits persist through `scenarioService.saveGraph`, a direct `UPDATE scenarios SET graph` with no event and no version guard (`src/services/scenarioService.ts:152-168`). Only accepted or rejected AI patches reach the event log, through the `apply_patch_and_log` RPC (`src/services/scenarioService.ts:372-398`). The brief's model ("shared state via event log, AI references patches by author") cannot see manual edits, and there is no optimistic-concurrency or authorship on the direct path. A single-host edit lock is mandatory before any concurrent editing.
- **P1 (tenancy is single-user end to end).** No V5 table carries `workspace_id`; scenarios and the per-user tables are scoped by `auth.uid() = user_id` only (phase-0 audit §2.4, §3.1). All three surfaces assume one owner per scenario.

No P0 (live production data exposure) was found. One latent security item is surfaced below (P2).

### 1.4 Teams disposition recommendation: C-lite

Freeze and hide the legacy teams and decisions surface (already de facto frozen: unmounted, unreachable, all data dev/test, dormant 7 to 11 months), port the useful UI patterns and data-model precedents to the new workspace surfaces, and leave the dormant tables frozen for a safety window before dropping. C-full (migrate teams and decisions data into workspaces) is not warranted: every row is developer or test data in dead code. Detail in §10.

### 1.5 Headline spec and contract deltas (provisional, pending v1.2 docs)

- Conversation persistence must move off the shared `scenarios.thread` onto a per-user store before multi-tenant scenarios ship.
- The migration spec must add a decision on canvas write attribution: either route manual edits through the logged path so the event log is the single source of truth, or pair the direct path with a single-host lock plus per-edit authorship.
- `element_comments` is genuinely new (it does not exist anywhere) so no shape conflict, but the migration must avoid colliding with orphaned legacy tables (`canvas_comments`, `canvas_presence`, `organisations`) that exist in the live database with no repo provenance.
- Presence is greenfield in code; the legacy `canvas_presence` schema (`cursor_position`, `last_seen`, `editing_block_id`) is a usable design precedent.

### 1.6 Presence and realtime status

Greenfield in the live app. The live app uses SSE only (analysis and token streaming, `src/lib/sseClient.ts`, `src/lib/plotStream.ts`). Supabase Realtime is used only by the unmounted legacy app. A full presence and comments schema and a Realtime usage pattern exist but in dead or unmounted code and in orphaned tables, so they are harvestable precedents, not live infrastructure.

### 1.7 Stop conditions

None triggered. No P0 found. Live Supabase state diverges from the repo migration files in two material ways (legacy `canvas_*` and `organisations` tables exist in the live DB with no migration provenance in this repo; the migration-referenced `team_invitations` table is realised live as a unified `invitations` table). Both are captured below and did not require halting. No uncommitted changes appeared in any repo other than DecisionGuideAI. The audit adds exactly one file.

---

## 2. AI conversation surface (Task 1)

### 2.1 Current map

The conversation surface lives under `src/canvas/conversation/`. Composition: `ConversationPanel` orchestrates `ChatThread` (message list) and `ChatComposer` (input), with `ActionStrip` and `GuidanceStrip` for pending actions and coaching. Block rendering dispatches through `InlineBlocks.tsx`. In-memory message state and the turn lifecycle live in `useConversation.ts` (large file). The send path uses the V5 turn service (`callV5Turn`).

Persistence has three stores, and which one the user sees is the crux:

| Store | Scope | Live rows (Olumi) | Role |
|---|---|---|---|
| `scenarios.thread` (JSONB column) | **Per scenario (shared)** | thread on 391 scenarios | The hydration source the UI actually renders |
| `conversation_turns` (UI table) | Per user (RLS `auth.uid() = user_id`) | **0** | Defined with correct shape and RLS, but write-path-only and unread |
| `v5_conversation_turns` (CEE table) | Per user | 1543 | CEE orchestrator session store (server-side) |

Evidence for the rendered source:

- `src/hooks/useScenario.ts:470-475` reads `row.thread` (the `scenarios.thread` JSONB from `select('*')`) into `_hydratedThread`. The inline comment states this is "for consumption by useConversation (hydration)".
- `src/canvas/conversation/useConversation.ts:1448-1456` hydrates the displayed messages from `store._hydratedThread` via `hydrateMessagesFromThread`, gated by `isThreadHydrateEnabled()`.
- `rg "from('conversation_turns')"` and `rg "select.*conversation_turns"` over `src/` return nothing. The per-user table is referenced only in `src/flags.ts` and one persistence-contract test. Live row count is 0 (Appendix B), confirming it is not on the active V5 path.

So the thread the user sees is persisted on the scenario row (`scenarios.thread`), shared per scenario, with no per-user partition. The schema confirms it: `scenarios.thread` has no `user_id` or actor partition (phase-0 §4.1; thread entries carry `entry_id`, `origin`, `role`, `timestamp`, `actor_user_id` is on the per-user `conversation_turns` table, not on the shared thread).

Assistant copy ("you", "your") is generated server-side by the CEE orchestrator and rendered verbatim; the UI strips diagnostics but never rewrites pronouns. The copy assumes a single addressee.

### 2.2 Collaboration requirement

Per-user private AI thread; shared scenario state only through the event log; the assistant references patches by author.

### 2.3 Gap

- **P1.** The displayed and persisted thread is per-scenario-shared (`scenarios.thread`), not per-user. Today single-user RLS prevents cross-user reads, so there is no live leak. Once scenarios become multi-tenant (workspaces), every participant reading the scenario would read the shared thread, exposing each user's conversation to all members. This directly conflicts with the per-user-private-thread requirement.
- **P2.** The correctly-shaped per-user store (`conversation_turns`, RLS `auth.uid() = user_id`, immutable append) is built but unwired (0 rows, no reader). The migration is essentially "switch the display read path to the per-user store and stop relying on `scenarios.thread` for rendering".
- **P3.** Assistant copy is single-addressee and server-generated. Multi-participant addressing ("you" versus a named collaborator) is a CEE-side copy concern, not a UI transform.

### 2.4 Unknowns

- Why `conversation_turns` has zero rows despite an apparently always-on insert path: the V5 turn flow (`callV5Turn`) likely bypasses the insert (consistent with the memory note that `sendMessage` now routes through `callV5Turn` and does not reach the older envelope handler). Worth confirming during implementation, because it changes whether the per-user store needs new write wiring or just a read switch.
- The `scenarios.thread` hydrate and persist paths are both feature-flagged (`isThreadHydrateEnabled()`, `isThreadPersistEnabled()`). The interaction between these flags and a future per-user store needs a single owner.

---

## 3. Canvas surface (Task 2)

### 3.1 Current map

Core: `src/canvas/ReactFlowGraph.tsx` (React Flow host), `src/canvas/store.ts` (Zustand store: nodes, edges, selection, undo/redo, validation), `src/canvas/store/scenarios.ts` (localStorage scenario CRUD), `src/hooks/useScenario.ts` (Supabase persistence bridge, debounced autosave), `src/services/scenarioService.ts` (CRUD and RPC wrappers), ELK layout under `src/canvas/layout/`.

### 3.2 Single-writer assessment (the critical falsification target)

Confirmed: the canvas is single-writer per scenario, with no concurrency control, and two distinct write paths.

- **Direct path (manual edits).** `updateNode`/`updateEdge` in `store.ts` mutate local state optimistically and push to undo history with no server call. A debounced subscriber (`useScenario.ts`, 1500 ms) then calls `scenarioService.saveGraph`, which is a direct `UPDATE scenarios SET graph` filtered only by `id`, with no `updated_at` check, no version column, no graph-hash guard (`src/services/scenarioService.ts:152-168`). The function comment itself reads "direct UPDATE, no event". Same pattern for `saveFraming` (`scenarioService.ts:174+`). This is last-write-wins.
- **Logged path (AI patches).** `applyPatchAndLog` calls the `apply_patch_and_log` RPC with an event type of `patch_accepted`/`patch_dismissed`/`patch_rejected` (`src/services/scenarioService.ts:372-398`). `appendEvent` calls `append_scenario_event` (`scenarioService.ts:404-428`). These are the only writers of the scenario event log.

There is no refetch loop or Supabase subscription on `scenarios`; the graph is loaded once on scenario switch and assumed stable thereafter. Selection state (`selection.nodeIds`, `selection.edgeIds`, `anchorPosition`) is per-client and never persisted (`store.ts:302`). Viewport (pan and zoom) is held by React Flow internals via `useReactFlow()` and is not in the store and not persisted (`ReactFlowGraph.tsx:346`). The store has zero concept of remote users, authorship, presence, or locking.

### 3.3 Collaboration requirement

Presence (cursor and selection per user), single-host edit lock, suggest-mode ghost overlays for non-host proposals, structural changes through validate-patch (never CRDT).

### 3.4 Gap and carry-capacity assessment

- **P1.** The event log is half-blind. Manual edits bypass it entirely (direct `saveGraph`), and only AI patches are logged. The brief's "shared state via event log" and "AI references patches by author" cannot work for manual edits as built. Either manual edits must route through a logged, attributed path, or the model must rely on a single-host lock so only one writer mutates `scenarios.graph` at a time.
- **P1.** Last-write-wins with no optimistic concurrency means two writers silently overwrite each other. A single-host lock is mandatory before concurrent editing; the brief's single-host model is the correct mitigation and the store does not resist it.
- **Positive (low rework for presence and overlays).** The store can carry presence and ghost overlays additively:
  - Node and edge data schemas use Zod `.passthrough()` (`src/canvas/domain/nodes.ts`, `src/canvas/domain/edges.ts`), so additive fields such as `remoteEditingBy` or `pendingProposal` pass validation without a schema migration.
  - An existing ghost-node pattern (`GhostOptionNode`, `src/canvas/nodes/GhostOptionNode.tsx`, injected in `ReactFlowGraph.tsx`) already renders provisional, non-interactive overlay nodes with a dashed style. This is a direct precedent for suggest-mode ghost overlays.
  - Selection is per-client and viewport is React Flow-internal, so remote-cursor and remote-selection layers can be added as a React Flow custom layer without touching the graph mutation model.

Net: the canvas rendering store is structurally ready for presence and ghost overlays with additive changes. The work is concentrated in the persistence and locking model, not the store.

### 3.5 Unknowns

- The two write paths mean a suggest-mode implementation must decide which path proposals use. Routing everything through `apply_patch_and_log` would give a single attributed log, but manual edits currently do not use it.
- `apply_patch_and_log` enforces ownership through `auth.uid() = user_id` on the scenario (phase-0 §3.2). Under workspaces this becomes a membership check, and the service-role CEE path (`store_draft_graph`) needs a different rewrite (phase-0 §7.5).

---

## 4. Inspector surface (Task 3)

### 4.1 Current map and per-user vs shared classification

Nine panels in `src/canvas/ui/inspector-v2/panels/`, routed by `InspectorRouter.resolvePanelType` from the selected node or edge:

| Panel | Backing | Note |
|---|---|---|
| DecisionPanel | Per-user (selection) | Reads `optionComparison` from results for display only |
| OptionPanel | Per-user (selection) | Intervention editing |
| GoalPanel | Hybrid | Per-user selection; reads shared post-analysis constraints and probabilities |
| FactorControllablePanel | Per-user (selection) | Reads `displayMetadata` from results |
| FactorObservablePanel | Per-user (selection) | Observed value editing |
| FactorExternalPanel | Per-user (selection) | Prior range editing |
| EdgePanel | Per-user (selection) | Reads shared robustness and e-values for display |
| OutcomePanel | Per-user (selection), read-only | |
| RiskPanel | Per-user (selection) | |

All panels are selection-driven (per-user) and read shared analysis results for display only. Selection state is per-client (§3.2), so the inspector is inherently per-user already.

### 4.2 Write paths

All writes go through `useInspectorMutations` (and `useNodeMutations`/`useEdgeMutations`) to `updateNode`/`updateEdge` in `store.ts` (local, optimistic). No panel writes directly to a service. This means inspector edits take the same direct, unlogged `saveGraph` path as canvas drags (§3.2), inheriting the same event-log blindness.

### 4.3 F.6 check (does any panel compute or default a semantic value owned by another service?)

The boundary contract requires the UI to validate response shape and never repair semantics (boundary contract v1.1 §4.1, §8.1 step 4). CLAUDE.md tracks legitimate UI transforms with UI-SEM tags. Result of the scan: **yes, the inspector contains untagged semantic derivations.** They are display-side (not forwarded upstream, so they do not corrupt the PLoT or CEE data flow), but they are untagged and one is a genuine synthesis.

| Location | Code | Classification | Severity |
|---|---|---|---|
| `InspectorRouter.tsx:142` | `ep >= 0.7 ? 'high' : ep >= 0.4 ? 'medium' : 'low'` (edge confidence level from `beliefExists`) | Untagged semantic classification | P2 |
| `InspectorRouter.tsx:201` | `avg >= 0.7 ? 'high' : avg >= 0.4 ? 'medium' : 'low'` over the **average of inbound edge beliefs** to fabricate a node confidence | Untagged synthesis (a value no service produced) | P2 |
| `EdgePanel.tsx:113-122` | `thresholdColor`/`thresholdTrackVar` (0.7/0.4 to colour) | Display formatting, untagged (UI-SEM-010 is the precedent for tagging such colour thresholds) | P3 |
| Factor panels (Observable, Controllable, External) | value-of-information level from a 0 to 1 score via 0.7/0.4 thresholds | Untagged semantic classification, same class as UI-SEM-014 | P2 |
| `EdgePanel.tsx:155` | `weight ?? 0.5`, `direction ?? 'positive'` | Correctly tagged UI-SEM-029 | none |

The strongest item is `InspectorRouter.tsx:201`: it synthesises a node-level confidence by averaging inbound edge beliefs, a quantity no service supplies. This is the same class as tagged transforms elsewhere (UI-SEM-017, UI-SEM-018 fabricate confidence levels and scores). Recommendation: tag these (assign UI-SEM ids) or, better for collaboration consistency, source confidence levels and value-of-information levels from PLoT or CEE so collaborators see identical semantics.

### 4.4 Comment mount points

Every panel has a stable element id in scope (`nodeId` or `edgeId`, passed as props and used by the mutation hooks). The single best shared mount for a future per-element comment thread is `PrimaryControlCard` (`src/canvas/ui/inspector-v2/shared/PrimaryControlCard.tsx`), used by all nine panels as the primary editing container. Passing `elementId={nodeId ?? edgeId}` would let it host a comment button and thread with least disruption. `ConnectionRow` is a secondary candidate for per-connection comments.

### 4.5 element_comments reconciliation (flagged for explicit verification)

`element_comments` does not exist anywhere: no migration references it, no `src/` code references it, and it is absent from all three databases. The earlier reconnaissance that attributed it to migration `20250512173154_empty_fountain.sql` was wrong; that migration is a teams RLS policy fix (read in full). So the scope contract v1.2 speccing `element_comments` as a new table has **no shape conflict**, but two adjacent realities matter:

- Four legacy comment tables exist: `decision_comments` (0 rows; columns include `decision_id`, `parent_id`, `content`, `context`, `mentions`, `deleted_at`), `canvas_comments` (36 rows; columns include `canvas_id`, `block_id`, `parent_id`, `content`, `position`, `resolved`, `resolved_by`), `canvas_version_comments` (10 rows), `criteria_comments` (0 rows). `canvas_comments` is a full threaded, positioned, resolvable per-element comment system and is the closest design precedent for `element_comments`.
- These legacy tables have no migration provenance in this repo and no current code (see §8). The new `element_comments` must avoid naming and semantic collisions with them.

### 4.6 Unknowns

- The inspector and canvas share the unlogged write path, so per-element comments anchored to a node or edge id need a stable id contract that survives graph edits. Node and edge ids are client-generated and normalised (`src/utils/nodeIdNormalisation.ts`); comment anchoring must survive id normalisation.

---

## 5. Cross-surface state and presence (Task 4)

### 5.1 Shared versus per-user state

| State | Classification | Evidence |
|---|---|---|
| Scenario graph (`scenarios.graph`) | Shared (the collaborative artefact) | phase-0 §4.1; `scenarioService.saveGraph` |
| Analysis and brief (`scenarios.analysis*`, `brief`) | Shared | phase-0 §4.1 |
| Snapshots (`scenario_snapshots`) | Shared (immutable review artefact) | phase-0 §4.3; 0 rows live |
| Conversation thread (`scenarios.thread`) | **Currently shared per scenario; must become per-user** | §2.1 (this is the P1) |
| Per-user conversation (`conversation_turns`, `v5_conversation_turns`) | Per user | phase-0 §4.4, §4.5; RLS `auth.uid() = user_id` |
| Handler facts (`v5_handler_facts`) | Per user (narrative privacy) | phase-0 §5 |
| Selection, anchor | Per client, never persisted | `store.ts:302` |
| Viewport (pan, zoom) | Per client, React Flow internal | `ReactFlowGraph.tsx:346` |
| Inspector open or closed, panel visibility | Per client, never persisted | store ephemeral panel flags |

### 5.2 Existing realtime inventory

| Mechanism | Where | Live in shipped app? | Purpose |
|---|---|---|---|
| SSE (`EventSource`) | `src/lib/sseClient.ts`, `src/lib/plotStream.ts`, `openSSE` via `src/lib/pocEngine` | Yes (AppPoC imports `openSSE`) | Analysis job progress and token streaming |
| Supabase Realtime on `decision_collaborators` | `src/contexts/DecisionContext.tsx` | **No** (DecisionProvider not mounted by AppPoC) | V1 collaborator list changes |
| Supabase Realtime on `options` | `src/hooks/useDecisionOptions.ts` | **No** (V1 decision flow only) | V1 decision options |
| Supabase Realtime on `scenarios` or any V5 surface | none | n/a | Does not exist |

There is no Supabase Realtime, WebSocket, or presence on the V5 canvas, conversation, or inspector. The only live realtime is SSE for streaming.

### 5.3 Presence readiness

Greenfield in the live app. There is a complete legacy presence schema in the live database (`canvas_presence`: `canvas_id`, `user_id`, `cursor_position`, `last_seen`, `editing_block_id`) and a Realtime usage pattern in `DecisionContext.tsx`, but both are dormant or unmounted (see §8). They are harvestable precedents, not live infrastructure. The `editing_block_id` column in particular is a precedent for the single-host or per-element edit-lock signal the brief's model needs.

### 5.4 Yjs view-CRDT boundary check

`yjs ^13.6.27` and `y-websocket ^3.0.0` are declared in `package.json:117-118` but imported nowhere in `src/` (no `from 'yjs'`, no `Y.Doc`, no `WebsocketProvider`). They are pre-positioned dependencies, currently unused. Nothing in the current surfaces attempts collaborative state, so there is no conflict with the planned view-CRDT boundary. The structural-change-via-validate-patch rule is consistent with the current `apply_patch_and_log` and `ValidatePatchRequest` plumbing (boundary contract v1.1 §6.3).

---

## 6. Teams zero-usage verification (Task 5)

### 6.1 Method and environment note

Live counts via Supabase MCP across both active projects. `Olumi` (`etmmuzwxtcjipwphdola`, the project in memory, us-east-1) holds all real data. `Olumi-EarlyAccess` (`ewyskeampbmbagyclvfn`, eu-west-2) is a near-empty stub: one table, `early_access`, 0 rows. The third project (`vaslbdceyqwcgzjlftgi`, "sb1-8t1bpc") is inactive and was not woken. So the teams question is answered against `Olumi`; `Olumi-EarlyAccess` has no teams or decisions data.

### 6.2 Row counts (Olumi)

| Table | Rows | Distinct users | Newest | Note |
|---|---|---|---|---|
| `teams` | 5 | 3 creators | 2025-06-24 | 3 named "test 1/2/3" (test1@invayo.co), 2 empty "Default Team" (developer accounts) |
| `team_members` | 3 | 2 | 2025-05-15 | All developer or test accounts; the two "Default Team" rows have 0 members |
| `decisions` | 213 | 4 | 2025-10-31 | 176 of 213 have `team_ids` populated |
| `decision_collaborators` | 3 | 3 | 2025-05-14 | All for one decision, all status "invited" (never joined), all the auditee's own accounts |
| `invitations` | 6 | n/a | n/a | The live invite table (see §6.4) |

For contrast, the live V5 product is active: `scenarios` 391 rows / 7 users / newest 2026-05-30; `v5_conversation_turns` 1543 rows / 5 users / newest 2026-05-30. The UI `conversation_turns` table is 0 rows.

### 6.3 Falsification result

The hypothesis "teams is zero-usage" is refuted on row count (5 teams, 213 decisions) but **substantively confirmed dormant**: every team is a developer or test account, the newest team is roughly 11 months old, the newest decision roughly 7 months old, and the only `decision_collaborators` rows are the auditee inviting their own accounts, none of which ever joined. There is no real multi-user usage. This is "code-reachability and live-state verified", not "code-reachability only".

### 6.4 Reachability map

- `/teams` and `/teams/:teamId` are defined in `App.tsx:252,262` (lazy `MyTeams`, `TeamDetails`), and a Teams nav link exists at `src/components/navigation/Navbar.tsx:150`. But `App.tsx` is unmounted (§1.1), so these are **unreachable in the shipped product**. The live `AppPoC` has no `/teams` or `/decision` route (`src/poc/AppPoC.tsx:911-931`); a Teams link, even if rendered, would fall through to the `*` catch-all.
- Account deletion (`supabase/functions/delete-account/`) does not reference teams, so it does not clean up team memberships; given teams is dead, this is inert.
- The invite email path (`supabase/functions/send-team-invite/index.ts`, Brevo API) is intact but only invoked from the unmounted `ManageTeamMembersModal`.
- The migration files reference a `team_invitations` concept through `get_team_invitations` RPCs, but the live database realises invites as a single unified `invitations` table (columns `email`, `status`, `invited_by`, `team_id`, `role`, `decision_role`, `organisation_id`). This is a migration-versus-live divergence, captured for §9.

### 6.5 Severity

P3. Teams and decisions are dead, unreachable, and dormant. They block nothing; they are a cleanup and harvest opportunity.

---

## 7. Teams component reuse map (Task 6)

Verdicts reflect that workspace roles (owner/admin/editor/viewer) differ from the teams model (admin/member), V5 scenario ownership differs from V1 decision ownership, and the components are coupled to the teams context and the V1 `decisions` flow. Component paths and sizes confirmed in the repo.

| Component | What it does | Maps to workspace need | Verdict | Effort | Notes |
|---|---|---|---|---|---|
| `CreateTeamModal` (115 ln) | Create a team (name, description) | Create workspace | Port pattern only | S | Trivial form; rebuild against workspace model |
| `EditTeamModal` (116 ln) | Edit team name and description | Edit workspace | Port pattern only | S | As above |
| `TeamDetails` (175 ln) | Team detail page, members, actions | Workspace detail and members panel | Port pattern only | M | Layout reusable; data and roles rebuilt |
| `MyTeams` (201 ln) | List of teams for the user | Tenant switcher and workspace list | Port pattern only | M | Listing pattern reusable; backing query rebuilt |
| `ManageTeamMembersModal` (452 ln) | Tabbed invite (email, directory), pending-invite management, edge-function health check, dual team and decision roles | Members panel and invite flow | Port pattern only | L | Richest reusable UX (tabs, pending management, multi-email, health check). Tightly coupled to `useTeams`, `Team`, `Invitation`, and the team-plus-decision dual-role model. `DecisionRole` here (owner/approver/contributor/viewer) is a near-precedent for workspace roles |
| `InviteCollaborators` (123 ln) | Single-email invite to a decision via `useTeams().inviteTeamMember(decisionId, ...)` | Invite flow | Port pattern only | S | Conflates team member and decision collaborator; coupled to `decisionId`. UX shell reusable, logic rebuilt |
| `TeamsContext` (312 ln) | React context: teams CRUD, members, invitations, RPC wrappers | Workspace context | Discard (rebuild) | M | Bound to teams tables, admin/member roles, `get_team_invitations`. New workspace context is a clean build |
| `send-team-invite` (edge function) | Brevo invite email | Workspace invite email | Reuse as-is (config) to Port pattern | S | Email sending is reusable with payload and template changes (`team_id` to `workspace_id`) |

Two data-model precedents worth harvesting beyond the components:

- `decision_collaborators` schema (role plus a `permissions` JSONB of `can_rate`/`can_comment`/`can_suggest` plus an invite lifecycle `invited` to `joined`) is a closer match to a granular workspace-or-element permission model than the teams admin/member binary.
- `canvas_presence` (`cursor_position`, `last_seen`, `editing_block_id`) is a presence and edit-lock precedent.

Net: no component is "reuse as-is" for workspaces except the email edge function with config changes. The honest verdict is "port pattern only" across the UI, with `ManageTeamMembersModal` the highest-value pattern to port.

---

## 8. Collaboration unknown-unknowns (Task 8 in the brief numbering; synthesis)

1. **Two app shells, only one mounted (P1 for planning clarity).** `main.tsx` mounts `AppPoC`; `App.tsx` is imported by nothing and is dead. Everything the prior recon and the brief treated as "live teams and decisions collaboration" is in the unmounted shell. Impact: the collaboration build is greenfield against the live app, and the V1 collaboration UI is not a live surface to protect. Disposition: treat `App.tsx` and its subtree as dead code; do not assume any of it runs.

2. **Conversation thread is per-scenario-shared (P1).** §2. The displayed thread is `scenarios.thread`, not a per-user store. Impact: a privacy violation the moment scenarios go multi-tenant. Disposition: move display to the per-user `conversation_turns` (already shaped correctly) before workspaces ship.

3. **The event log is half-blind, and graph writes are last-write-wins (P1).** §3.2. Manual edits skip the event log and use a direct unguarded `UPDATE`. Impact: the "shared state via event log" model and any concurrency safety do not hold for manual edits. Disposition: single-host lock plus a decision on whether manual edits become logged and attributed.

4. **Orphaned, data-bearing legacy collaboration tables with no repo provenance (P2).** `canvas_blocks` (164), `canvas_comments` (36), `canvas_versions` (46), `canvas_permissions` (24), `canvas_presence` (3), `canvases` (23), `organisations` (11), `organisation_members` (14) exist in the live `Olumi` database, but no migration in this repo creates them and no `src/` code references them. They are remnants of an earlier product generation sharing the same Supabase project. Impact: naming collisions with the planned schema (`canvas_presence` versus a new presence table; `canvas_comments` versus `element_comments`; `organisations`/`organisation_members` versus `workspaces`/`workspace_members`), and confusion in any live-state introspection. Disposition: decide whether to archive or drop them as part of the tenancy migration; the migration must not assume a clean namespace.

5. **A per-user conversation store is built but unwired (P2).** `conversation_turns` has correct per-user RLS and is the right destination, but it has 0 rows and no reader. Impact: the privacy fix in item 2 may be smaller than it looks (a read switch) or may need write wiring, depending on whether `callV5Turn` writes it. Disposition: confirm the write path during implementation.

6. **`cee_prompt_observations` has RLS disabled (P2, surfaced as required by the Supabase advisor).** The table is writable and readable by the anon role. It currently has 0 rows, so there is no live data exposure, but it is a latent hole (anon could write prompt observations). It is unrelated to the collaboration surfaces. Disposition: enable RLS with an appropriate policy; not a collaboration blocker.

7. **Migration-versus-live divergence on invitations (P3).** The migrations describe `team_invitations` through RPCs; the live database realises invites as a unified `invitations` table carrying `team_id`, `decision_role`, and `organisation_id`. Impact: any reuse of the invite plumbing must read the live shape, not the migration intent.

8. **Inspector synthesises a node confidence the service does not provide (P2).** `InspectorRouter.tsx:201` averages inbound edge beliefs into a node confidence level. Impact: collaborators could see UI-derived semantics that drift from the service truth; untagged under the UI-SEM discipline. Disposition: tag or source from PLoT or CEE.

9. **CEE turn-context builder reads all facts for a scenario regardless of user (P1, cross-repo, from phase-0 §5.4).** Once scenarios are multi-tenant, the service-role context builder (`olumi-assistants-service/src/orchestrator-v5/build-turn-context.ts:355-407`) would mix users' facts because it bypasses RLS. Impact: a server-side privacy leak distinct from the UI one. Disposition: add an explicit per-user filter in CEE code.

10. **Yjs is a declared but unused dependency (P3).** `package.json:117-118`. Impact: low; it signals intent for the view-CRDT but is not wired, so there is no conflict and no current behaviour to protect.

---

## 9. Spec and contract deltas (Task 8: HELD pending v1.2 documents)

Per the agreed approach (Option 2), section-referenced deltas to the v1.2 scope contract and tenancy/RLS migration spec are deferred until those documents are supplied. The following are the infrastructure-level deltas the surface analysis proves necessary, each tagged provisional. They are written against the reconstructed model and the phase-0 audit, not against the unavailable v1.2 sources.

**Provisional, pending v1.2 docs:**

- **D1 (conversation privacy).** The conversation display path must move off the shared `scenarios.thread` onto a per-user store before multi-tenant scenarios. The per-user `conversation_turns` table already has the correct shape and RLS; the migration spec should name the read-path switch and the disposition of `scenarios.thread` (deprecate for display, or keep as a shared activity log without rendering it as the private thread).
- **D2 (canvas write attribution).** The migration spec or scope contract must add a decision on the two graph write paths: either route manual edits through a logged, attributed path so the event log is the single source of truth, or pair the direct `saveGraph` path with a single-host lock plus per-edit authorship. As built, the event log does not see manual edits.
- **D3 (single-host lock and concurrency).** The scope contract's single-host model must be the gate before any concurrent editing, because `scenarios.graph` writes are last-write-wins with no optimistic-concurrency control. No table or RPC currently carries a version, `updated_at` guard, or lock token; one is needed.
- **D4 (element_comments is new, but the namespace is not clean).** `element_comments` does not exist, so there is no shape conflict, but the migration must reconcile with orphaned legacy tables (`canvas_comments`, `canvas_presence`, `organisations`) that exist in the live database with no repo provenance. The migration spec should name a disposition (archive or drop) for these.
- **D5 (presence table).** Presence is greenfield in code. A new presence table or channel is needed; the legacy `canvas_presence` shape (`cursor_position`, `last_seen`, `editing_block_id`) is a usable precedent and the migration spec can reference it.
- **D6 (tenancy, confirming phase-0).** `workspace_id` is needed on `scenarios` and the per-user tables; `conversation_turns` and `scenario_snapshots` must be added to the migration spec inventory (phase-0 §7.3); CEE service-role RPCs need the caller-side membership rewrite (phase-0 §7.5); the CEE turn-context builder needs a per-user filter (phase-0 §5.4).
- **D7 (orphaned tables and schema hygiene).** The migration spec should record that the live `Olumi` project carries tables with no migration provenance in this repo, so any "expand then backfill then switch" plan must account for a namespace that is not clean.

Tables or RPCs that neither document currently names but the surface analysis reveals as necessary: a presence table or Realtime channel (D5); a per-edit authorship or lock mechanism (D2, D3); and an explicit `element_comments` table that coexists with or replaces the orphaned `canvas_comments` (D4).

---

## 10. Teams disposition recommendation (Task 9)

### 10.1 Restated finding

Zero-usage is refuted on row count (5 teams, 213 decisions, 3 collaborators) but substantively confirmed: all data is developer or test, dormant 7 to 11 months, and the entire teams and decisions UI is in the unmounted `App.tsx` shell, unreachable in the shipped product. Live-state verified (not code-reachability only).

### 10.2 Options

- **B (freeze and hide).** Already true de facto. Formalising it adds little, and it discards the genuinely useful UI patterns and data-model precedents.
- **C-lite (freeze and hide, port useful UI patterns).** Retire the dead `App.tsx` collaboration code, harvest the patterns (the `ManageTeamMembersModal` tabbed invite and pending-management UX, the invite email edge function, the `decision_collaborators` role-plus-permissions-plus-lifecycle model, the `canvas_presence` cursor and edit-lock shape) into the new workspace build, and freeze the dormant tables.
- **C-full (migrate teams and decisions into workspaces).** Not warranted: it would migrate developer and test data from a dead app, with backfill and role-mapping cost and no user benefit.

### 10.3 Recommendation: C-lite

C-lite. The data is not worth migrating, but the UX investment and the data-model precedents are worth harvesting, and the phase-0 audit's Branch B (new `workspaces` tables) is the right foundation. This matches phase-0's own teams assessment (teams not reusable for V5) while preserving the harvest.

### 10.4 Orphan-data handling for `decisions.team_ids`

`decisions.team_ids` is a `uuid[]` array (`supabase/migrations/20250512143948_stark_coast.sql:49`), so it never had referential integrity to `teams` (arrays cannot carry foreign keys); 176 of 213 decisions have it populated, all developer or test. Under C-lite: freeze the `decisions` table read-only, leave `team_ids` as inert arrays (they reference frozen teams), and require no migration. After a safety window, the `decisions`, `teams`, `team_members`, and `invitations` tables can be dropped or archived together, since all rows are developer or test data in dead code. If, contrary to this evidence, any real user decision is later found, the minimum safe path is to keep the tables frozen and read-only rather than delete, and to snapshot them before any drop.

### 10.5 Minimum safe path if live usage is later discovered

Freeze and hide (do not delete), snapshot `teams`, `team_members`, `invitations`, `decision_collaborators`, and `decisions` before any structural change, and gate any drop on a positive confirmation from Paul that no row belongs to a real user.

---

## Appendix A: base commits per repo

- **DecisionGuideAI:** branch `claude/collab-surface-recon` cut from `eab0365f5ac25da83efa74300c12d98f60c0179f` (= `origin/staging` head at audit time; the audit adds exactly one file).
- **Prior phase-0 audit:** `git show claude/collab-phase0-audit:docs/audits/collab-phase0-audit-v1.md`, commit `1e1028bff393e351289decf9a66efbab14cd1910`.
- **olumi-assistants-service:** HEAD `ac93197e`. Boundary contract v1.1 read (read-only) from the working tree at `Docs/v5/olumi-boundary-contract-v1_1.md`; only this document and phase-0's cited CEE paths were referenced. The CEE working tree carries pre-existing uncommitted changes (`data/prompts.json` and two `node_modules/.bin` symlinks) that were not produced by this read-only audit and were left untouched.
- **Supabase projects:** `etmmuzwxtcjipwphdola` (Olumi, active, all real data), `ewyskeampbmbagyclvfn` (Olumi-EarlyAccess, active, stub), `vaslbdceyqwcgzjlftgi` (inactive, not queried).

## Appendix B: raw query and grep outputs

**Row counts (Olumi, `etmmuzwxtcjipwphdola`):**

```
decisions              n=213  distinct_users=4  oldest=2025-02-12  newest=2025-10-31  with_team_ids=176
scenarios              n=391  distinct_users=7                     newest=2026-05-30
v5_conversation_turns  n=1543 distinct_users=5                     newest=2026-05-30
conversation_turns     n=0    distinct_users=0                     newest=null
teams                  5 rows  (test 2 / Test 3 / Test 1 by test1@invayo.co; 2x Default Team by developer accounts)
team_members           3 rows  (test1@invayo.co x2 member, phslee81@gmail.com x1 member)
decision_collaborators 3 rows  (one decision; all status=invited; permissions {can_rate,can_comment,can_suggest}; auditee's own accounts)
```

**Olumi-EarlyAccess (`ewyskeampbmbagyclvfn`):** one table `early_access`, 0 rows.

**Legacy table column shapes (Olumi):**

```
canvas_comments        id, canvas_id, block_id, organisation_id, user_id, parent_id, content, position(jsonb), resolved, resolved_by, resolved_at, created_at, updated_at
canvas_presence        id, canvas_id, user_id, cursor_position(jsonb), last_seen, editing_block_id
canvas_permissions     id, canvas_id, user_id, team_id, permission_type, granted_by, created_at
decision_collaborators id, decision_id, user_id, role, status, permissions(jsonb), email, invited_at, joined_at, created_at, updated_at
decision_comments      id, decision_id, user_id, parent_id, content, context(jsonb), mentions(jsonb), created_at, updated_at, deleted_at
invitations            id, email, invited_at, status, invited_by, team_id, role, decision_role, organisation_id
```

**Supabase advisor (Olumi):** `public.cee_prompt_observations` has RLS disabled (0 rows; latent, surfaced per advisor requirement).

**Key code evidence:**

```
src/main.tsx:108,206                       mounts AppPoC (not App.tsx)
src/poc/AppPoC.tsx:911-931                  live routes: no /teams, no /decision
App.tsx                                     imported by nothing in src (unmounted)
src/services/scenarioService.ts:152-168     saveGraph: direct UPDATE, no event, no version guard (last-write-wins)
src/services/scenarioService.ts:372-398     applyPatchAndLog: apply_patch_and_log RPC (only logged write path)
src/hooks/useScenario.ts:470-475            thread hydrated from row.thread (scenarios.thread, shared)
src/canvas/conversation/useConversation.ts:1448-1456  display hydrated from _hydratedThread
rg "conversation_turns" src/                only src/flags.ts + one test; no select anywhere
src/canvas/ui/inspector-v2/InspectorRouter.tsx:142,201  untagged confidence-level derivation/synthesis
src/canvas/ui/inspector-v2/panels/EdgePanel.tsx:113-122,155  threshold colours (untagged) + UI-SEM-029 (tagged)
package.json:117-118                        yjs, y-websocket declared; not imported in src
src/contexts/DecisionContext.tsx            Supabase Realtime on decision_collaborators (provider unmounted)
src/hooks/useDecisionOptions.ts             Supabase Realtime on options (V1 only)
src/lib/sseClient.ts, src/lib/plotStream.ts SSE for analysis and token streaming (live)
supabase/migrations/20250512143948_stark_coast.sql:49  decisions.team_ids uuid[] DEFAULT '{}'
supabase/migrations/20250512173154_empty_fountain.sql  teams RLS fix (NOT element_comments)
```

---

*End of audit*
