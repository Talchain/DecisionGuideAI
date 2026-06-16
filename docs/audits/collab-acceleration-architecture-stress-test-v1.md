# Collaboration acceleration architecture stress-test

**Brief:** COLLAB-ACCELERATION-STRESS-TEST-v1
**Date:** 2026-06-16
**Branch:** `claude/tenancy-collab-spec-v1_6` (PR [#190](https://github.com/Talchain/DecisionGuideAI/pull/190))
**Type:** Read-only, evidence-based architecture audit. No code, schema, migration, prompt, package, lockfile, generated, test, config, or SQL changes. This audit adds exactly one file alongside the v1.7 spec revision.
**Purpose:** test Paul's concern that the current collaboration plan may be too cautious, under-ambitious, or sequencing work too slowly, and recommend the fastest safe path to the strongest collaboration foundation. The audit may challenge the spec, but it does not override any locked decision without flagging that Paul and ChatGPT must approve.
**Method:** repo inspection plus the prior collaboration evidence chain (phase-0, surface recon, teams disposition, environment and namespace verification, multi-user design recommendations). Eight load-bearing live-code claims were re-verified on the staging head on 2026-06-16. No new live database introspection was performed; live database facts are cited from the environment and namespace audit (read-only introspection, 2026-06-04).

**Evidence classification used throughout:** live-code (re-verified 16 June 2026), live-introspection (environment and namespace audit, 4 June 2026), migration-file, docs-only, or inferred / Paul-stated. Confidence: high, medium, or low. Per the brief, old migration files are not treated as live truth; live facts rest on the 4 June introspection.

---

## 0. Headline recommendation (answers the brief's control question)

**We are mostly designing the fastest safe path, with one correctable over-sequencing.** The graph-mutation-free first slice is correctly cautious, because last-write-wins graph saves are live and current (`src/services/scenarioService.ts:152`, re-verified 16 June, high confidence). The single change worth making is to stop treating the first user-visible collaboration value (comments) as a step that waits behind the edit-lock gate. Comments are graph-mutation-free and, on the evidence below, can ship as **comments-on-refetch** without even depending on the Realtime substrate in their first iteration.

**Recommendation (B10, restated up front): keep the first implementation slice graph-mutation-free, and run comments as a parallel value track immediately after the workspace foundation lands, delivered first as comments-on-refetch.** This overturns no locked decision (the first slice stays graph-mutation-free; comments are graph-mutation-free too). It is a sequencing recommendation for Paul and ChatGPT to ratify. Implementation and cutover remain blocked on the standing hard gates (deployed `VITE_SUPABASE_URL`, rehearsal environment, cross-repo CEE service-role verification, and an executable security matrix).

---

## B1. The ultimate collaboration target (from existing material)

Grounded in the multi-user design recommendations (`docs/designs/collab-multiuser-design-recommendations-v1.md` §2, §12, docs-only, high confidence) and the tenancy and collaboration spec v1.7, the strongest target the existing material implies is a **private, membership-gated, workspace-scoped collaboration product for 2 to 5 collaborators**, built on the live `AppPoC` V5 surface, with:

- **Workspace-based tenancy** (fresh `workspaces` / `workspace_members` / `workspace_invites`; membership-aware RLS), replacing single-user `auth.uid() = user_id`.
- **Private membership-gated collaboration** (no public discovery; non-member inference prevented).
- **Per-user conversation and facts privacy** (`conversation_turns`, `v5_conversation_turns`, `v5_handler_facts` stay per-user within a workspace; SEC-10).
- **A shared scenario graph** as the single collaborative artefact (`scenarios.graph`).
- **Scenario presence** (focused-element awareness; no live cursors for the MVP).
- **Edit locks** (single-host `scenario_edit_locks`, server-side and mandatory).
- **Guarded graph save** (`save_graph_guarded` replacing the direct last-write-wins `UPDATE`, with optimistic concurrency on `event_seq` and `graph_hash`).
- **A suggestion queue** (`patch_suggestions`; non-host proposals rendered as ghost overlays; acceptance is a guarded mutation).
- **Comments** (`element_comments` plus per-user `element_comment_reads`; viewers may comment).
- **Snapshots and review links** (`scenario_snapshots` plus a read-only canvas mode and reviewer mode).
- **Publish and brief approval** (`create_shared_brief` gated by `approver_flag`; public read by slug through an allowlist).
- **Event-author attribution** (every canonical mutation appends an attributed event through one shared path).
- **Future TAE compatibility with zero Track A dependency** (event-author attribution plus per-user privacy are sufficient foundations; no foundation-level TAE data structures are required now).

**Capabilities the current plan defers but the ultimate target clearly needs (named, as the brief requires):**

| Deferred capability | Status today | Evidence | Why the target still needs it |
|---|---|---|---|
| Durable per-user conversation store | `conversation_turns` is display-shaped but has 0 rows and no reader; the display path hydrates from the shared `scenarios.thread` instead | live-introspection (env audit §5); live-code (`useScenario.ts:470-475`, `useConversation.ts:1448-1456`), high | Per-user-private conversation history must survive multi-tenancy and reload |
| Live cursors | Not built; presence is greenfield | live-code (no `.channel`/presence in the live tree), high | A richer awareness layer; explicitly deferred for the MVP to avoid re-render churn |
| Yjs / CRDT view layer | Declared but unimported (`package.json:117-118`) | live-code, high | Only if future scale demands it; out of MVP by locked decision |
| Workspace deletion | Forbidden in the MVP | docs-only (spec §11), high | Lifecycle completeness post-MVP |
| Ownership transfer | Deferred | docs-only (spec §11), high | Lifecycle completeness post-MVP |

---

## B2. Is the current staged plan too timid?

The current planned first slice is workspace context, workspace switcher, members list, invite lifecycle skeleton, scenario presence, and no graph mutation.

**Verdict: the first slice is correctly cautious on the one thing that is genuinely dangerous, but the overall sequence is mildly over-sequenced on comments.**

- **Correctly cautious (keep).** Graph saves are last-write-wins today: `saveGraph` is a direct `UPDATE scenarios SET graph` filtered only by `id`, with no version, `updated_at`, or graph-hash guard (`src/services/scenarioService.ts:152`, re-verified 16 June, high confidence). The event log is half-blind: only `apply_patch_and_log` writes events (`scenarioService.ts:372`), so manual edits are invisible to it. Exposing any multi-user graph mutation before the lock, guarded save, optimistic concurrency, and consistent event logging land would silently lose data. The graph-mutation-free first slice is the right call and must stay.
- **Over-sequenced (correct).** The design recommendations place comments at step 4, after the edit-lock gate (step 2) and the suggestion queue (step 3) (`collab-multiuser-design-recommendations-v1.md` §2, docs-only). But comments do not mutate the graph and do not depend on the lock. A `comments` feature flag already exists (`src/flags.ts:43`, `isCommentsEnabled`, live-code, high), `element_comments` is greenfield with no shape conflict (live-introspection, env audit §3), and the inspector mount point is ready (`PrimaryControlCard`, used by all nine panels, live-code, high). Holding the first user-visible collaboration value behind the heaviest, most safety-critical work is slower than it needs to be without being any safer.
- **Underusing existing code (partly).** The invite skeleton can harvest the legacy `ManageTeamMembersModal` tabbed-invite and pending-management pattern and the `send-team-invite` Brevo email pattern (port-pattern-only, surface recon §7). The publish surface already partly exists single-user (`SharedBriefPage` at `/brief/:slug`, `src/poc/AppPoC.tsx:44,913`; `create_shared_brief` and `get_shared_brief_by_slug` live). These are not yet reflected as explicit acceleration levers in the plan.

So the plan is not timid where timidity is warranted (graph mutation), and the fix is a sequencing change (parallelise comments), not a relaxation of any safety gate.

---

## B3. Acceleration opportunities

Classification: **pull into first slice**, **parallel after foundation**, **keep sequenced later**, or **defer post-MVP**.

| # | Opportunity | Classification | Why |
|---|---|---|---|
| 1 | Workspace and invite foundation | Pull into first slice (it is the first slice) | Gates the whole MVP; design complete (spec §8); greenfield, no collision (live-introspection, env audit §3) |
| 2 | Private Realtime presence | First slice (paired with the realtime substrate) | Awareness only; not canonical; channel authorisation must be membership-gated (spec §17). Substrate must land first |
| 3 | Comments as the first collaborative value surface | **Parallel after foundation** | Graph-mutation-free; flag exists (`flags.ts:43`); table fully specced (v1.7 §12.1); mount ready (`PrimaryControlCard`). High leverage. See the Challenge pass below for the no-Realtime-first variant |
| 4 | Snapshot and review links | Parallel after foundation, lower priority | `scenario_snapshots` exists (0 rows, immutable, `create_snapshot` present, live-introspection env audit §5); `SharedBriefPage` ships single-user. Needs `workspace_id` plus a read-only canvas mode (separate brief) |
| 5 | Conversation display projection | Keep sequenced later (own brief) | P1 complexity: no durable display-ready store today (`conversation_turns` 0 rows); per-user privacy under multi-tenancy; the revive-versus-projection-versus-in-memory choice is an open blocker (spec §18) |
| 6 | Edit lock implementation | Keep sequenced (the gate) | The absolute graph-mutation gate; cannot be accelerated past its dependencies |
| 7 | Guarded save and event logging | Keep sequenced (the gate) | Replaces last-write-wins; must land with the lock and optimistic concurrency |
| 8 | Suggestion queue | Keep sequenced later | Depends on the lock and a consistent event log; `accept_suggestion` is a guarded mutation (v1.7 amendment 1) |
| 9 | Publish and brief approval | Keep sequenced later; parallel-capable | Partial prior art (`SharedBriefPage`, `create_shared_brief`); needs `approver_flag` plus public allowlist hardening and leak tests (spec §16) |
| 10 | Legacy teams and invite pattern harvesting | Pull into first slice as pattern reference only | `ManageTeamMembersModal` (452 ln) and `send-team-invite` Brevo email are the highest-value patterns to port; rebuilt against the workspace model, not reused (surface recon §7) |
| 11 | Reuse of `canvas_presence` / `canvas_comments` / `ManageTeamMembersModal` / `send-team-invite` / `decision_collaborators` | Prior-art design precedents only | The orphan `canvas_*` tables have no repo provenance and must not be reused or collided with (live-introspection, env audit §4); `decision_collaborators` role-plus-permissions-plus-lifecycle informs the workspace role model; `canvas_presence` (`cursor_position`, `last_seen`, `editing_block_id`) informs presence; `canvas_comments` informs the `element_comments` shape |

---

## B4. What must not be accelerated (hard gates)

| Capability | Hard gate that must be satisfied first |
|---|---|
| Multi-user graph mutation | The absolute graph-mutation gate: edit lock plus guarded save RPC plus optimistic concurrency (`event_seq` and `graph_hash`) plus consistent attributed event logging, all in place. Last-write-wins is live today (`scenarioService.ts:152`) |
| Suggestion acceptance | `accept_suggestion` is a guarded mutation RPC (v1.7 §15.4): server-side lock validation, rejects if another valid lock exists, revalidate, optimistic concurrency, attributed event. Depends on the lock gate and the suggestion queue |
| AI patch acceptance | The same guarded, attributed path; validate-patch mandatory on every structural change (spec §15.4) |
| Public brief sharing | Public allowlist (no ids, member or invite data, conversation, per-user tables, debug, or unsafe provenance), `approver_flag`, and public-brief leak tests (spec §16) |
| Workspace role changes | RPC-only lifecycle; admin cannot remove or grant owner; no self-escalation; the signed-off matrix (spec §11); constrained workspace update on an allowlist (v1.7 §8.2) |
| Cross-user conversation or fact visibility | Per-user RLS (SEC-10) plus a CEE per-user filter in `build-turn-context`; the conversation display must move off the shared `scenarios.thread` model before multi-tenant scenarios. The shared-thread leak is latent today only because `scenarios.thread` is absent live (live-introspection, env audit §6) |
| Realtime channel access | Server-side membership authorisation against `workspace_members` (RLS-backed channel policies); public channel names are not security (spec §17) |
| Migration cutover | Environment identity confirmed (deployed `VITE_SUPABASE_URL`), rehearsal environment provisioned, and an expand/backfill/switch with a delta backfill and assertion gate that covers both user-callable and CEE service-role writes; no mixed state (v1.7 §20). Plus cross-repo CEE service-role verification and an executable security matrix (readiness section) |

---

## B5. Fastest safe implementation sequence

This sequence keeps the locked graph-mutation-free first slice and adds comments as a parallel value track. The change from the design recommendations' build order (`collab-multiuser-design-recommendations-v1.md` §2) is that comments move ahead of the edit-lock gate, because they are independent of it.

### Phase 0: final spec and environment gates
- **Objective:** clear the blockers before any implementation brief.
- **Included:** Codex delta-check on v1.7; confirm deployed `VITE_SUPABASE_URL`; provision or approve a rehearsal environment; open the cross-repo CEE service-role verification workstream; confirm the security matrix is executable in CI.
- **Hard exclusions:** any code, schema, migration, or SQL.
- **Acceptance evidence:** clean delta-check; `VITE_SUPABASE_URL` confirmed; rehearsal environment available; CEE workstream scoped; CI able to run the SEC/TEN matrix.
- **Why this ordering:** these are independent of build order and several are long-lead (rehearsal environment, cross-repo CEE). Starting them now removes them from the critical path later.

### Phase 1: first implementation slice (workspace foundation)
- **Objective:** workspace tenancy and identity, with no graph mutation.
- **Included:** `workspaces` / `workspace_members` / `workspace_invites` and lifecycle RPCs (spec §8); `WorkspaceProvider` and switcher in `AppPoC`; members panel; invite lifecycle skeleton (harvesting the `ManageTeamMembersModal` and `send-team-invite` patterns, port-pattern-only); the Realtime substrate and provider; scenario presence (focused-element, dedicated presence store).
- **Hard exclusions:** any graph mutation; the edit lock; the guarded save; suggestions.
- **Acceptance evidence:** non-member cannot read workspace scenarios or join a channel (SEC-25 to SEC-28); personal-workspace default leaves single users unaffected; lifecycle RPC tests (TEN matrix).
- **Why faster or safer:** independently shippable and testable; gates everything else; no exposure to the last-write-wins hazard.

### Phase 2: first visible collaboration value (comments)
- **Objective:** deliver and validate real multi-user collaboration on a low-blast-radius surface.
- **Included:** `element_comments` and `element_comment_reads` (v1.7 §12.1); inspector mount at `PrimaryControlCard`; create, resolve, and per-user read state; viewers may comment. Delivered first as **comments-on-refetch** (see the Challenge pass), with Realtime `comment_changed` added later as an enhancement.
- **Hard exclusions:** any graph mutation; snapshots; publish.
- **Acceptance evidence:** SEC-32 to SEC-37 (viewer may comment; per-user read state; parentage and workspace consistency; no cross-user read-state writes); anchoring survives node-ID normalisation.
- **Why faster or safer:** validates RLS, parent-child consistency, and the multi-user model early, before the heavy lock work, without touching canonical graph state. This is the acceleration.

### Phase 3: graph mutation safety (the gate)
- **Objective:** make concurrent editing safe.
- **Included:** `scenario_edit_locks` and lock RPCs; `save_graph_guarded` replacing the direct `UPDATE`; optimistic concurrency; consistent attributed event logging for manual edits; CEE write paths moved onto the guarded RPC.
- **Hard exclusions:** the suggestion queue (waits for the consistent event log); any multi-user editing surface before the gate is proven.
- **Acceptance evidence:** lost-update prevented under two concurrent writers; stale `event_seq`/`graph_hash` rejected; manual edits appear in the event log with author (TEN-14).
- **Why this ordering:** this is the absolute graph-mutation gate; nothing graph-mutating ships before it.

### Phase 4: suggestion queue and review workflow
- **Objective:** non-host proposals and host acceptance.
- **Included:** `patch_suggestions`; ghost overlays (reusing `GhostOptionNode`); `propose_suggestion`; `accept_suggestion` as a guarded mutation; `reject_suggestion`.
- **Hard exclusions:** acceptance without the guarded-mutation contract; shipping before all three mutation sources share one attributed path.
- **Acceptance evidence:** SEC-38, SEC-39 (accept rejected under another valid lock or stale base); all three sources log consistently (TEN-14).
- **Why this ordering:** depends on Phase 3's lock and consistent event log.

### Phase 5: publish and brief approval
- **Objective:** snapshots, review mode, and external sharing.
- **Included:** `scenario_snapshots.workspace_id`; read-only canvas mode; reviewer mode; snapshot-scoped comments; `create_shared_brief` gated by `approver_flag`; public allowlist hardening; leak tests. Reuses the live `SharedBriefPage` and slug read.
- **Hard exclusions:** any public field outside the allowlist; publish without `approver_flag`.
- **Acceptance evidence:** public-brief leak tests pass (spec §16); snapshot immutability; `create_snapshot` editor-or-above.
- **Why this ordering:** builds on the comment and event-log surfaces; partial prior art reduces effort.

### P3 / post-MVP: future TAE and advanced collaboration
- **Objective:** future-proofing only.
- **Included (notes only):** estimate records, dissent logs, deliberation stages, calibration snapshots, contribution tracking, live cursors, workspace deletion, ownership transfer.
- **Hard exclusions:** any foundation-level TAE data structure in the MVP (Track A has zero TAE dependency).
- **Acceptance evidence:** none required for the MVP.
- **Why this ordering:** event-author attribution plus per-user privacy are the sufficient foundations; building TAE structures now would add cost with no MVP benefit.

---

## B6. Should the first slice include comments or snapshots?

This is the key challenge question. The current first slice is graph-mutation-free workspace and presence infrastructure.

**Recommendation: keep the literal first slice graph-mutation-free, and run comments (not snapshots) as the first parallel value track, starting as soon as the workspace foundation lands.**

Reasoning from evidence:

- **Comments deliver the earliest user-visible collaboration value** and validate the multi-user model (RLS, parent-child consistency, refetch) on a surface that never mutates the graph. The table is fully specified (v1.7 §12.1), the flag exists (`flags.ts:43`), and the inspector mount is ready (`PrimaryControlCard`, used by all nine panels).
- **Tenancy and RLS complexity is bounded and already specified.** `element_comments` and `element_comment_reads` carry server-derived immutable `workspace_id` through the parent-consistency invariant (v1.7 §9, §12.1); read state is per-user with a unique `(comment_id, user_id)` constraint and server-derived `user_id`.
- **The blast radius is small.** `element_comments` is greenfield (no shape conflict; the fresh name avoids the orphan `canvas_comments`, live-introspection env audit §3). It does not touch `scenarios.graph`, so it cannot trigger the last-write-wins hazard.
- **Genuine risks to flag (not blockers):** parent-child workspace consistency (handled by the composite-FK invariant); element-id anchoring surviving `nodeIdNormalisation` (`src/utils/nodeIdNormalisation.ts`) so comments stay attached across graph edits; stale views (handled by refetch-on-action, see the Challenge pass); viewer permissions (signed off, viewers may comment).
- **Snapshots and review links should not be pulled into the first slice.** Although `scenario_snapshots` exists and `SharedBriefPage` ships, review mode needs a read-only canvas mode (a separate medium-effort UI brief) and publish needs `approver_flag` plus allowlist hardening and leak tests. That is more surface and less incremental validation value than comments. Keep them sequenced (Phase 5), parallel-capable.

This threads the needle the brief asks for: it respects the locked graph-mutation-free first-slice decision (nothing overturned, because the literal first slice is unchanged and comments are graph-mutation-free) while answering the too-timid concern by surfacing collaboration value earlier than the design recommendations' step-4 placement.

---

## Challenge pass: could comments ship faster without Realtime?

This section is a specific test, not a restatement of B6. The strongest faster alternative is **comments-on-refetch**: element comments shipped as canonical Postgres state with explicit refetch-on-action, and no dependency on Realtime channel authorisation in the first comments iteration.

**Steelman of the faster alternative.** For a 2 to 5 person workspace, comment volume and concurrency are low. A user opens an element, sees the comments fetched from Postgres, posts or resolves one, and the client refetches that element's thread on the action and on focus. The other one to four members see the new comment the next time they open or refocus that element, or on a periodic light refetch. No broadcast, no presence, no channel authorisation is required for correctness. This removes the comments feature's dependency on the single hardest unproven piece of the substrate (B8): a working Supabase Realtime authorisation pattern, which does not exist anywhere in the repo today (live-code, high confidence).

Assessed directly against repo evidence:

- **Do comments need Realtime for v1?** No. Realtime is explicitly non-canonical by locked decision (spec §17); it carries awareness and notification only, and receivers always refetch canonical rows. So Realtime was never the source of truth for comments. Removing it from v1 changes only freshness, not correctness. (docs-only plus live-code, high)
- **Can `element_comments` be canonical-Postgres-only state?** Yes. The table, its RLS, the parent-consistency invariant, and the per-user read-state model are all specified without any Realtime dependency (v1.7 §9, §12.1). The app already reads canonical rows through the Supabase singleton (`src/lib/supabase.ts:49`) and refetches elsewhere; comments fit that pattern. (docs-only plus live-code, high)
- **Do create, resolve, and read-state work without broadcast or presence?** Yes. Create and resolve are RPC or RLS-guarded writes; read state is a per-user upsert. None requires a channel. Unread badges work from a per-user `element_comment_reads` count computed on fetch. (docs-only, high)
- **Does this reduce the dependency on the Realtime private-channel spike?** Yes, materially. The spike (B8) is the riskiest substrate item and has no in-repo precedent. Comments-on-refetch lets the first collaboration value ship while that spike proceeds in parallel, rather than blocking on it. (inferred from B8 evidence, high)
- **Does it raise RLS, UX, stale-view, or anchoring risk?** RLS risk: none added; the same policies apply. UX risk: a member may not see a brand-new comment until they refocus the element; mitigated by refetch-on-action, refetch-on-focus, and an optional light interval. Stale-view risk: bounded and self-healing on the next fetch; no canonical divergence because Postgres is the source of truth. Anchoring risk: unchanged; element-id anchoring through `nodeIdNormalisation` is required either way and is independent of Realtime.
- **What evidence would flip the recommendation?** Two things. First, a product requirement that comments must appear live (sub-second) for the pilot demo, which would make the freshness gap unacceptable and pull Realtime into the comments v1. Second, discovery that comment volume or co-editing concurrency is higher than the 2-to-5 assumption, making polling costly. Neither is supported by current evidence (the user base is tiny and stale, live-introspection env audit §2).
- **Is comments-on-refetch the fastest safe visible-collaboration-value track?** On the evidence, yes. It delivers real multi-user value with the smallest dependency set, defers the riskiest substrate work, and adds no canonical-correctness risk.

**Conclusion: ship comments first as comments-on-refetch, then add Realtime `comment_changed` as a later, additive freshness enhancement.** The existing foundation-plus-Realtime-then-comments ordering does not survive as a hard dependency, because Realtime is non-canonical by design and comments need it only for freshness, not correctness. The Realtime substrate still lands in Phase 1 for presence; comments simply do not have to wait for it.

---

## Cross-surface reusability of collaboration primitives

The tenancy layer is canvas-agnostic: `workspace_id` attaches to `scenarios`, not to React Flow internals (live-code plus docs-only, high). But comments, presence, and suggestion anchoring, as currently specified, anchor to decision-graph node and edge ids. If the strategy board is still expected to share the same collaboration foundation, those primitives must not be built only for the decision graph and retrofitted later.

**Evidence note (honest):** there is no strategy-board surface in the repo today. A search of `src` and `docs` returns zero references to a strategy board, and there is no `surface_type` or `board_id` precedent (live-code, high confidence that it is absent). So this is a forward-looking design constraint grounded in Paul's stated expectation, not current code (classify: Paul-stated / inferred, medium confidence on the requirement itself).

**Recommended design constraint (state, do not implement).** When the comments, presence, and suggestion-anchoring implementation briefs are written, model anchors with enough generality for both the decision graph and a future strategy board, for example:

- a `surface_type` (or equivalent discriminator),
- a `scenario_id` or board-like parent reference,
- an `element_type`,
- an `element_id`,
- an optional snapshot reference,
- stable handling through node-ID or equivalent element-ID normalisation (`src/utils/nodeIdNormalisation.ts`).

This does not change the locked tenancy model and adds no MVP scope; it is an anchoring-schema generality recommendation so the collaboration primitives are surface-portable from the start. It pairs naturally with the comments brief (Phase 2), where the anchor schema is first defined.

---

## B7. Hidden pessimism (is the conservatism justified?)

| Conservative choice | Verdict | Reason |
|---|---|---|
| Deferring Yjs entirely | Justified | Declared but unimported (`package.json:117-118`); 2 to 5 users with single-host editing; locked decisions keep CRDT out of model semantics. Adds a sync server for no MVP benefit |
| No live cursors | Justified; revisit after presence ships | Focused-element indicators suffice for the MVP and avoid canvas re-render churn |
| No comments in the first slice | Overcautious as sequencing; revisit now via a parallel track | Comments are graph-mutation-free and independent of the lock; recommend the parallel comments-on-refetch track, not adding them to the literal first slice |
| Graph-mutation-free first slice | Justified; keep | Last-write-wins is live (`scenarioService.ts:152`); the gate is real |
| Owner/admin-only suggestion acceptance | Justified | Signed off; v1.7 also makes acceptance a guarded mutation. The earlier editor-accept nuance is removed |
| No workspace deletion | Justified for the MVP; revisit post-MVP | Irreversibility risk; forbidden by locked decision |
| No TAE structures | Justified | Track A has zero TAE dependency; event-author attribution is the sufficient foundation |
| Conversation-store choice deferred | Justified to defer the choice; de-risk early | The choice is a real blocker for the conversation brief, but should not block the rest. Confirm early whether `callV5Turn` writes `conversation_turns` (0 rows today), which decides read-switch versus new write wiring |

---

## B8. Hidden optimism (precise evidence needed before implementation)

| Optimistic area | Precise evidence needed |
|---|---|
| Realtime private-channel authorisation | A working Supabase Realtime authorisation (RLS-backed channel policy) pattern against `workspace_members`. None exists in-repo (live-code, high). Needs a spike plus the negative and revocation tests (SEC-25 to SEC-28) |
| Supabase RLS edge cases and SECURITY DEFINER recursion | The membership helpers (`is_workspace_member`, `is_workspace_role`) and recursion avoidance proven in rehearsal; no live workspace RLS exists yet |
| CEE service-role path coverage | That `append_turn_atomic`, `ensure_scenario_exists`, and `store_draft_graph` derive `workspace_id` server-side (including during the migration window). The RPCs are confirmed live (live-introspection, env audit §6), but their bodies live in `olumi-assistants-service`, not this repo. This is a cross-repo evidence gap and a hard blocker (readiness section) |
| Rehearsal environment | Provision a clone or fresh project; confirmed absent (live-introspection, env audit §2). A hard blocker before any destructive step |
| Migration rollback | A dry-run of the delta backfill and the pre-switch assertion gate, including CEE service-role writes (v1.7 §20) |
| Worktree and branch preservation | The collaboration docs lived only on local branches; PR #190 is now the durable home (branch inventory §4). Keep them there |
| Conversation projection | Confirm whether `callV5Turn` writes `conversation_turns` (0 rows today, surface recon §2.4). Decides read-switch versus new write wiring |
| Old teams / organisations / canvas tables | Orphan provenance is unknown (env audit §4, §9). Confirm which codebase created them before any decommission; the migration must not collide |
| CI and test coverage | The SEC/TEN matrix is specified but unimplemented, and CI install is currently broken (pnpm migration; project memory). A CI that cannot run the security and RLS matrix is itself a hard cutover blocker |

**Three of these are promoted from evidence-needed to hard migration and cutover blockers:** the CEE service-role verification (cross-repo), the rehearsal environment, and an executable security matrix (working CI). They are restated in the readiness section and in B10, not left only here.

---

## Readiness and blocker section (mirrors v1.7 §22 and §23)

The spec may be approved now. **Migration implementation and cutover are blocked until all of the following hold:**

1. Deployed `VITE_SUPABASE_URL` confirmed (environment identity gate).
2. Rehearsal Supabase environment provisioned or approved (none exists today).
3. CEE service-role workspace-resolution verified as a separate cross-repo workstream in `olumi-assistants-service`. This repo can specify the requirement but cannot prove it. Any brief touching migration, service-role writes, or tenancy cutover must include CEE verification or wait for that workstream.
4. The SEC/TEN security matrix executable in CI. A CI that cannot run the security and RLS matrix is a hard cutover blocker, not a documentation concern.

The first implementation brief (workspace foundation) and the Phase 2 comments track do not depend on items 2 to 4 and can proceed once item 1 and the Codex delta-check are clear, because they are graph-mutation-free and do not perform a tenancy cutover.

---

## B9. Implementation-brief readiness map

Ready-to-brief: yes / no / partial. Risk tier: T1 (highest) to T3.

| Brief | Ready now | Missing decisions | Missing evidence | Risk tier | Run relative to phases | Parallel | Notes |
|---|---|---|---|---|---|---|---|
| Workspace foundation | Partial | None major | Realtime authorisation pattern | T1 | Phase 1 (base) | No | Gates the MVP; design complete (spec §8) |
| Invite lifecycle | Partial | Email template and copy | Live `invitations` shape is a unified table (surface recon §6.4) | T2 | Phase 1 | Yes, after foundation | Harvest `send-team-invite` and `ManageTeamMembersModal` patterns |
| Private Realtime presence | Partial | Presence store shape | RLS-backed channel policy spike (none in-repo) | T1 | Phase 1 | Yes | Substrate lands first; awareness only |
| Comments | Yes | Cross-surface anchor schema | Element-id anchoring survival under normalisation | T2 | Phase 2 | Yes | Ship as comments-on-refetch first; flag exists; table specced (v1.7 §12.1) |
| Snapshots and review links | Partial | Read-only canvas mode scope | None major | T2 | Phase 5 | Yes, later | `scenario_snapshots` exists; needs `workspace_id` plus read-only mode |
| Conversation projection | No | Revive versus projection versus in-memory | Does `callV5Turn` write `conversation_turns`? | T1 | Deferred (own brief) | Yes | Per-user privacy; `conversation_turns` 0 rows today |
| Edit lock and guarded save | No | None (design complete) | OCC graph-hash mechanism proven | T1 | Phase 3 (gate) | No | Replaces last-write-wins; the absolute gate |
| Suggestion queue | No | None | Depends on lock plus consistent event log | T1 | Phase 4 | No | `accept_suggestion` guarded mutation (v1.7 §15.4) |
| Publish and brief approval | Partial | `approver_flag` model | Allowlist hardening and leak tests | T2 | Phase 5 | Yes | Partial prior art (`SharedBriefPage`, `create_shared_brief`) |
| Migration and cutover | No | Write-freeze versus dual-compatible path | CEE service-role resolution (cross-repo), rehearsal env, executable SEC/TEN | T1 (highest operational) | Phase 0 to Phase 3 boundary | No | Hard blockers; covers user and CEE service-role writes (v1.7 §20) |
| Public brief allowlist | Partial | `seed_used` / `response_hash` inclusion | Public-brief leak tests | T2 | Phase 5 | Yes | Never ids or PII; live `create_shared_brief` is the CEE variant (env audit §6) |

---

## B10. Final control recommendation (one decision)

**Keep the first slice graph-mutation-free, and run comments in parallel after the foundation lands, delivered first as comments-on-refetch.**

- This is the "keep first slice graph-mutation-free but run Y in parallel" option, with Y = comments.
- It overturns no locked decision. The literal first slice is unchanged; comments are graph-mutation-free; the absolute graph-mutation gate is untouched.
- It directly answers the too-timid concern: the plan is correctly cautious where it must be (graph mutation) and faster where it safely can be (comments, ahead of the lock gate, and without a hard Realtime dependency).
- It is a sequencing recommendation for Paul and ChatGPT to ratify, not a unilateral change.

Block migration implementation and cutover on the four hard gates in the readiness section. Do not exit Phase 0 on those gates before they are evidenced.

---

## Paul-side attention-risk note

This documentation and design track creates **no technical dependency** on the V5 golden journey or pilot-critical path. The work is documentation-only on an isolated PR branch with zero code, schema, or migration changes, and the design holds an absolute graph-mutation gate, so nothing here can alter the live V5 demo behaviour. The collaboration foundation can proceed safely as a parallel documentation and design track. The only real risk is reviewer attention and time, not a runtime or build dependency. No blocking issue was found.

---

## Locked-decision guardrails (confirmation)

This audit overturns none of the locked decisions: fresh workspace model; no legacy teams migration; per-user conversation and facts privacy; Realtime not canonical; no CRDT for graph semantics in the MVP; graph mutation requires lock plus guarded save plus optimistic concurrency plus event logging; accepted suggestions use the guarded-mutation contract; public channel names are not security; CEE service-role paths verify membership and derive workspace server-side; Track A has zero TAE dependency; the first implementation brief stays graph-mutation-free. The comments-as-parallel-track recommendation sits entirely within these.

---

## Appendix: evidence base and method

- **Specs read in full:** tenancy and collaboration migration spec v1.6 and v1.7 (PR #190 branch).
- **Audits read in full:** surface recon (`5c98a57c`), multi-user design recommendations (`2bf8b774`), environment and namespace verification (`22b8135e`), branch inventory; teams disposition and phase-0 referenced through surface recon §10 and the environment audit.
- **Live-code re-verification (staging head, 2026-06-16, high confidence):** last-write-wins `saveGraph` (`src/services/scenarioService.ts:152`) and the only logged path `apply_patch_and_log` (`:372`); no Supabase Realtime in the live tree (only SSE; the two `.channel` uses are in the unmounted `DecisionContext.tsx` and `useDecisionOptions.ts`); Yjs declared and unimported (`package.json:117-118`); `GhostOptionNode` present and wired (`src/canvas/nodes/GhostOptionNode.tsx`, `ReactFlowGraph.tsx`); greenfield (no `workspaces`, `workspace_members`, `workspace_invites`, `scenario_edit_locks`, `patch_suggestions`, `element_comments`, `element_comment_reads`, or `workspace_id` in `src/` or `supabase/migrations/`); conversation hydrated from `scenarios.thread` (`useScenario.ts:470-475`, `useConversation.ts:1448-1456`), the recent scenario-id-persistence commit did not change this; `PrimaryControlCard` mount used across the inspector panels; Supabase singleton (`src/lib/supabase.ts:49`); the `comments` flag (`src/flags.ts:43`, `isCommentsEnabled`); `SharedBriefPage` wired at `/brief/:slug` (`src/poc/AppPoC.tsx:44,913`); `main.tsx:108,206` mounts `AppPoC` (App.tsx is dead).
- **Live-introspection (environment and namespace audit, 2026-06-04):** the six V5 tables and their RLS/FORCE/grants; the three CEE service-role RPCs present live; `scenario_snapshots` 0 rows and immutable; orphan `canvas_*` and `organisations` tables with no repo provenance; no live `workspaces` namespace collision.
- **Cross-repo note:** the CEE service is `olumi-assistants-service`, a separate repository; its RPC bodies are not in this repo, so their workspace-resolution behaviour is a cross-repo verification item.
- **Method and constraints honoured:** read-only; no implementation; no code, schema, migration, prompt, package, lockfile, generated, test, config, or SQL changes; British English; sentence case; no em dashes. This audit adds exactly one file.

---

*End of acceleration architecture stress-test v1*
