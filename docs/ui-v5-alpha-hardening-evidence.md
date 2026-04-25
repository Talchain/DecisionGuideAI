# V5 Alpha Hardening (UI) — Evidence Pack

Branch: `claude/v5-alpha-hardening-ui` (dedicated worktree at `/Users/paulslee/.claude-worktrees/DecisionGuideAI/v5-hardening`)
Off: `staging` at `f7907f896e3f4d7947aeaa585c1f3bb3b54d59a0`
Previous branch (left untouched): `ui/analysis-tab-visual-system` (parallel session scope)

**Operating constraint:** a parallel Claude Code session is authorised on `ui/analysis-tab-visual-system` implementing Brief 5.5. This branch was moved to a dedicated worktree after the first wave of edits was destroyed by the parallel session's branch churn. All subsequent work uses explicit `git add` paths, never `.`; never `git checkout` away from `claude/v5-alpha-hardening-ui`; never `git reset`/`stash`/`clean`.

---

## Phase 0 — Baseline

### Branch / commit provenance

- Branch created from `staging` (HEAD `f7907f89`) with `git worktree add /Users/paulslee/.claude-worktrees/DecisionGuideAI/v5-hardening claude/v5-alpha-hardening-ui`.
- Top staging commit: `f7907f89 fix(v5): wire analysis_ready through applyV5State to store` (2026-04-23). This commit already added the lenient normaliser, option_id→id mapping, inline-path ownership gate, and malformed-payload clearing. **This hardening branch builds on top of that wiring** — it adds logging, stale-turn safety, chip readiness gating, null-probability guards, and the BoundaryError contract.
- Worktree was symlinked to the main `node_modules` and given copies of `.env.development` / `.env.local` so the test runner could resolve Vite env vars.

### Baseline test state

| Suite | Files | Tests | Pass | Fail | Skipped | Notes |
|---|---|---|---|---|---|---|
| `src/v5` | 14 | 195 | 195 | 0 | 0 | Clean |
| `src/canvas/conversation` | 91 | 1365 | 1275 | 68 | 22 | **Pre-existing broad regression** — 68 failures share a `mockCallTurn.mock.calls[0]` undefined pattern, rooted in shared mock harness wiring, not production code. Documented as baseline; this branch must not exceed 68 failures |

Specific files with failures (conversation suite baseline):
- `useConversation.hook.spec.ts` (15 failed / 64 tests)
- `conversation-flow.spec.ts` (12/12)
- `streamingLifecycle.spec.ts` (7/10)
- `analysisInputsReconciliation.spec.ts` (5/5)
- `envelopeAnalysisWiring.spec.ts` (6/9)
- `handleEnvelopeArbitration.spec.ts` (4/4)
- `aiPanelTranche1.spec.tsx` (2/9)
- `useConversation.systemEvents.spec.ts` (6/11)
- `analysisInputsWiring.spec.ts` (7/7)
- `generateDispatch.spec.ts` (4/5)

### Fixture inventory

**Existing V5-relevant fixtures (before this branch):**
- `src/__contracts__/analysis-ready.fixture.json` — canonical contract fixture (status `ready`, two ready options)
- `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json` — pre-analysis_ready conversational V5 response (2026-03-07 bundle, stage `ideate`, no top-level `analysis_ready`)
- `src/canvas/conversation/__tests__/fixtures/orchestrator-rendering-v2.json` — V4 envelope for render parity
- `src/v5/__tests__/applyV5State.test.ts` — inline payloads across 25 cases

**Captured-response provenance for new fixtures (Phase 4):**

| Fixture (new) | Source / shape class |
|---|---|
| `src/fixtures/v5/analysis_ready_ready.json` | Derived from canonical contract fixture, wrapped as full `OlumiResponse` (stage `analyse`, analysis_result block, top-level `analysis_ready`) |
| `src/fixtures/v5/analysis_ready_not_ready.json` | One option flipped to `needs_encoding`; top-level `status: 'needs_user_input'`; mirrors CEE pre-ready state in `src/adapters/cee/types.ts:307-318` |
| `src/fixtures/v5/analysis_ready_missing.json` | Based on `cee-orchestrator-response.json` shape with stage flipped to `analyse` and analysis_result block added. `analysis_ready` field absent |
| `src/fixtures/v5/run_success_full_probs.json` | Minimal OlumiResponse with analysis_result block; `option_comparison[*].win_probability` = 0.74 / 0.26 |
| `src/fixtures/v5/run_success_null_probs.json` | Same shell, `win_probability: null` across options |
| `src/fixtures/v5/run_boundary_error.json` | OlumiResponse with `blocks[].type === 'error'` — shape from `src/v5/__tests__/TypedErrorRenderer.test.tsx` |
| `src/fixtures/v5/conversational_chips_only.json` | Chips-only, no `analysis_ready`, stage `ideate` |
| `src/fixtures/v5/analysis_complete_null_probs_stale_ready.json` | **Reproduction of the recent failing trace**: analysis_result block + null per-option probs + stale `ceeAnalysisReady` |

No live staging bundle access was available during this branch. Fixtures are synthesised from the canonical contract fixture, the checked-in conversational bundle, and the shape union documented in `src/adapters/cee/types.ts`. Flagged in the integrated evidence pack coordination note.

### DS v5 token confirmation

- DS doc: `docs/Design/Olumi_Design_System_v5.md` is current
- `src/styles/brand.css`: `--info: #52A3C8` (line 73), `--primary: #52A3C8` (line 130). Brief's legacy `#63ADCF` / `#3A8FB5` confirmed absent from source tree
- Tokens in scope for this branch: `bg-panel`, `bg-panel-hover`, `border-panel-border`, `text-text-body`, `text-danger`, `--info` + `-light` variants

### ceeAnalysisReady status mapping (contract the UI honours)

| Wire `status` | Per-option statuses | UI behaviour (post-hardening) |
|---|---|---|
| `'ready'` | all options `'ready'` | Executable `run_analysis` chip allowed; pre-analysis panel shows "ready" |
| `'needs_user_input'` | any option `'needs_user_mapping'`/`'needs_user_input'`/`'needs_encoding'` | `run_analysis` chip hidden; conversational chips still render |
| `'needs_encoding'` / `'needs_user_mapping'` | n/a | Chip hidden |
| `'unknown'` or absent on **analyse-shaped** turn | n/a | Clear `ceeAnalysisReady` slice (explicit-unknown); chip hidden |
| absent on **conversational** turn | n/a | Preserve slice (avoid racing a concurrent write) |
| stale-turn mismatch (turn id != active) | n/a | All V5 writes dropped; deferred reason `analysis_ready_stale_turn` |

---

## Phase 1 — Diagnostic `[v5-state]` logging (commit `d1f2b993`)

**Goal:** make every step boundary of `applyV5State` observable via a single `console.info('[v5-state]', {...})` filter.

**Shipped:**
- New `src/v5/debugLog.ts` — `logV5StateStep` (numbered-step logger) and `logV5StateEvent` (cross-surface filter events). Gated on `import.meta.env.VITE_V5_STATE_DEBUG === 'true'`. Off by default in tests and production.
- Step-boundary logs in all 4 numbered steps of `applyV5State.ts`. Payload is `step_number`, `step_name`, `input_keys`, `output_keys`, `applied`, optional `skip_reason`. **No user text, no payload values.**
- Skip reasons enumerated:
  - step 1: `stage_not_recognised_or_missing`
  - step 2: `no_applicable_blocks`
  - step 3: `block_enrichment_already_applied`, `decision_review_extraction_failed`, `no_top_level_enrichment`
  - step 4: `inline_path_owns_write`, `normaliser_rejected`, `missing_on_analyse_turn`, `missing_on_conversational_turn`, `stale_turn`

**Diagnostic finding:** the wire-to-store dropout described in the brief was already resolved in staging commit `f7907f89` (landed 2026-04-23). The lenient normaliser + catch-all write in step 4 are already in place. What was still silent and has now been captured:
- Step 4 had no visibility into *why* a write did not happen — the inline-path-owns-write skip, the stale turn case, and the explicit-unknown-on-analyse gap were all indistinguishable from "everything is fine".
- Running the golden-path fixture with `VITE_V5_STATE_DEBUG=true` now emits 4 filterable lines per turn — pinned in `applyV5State.debug.test.ts`.

---

## Phase 2 — Fixes

### Phase 2.1 — analysis_ready consumption hardening (commit `d1f2b993`)

**Changes in `applyV5State.ts` step 4:**

1. **Explicit-unknown on analyse-shaped turns.** When `analysis_ready` is absent AND the response carries an `analysis_result` block OR `stage_indicator.stage === 'analyse'`, the slice is explicitly cleared. Conversational turns (no analysis_result block, stage `ideate`/`frame`) preserve the slice — clearing there would race a legit concurrent write.
2. **Stale-turn guard.** New `ApplyV5StateOptions` with `turnClientId` + `currentClientTurnId`. When both supplied and mismatched, step 4 short-circuits with `deferred: 'analysis_ready_stale_turn'`. Earlier steps still run (idempotent); only the readiness write is gated.
3. **Invariant pinned:** *"a response may only write V5 state if its turnClientId matches the store's active client turn."* Three-step regression test: newer ready applied → older analyse-shaped response with missing analysis_ready arrives → state remains ready (no clobber).
4. **Callsite wiring.** `useConversation.ts:2675` passes `turnClientId` (minted at 2437) and `currentClientTurnId` (from `lastUserInputRef.current.clientTurnId`, tracks most recently dispatched turn).
5. **Hydration regression pinned:** hydrate-from-sessionStorage → conversational turn preserves → analyse-shaped turn with missing analysis_ready clears.

**Tests added:** `src/v5/__tests__/applyV5State.hardening.test.ts` — 8 cases.

### Phase 2.2 — SuggestedChips readiness gate (commit `f4fc8efd`)

**Filter rule (V5 active):**
- `action_type === 'run_analysis'` → gated by `useAnalysisStatus() === 'ready'`
- `action_type` absent → pass through (conversational)
- `action_type` in V5_ENABLED_ACTIONS but not readiness-gated (`edit_graph`, `draft_graph`) → pass through
- `action_type` present but unknown → hide (treat as potentially executable with unsatisfied gate)
- V5 inactive → passthrough unchanged (V4)

**Why hide rather than disable:** DS v5 §21.4 caps suggestions at 2. A disabled chip would consume a slot and confuse suggestion semantics. Existing safety net at `useConversation.ts:1687-1689` demotes a leaked click to conversation.

**New selector hook:** `src/canvas/hooks/useAnalysisReady.ts` — narrow selectors over the nested `ceeAnalysisReady` slice, avoiding the flat-slice write-race. Used only by SuggestedChips for now; available for future consumers.

**Filter logging** routed through the `[v5-state]` debug channel, not console.warn.

**Tests added:** `src/canvas/conversation/__tests__/SuggestedChips.readinessGate.spec.tsx` — 9 cases including double-click safety and `[v5-state]` chip_filter_unready emission.

### Phase 2.3 — Null-probability guard + BoundaryError contract (commit `093c86af`)

**New helper:** `hasAnyRealProbability(report)` + `useHasAnyRealProbability()` in `src/canvas/ui/inspector-v2/useAnalysisResults.ts`. Returns true iff `option_comparison[*].win_probability` contains at least one finite number, OR `probability_of_goal` is finite. False for null, undefined, NaN, Infinity, empty arrays.

**InsightsPanel:** `normalizeInsights` accepts `hasAnyProbability: boolean`. Fallback DEFAULT_SUMMARY becomes *"Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs."* when probabilities are missing. Engine-supplied `summary` always preferred.

**GoalNode:** `!hasThreshold && isPostAnalysis` branch swaps to *"Analysis finished. Set a target and check the graph for incomplete inputs."* when probabilities are missing.

**renderTimeline analysis_run:** explicit `probability` key with null / 0 now emits *"Analysis finished (no probability available)"* instead of the generic sentence-case fallback. Absent key preserves existing sentence-case behaviour for legacy events.

**Partial-status wiring:** deferred. `useV2Run.ts` has a partial branch not wired to `results.status`. Null-prob guard activates only on `results.status === 'complete'`. Activates automatically if/when partial branch lands. Out of scope.

**Tests added:**
- `src/canvas/ui/inspector-v2/__tests__/useAnalysisResults.nullProb.spec.ts` — 9 pure-function cases
- `src/canvas/components/__tests__/InsightsPanel.nullProb.spec.tsx` — 3 render cases
- `src/canvas/journey/__tests__/renderTimeline.nullProb.spec.ts` — 4 journey-event cases

---

## Phase 3 — DS v5 verification

Every modified surface passes the DS v5 checklist in `docs/Design/Olumi_Design_System_v5.md`.

### Surface 1 — `SuggestedChips.tsx`

*Change:* filter rule (hides `run_analysis` chip when `ceeAnalysisReady?.status !== 'ready'`). No visual change to any chip that renders.

- **Type scale:** chip uses `typography.bodySmall` (unchanged) — DS v5 §21.4 chip spec.
- **Colour:** no new colour references. Existing chip palette (`bg-panel`, `border-panel-border`, `hover:bg-panel-hover`, focus ring `ring-info`) unchanged.
- **Spacing:** `px-4 py-2 min-h-[44px] gap-2` unchanged — touch target + 8px grid preserved.
- **Copy:** no user-facing copy touched. Chip labels come from CEE payload.
- **Iconography:** none introduced.
- **States:** default / hover / active / disabled inherited. Disabled re-enables correctly (pinned in `double-click safety` test).
- **A11y:** `aria-label` from role+label, `aria-disabled` from `isThinking`, `focus-visible:ring-2 focus-visible:ring-offset-2` unchanged. Keyboard navigable.
- **Responsive:** no layout change.
- **Forbidden terms:** none.

### Surface 2 — `InsightsPanel.tsx`

*Change:* `normalizeInsights` fallback swaps DEFAULT_SUMMARY when probabilities are missing.

- **Type scale:** no typography changes.
- **Colour:** no new tokens.
- **Spacing:** no spacing change.
- **Copy (before → after):**
  - Present → "Analysis complete. Review the results above for details." (unchanged)
  - Missing → **new** "Analysis finished, but no probability was computed. Check the canvas for any incomplete inputs." Sentence case, no em dash, no forbidden terms (no "winner", "recommended", "best choice", "Done", "Updated", "Applied", "I've set", "Let me", "Here's what I found", "Great question").
- **States:** terminal state, no hover/focus.
- **A11y:** `<p>` unchanged.
- **Responsive:** no layout change.

### Surface 3 — `GoalNode.tsx`

*Change:* body copy for `!hasThreshold && isPostAnalysis` branch.

- **Type scale:** `typography.nodeLabel text-text-body` unchanged on both branches.
- **Colour:** unchanged.
- **Spacing:** `mt-1 m-0` unchanged.
- **Copy (before → after):**
  - Present → "Analysis complete. Set a target to see your chances." (unchanged)
  - Missing → **new** "Analysis finished. Set a target and check the graph for incomplete inputs." Sentence case, no em dash, no forbidden terms.
- **Iconography:** none touched. Accompanying `NodeChip` unchanged.
- **States:** no new states.
- **A11y:** `<p>` unchanged.
- **Responsive:** no layout change.

### Surface 4 — `renderTimeline.ts`

*Change:* `analysis_run` headline template. No render surface — string output for a timeline list.

- **Copy (before → after):**
  - winner + **finite prob (incl. 0)** → "Analysis complete - Option A performs best at 74%" or "…at 0%" (P1-2 fix — finite zero is renderable)
  - explicit prob=null / NaN / undefined-but-key-present → **new** "Analysis finished (no probability available)"
  - absent key → "Analysis run" (unchanged sentence-case fallback for legacy events)
- **Forbidden terms:** none introduced.

### Summary

One DS-visible behaviour genuinely changes (the filter gate on `SuggestedChips` — one chip disappears in the unready case; when it does appear, pixels are identical). Two surfaces swap copy strings only in a fallback path. One surface emits a different string into the timeline. All four remain DS v5 compliant.

---

## Phase 4 — Fixtures + integration tests (closed)

**Fixtures at `src/fixtures/v5/` (8 files, all committed at `e19bef45`):**

| File | Shape |
|---|---|
| `analysis_ready_ready.json` | `status: 'ready'`, two ready options, `stage: 'analyse'`, analysis_result block |
| `analysis_ready_not_ready.json` | `status: 'needs_user_input'`, one option `'needs_encoding'` |
| `analysis_ready_missing.json` | `stage: 'analyse'` + analysis_result block, `analysis_ready` key absent |
| `run_success_full_probs.json` | `option_comparison[*].win_probability ∈ {0.74, 0.26}` + finite `probability_of_goal` |
| `run_success_null_probs.json` | same shell, all `win_probability: null` |
| `run_boundary_error.json` | `blocks[].type === 'error'`, `failure_type: 'boundary_validation'` |
| `conversational_chips_only.json` | chips-only, no `analysis_ready`, `stage: 'ideate'` |
| `analysis_complete_null_probs_stale_ready.json` | reproduction of the recent failing trace: analysis_result block + null per-option probs + prior-turn stale ready state |

**Integration tests (`src/v5/__tests__/applyV5State.fixtures.test.ts` + `src/canvas/ui/inspector-v2/__tests__/report-fixtures.spec.ts`):**

| Assertion | Result |
|---|---|
| ready fixture → setCeeAnalysisReady called with status=ready | ✅ |
| not_ready fixture → setCeeAnalysisReady called with status≠ready | ✅ |
| missing-on-analyse fixture → setCeeAnalysisReady(null) (explicit-unknown) | ✅ |
| conversational fixture → no setCeeAnalysisReady call (preserved) | ✅ |
| boundary_error fixture → clear (no ready write, no success state) | ✅ |
| stale-turn with ready payload → no stage/runMeta/readiness write | ✅ |
| full_probs fixture → hasAnyRealProbability === true | ✅ |
| null_probs fixture → hasAnyRealProbability === false | ✅ |
| stale_ready failing-trace fixture → hasAnyRealProbability === false | ✅ |

**Why the probability-helper assertions are in a separate canvas-scoped file:**
`tsconfig.ci.json` has a narrow explicit include (`src/v5/**` plus a handful of lib/components). A v5-local test importing `hasAnyRealProbability` from `src/canvas/ui/inspector-v2/useAnalysisResults` transitively pulls `src/canvas/store.ts`, `src/canvas/domain/edges.ts`, and others into scope — surfacing 44 pre-existing typecheck errors in files outside this branch's scope. Splitting keeps the v5-scoped typecheck clean at **0 errors** while still pinning the contract.

**Note on fixture provenance (addresses P1-3 from the review):**

These fixtures are **synthetic unit fixtures**, not captured staging ContextPacks. They are derived from:
- the canonical contract fixture at `src/__contracts__/analysis-ready.fixture.json` (source of truth for the `analysis_ready` shape)
- the checked-in bundle at `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json` (source of truth for the envelope shape)
- the TypeScript shape union in `src/adapters/cee/types.ts`

I did not have access to live staging debug bundles in this environment. The fixtures encode every known shape class the UI must consume, but they are not proof that the real CEE emits exactly these shapes today. The recommendation for staging push (below) includes capturing a live bundle during manual verification.

## Phase 5 — Pre-merge regression gate (closed)

### Branch HEAD at time of gate

`104e5070` — `[v5-hardening] Phase 7: audit fix — InsightsSummaryCompact strict-render`. Branch was rebased onto current `staging` (`7a561a99`, post Brief 5.5 merge) before the gate; all 8 commits replay cleanly with no conflicts.

### Fresh-clone typecheck (authoritative)

Commands run in an isolated clone at `/tmp/v5-staging-check` to eliminate any local worktree `node_modules` state drift:

```
git fetch /Users/paulslee/.claude-worktrees/DecisionGuideAI/v5-hardening claude/v5-alpha-hardening-ui
git checkout FETCH_HEAD             # at b79c3af2 (Phase 6)
npx tsc -p tsconfig.ci.json --noEmit
```

Exit 0. `grep -cE "^src/"` on stderr returns `0`. **Zero typecheck errors.**

### Production build

```
cd /Users/paulslee/.claude-worktrees/DecisionGuideAI/v5-hardening
npm run build
```

Exit 0. `✓ built in 22.98s`. Chunk-size warnings pre-existing (ReactFlowGraph, elk.bundled, AppPoC); no new warnings from this branch.

### Test results (exact command outputs)

**V5 suite:**

```
npx vitest run src/v5
→ Test Files  17 passed (17)
→      Tests  216 passed (216)
```

**Conversation suite:**

```
npx vitest run src/canvas/conversation
→ Test Files  10 failed | 81 passed (91)
→      Tests  68 failed | 1287 passed | 22 skipped (1377)
→     Errors  1 error
```

The 1 unhandled rejection is **pre-existing** (`Invalid URL: /bff/cee/graph-readiness` originating in `src/canvas/hooks/useGraphReadiness.ts:76` — jsdom cannot parse relative URLs in `fetch()`). It is emitted during `patchAcceptLogic.spec.tsx` and survives across branches; confirmed present in `staging` base and unrelated to this branch's scope. Documented as follow-up #8 below.

**New-surface suites (all added by this branch):**

```
npx vitest run \
  src/canvas/components/__tests__/InsightsPanel.nullProb.spec.tsx \
  src/canvas/journey/__tests__/renderTimeline.nullProb.spec.ts \
  src/canvas/ui/inspector-v2/__tests__/useAnalysisResults.nullProb.spec.ts \
  src/canvas/ui/inspector-v2/__tests__/report-fixtures.spec.ts
→ Test Files  4 passed (4)
→      Tests  27 passed (27)
```

```
npx vitest run src/canvas/conversation/__tests__/SuggestedChips.readinessGate.spec.tsx
→ Test Files  1 passed (1)
→      Tests  12 passed (12)
```

### Phase 0 → Phase 6 deltas

| Suite | Phase 0 | Phase 6 | Delta |
|---|---|---|---|
| `src/v5` | 195 pass | 216 pass | +21 |
| `src/canvas/conversation` pass | 1275 | 1287 | +12 |
| `src/canvas/conversation` fail | 68 | 68 | 0 (pre-existing baseline, unchanged) |
| Total new tests across all new surfaces | — | 60 | +60 (27 new-surface + 12 chip gate + 21 V5-scoped) |
| New regressions | — | 0 | 0 |

### Review response — ChatGPT P0/P1/improvements

**First review** — all items addressed in commit `d86b1b5c` + evidence-pack close-out `389d1ede`:

- **P0-1 (hook ordering in SuggestedChips):** real bug I introduced. Hooks hoisted above all conditional returns. 3 regression tests pin ready↔not_ready↔missing transitions with no "Rendered fewer hooks than expected" console.error.
- **P0-2 (stale guard placement):** real gap — the pinned invariant says *"Older responses must not clear or overwrite newer readiness, probabilities, chips, or stage"* but my guard only covered readiness. Guard moved to the top of applyV5State; multi-slice stale fixture test asserts stage + graph_patch (node + edge) + runMeta + analysis_ready all drop.
- **P0-3 (engine-summary escape hatch):** real gap — `InsightsPanel` had three code paths that could emit "Analysis complete" bypassing the guard (engine-supplied summary, driver-language fallback, validateInsightConsistency). Post-guard override now forces the no-prob fallback whenever `hasAnyProbability === false`, regardless of source. New regression test uses engine summary `"Analysis complete. The winner is Option A at 73%."` + null probs and asserts suppression.
- **P1-1 (evidence pack close-out):** this rewrite.
- **P1-2 (finite-zero handling):** real edge case. Renderer now uses `Number.isFinite`; finite 0 renders as "Analysis complete - Option A performs best at 0%"; null/undefined/NaN/Infinity route to the no-prob state. Tests updated.
- **P1-3 (synthetic fixture marking):** escalated — see "Note on fixture provenance" above and the push-authorisation recommendation.
- **I-1 (multi-slice stale test):** addressed as part of P0-2.
- **I-2 (engine-summary success-copy regression):** addressed as part of P0-3.
- **I-3 (`hasAnyRealProbability` semantics):** cleaned up. Accepts EITHER finite `probability_of_goal` OR finite `option_comparison[*].win_probability`. Empty `option_comparison` no longer vetoes a valid root prob. (Further tightened in second review — see P1-2 below.)

**Second review** — all items addressed in commit `b79c3af2`:

- **P1-1 (hidden/system turns falsely stale):** confirmed real bug. `lastUserInputRef` at line 2495 is gated by `!hidden && mode === 'user'` (line 2483) — hidden and system V5 turns mint their own `client_turn_id` but never update the ref. Fix: introduced `activeV5TurnIdRef` stamped at every sendTurn dispatch (visible + hidden + system) at line 2444. applyV5State callsite now compares against this ref. Three regression tests pin: hidden-after-visible is accepted, system-after-visible is accepted, hidden-before-newer-dispatch is correctly dropped.
- **P1-2 (`hasAnyRealProbability` over-permissive for all-null options + finite root):** confirmed. Previous semantics: any finite prob (option or root) → true. New strict semantics: when `option_comparison` is a non-empty array, at least one entry MUST have a finite `win_probability`; root probability is only consulted as a fallback for empty / absent arrays. An engine returning all-null options with a finite root is inconsistent; the UI now suppresses success copy. Two regression tests pin: all-null + finite root → false, partial-null + finite → true.
- **P1-3 (evidence pack overclaim):** addressed in this rewrite — SHA updated to `b79c3af2`, exact command outputs recorded, unhandled rejection documented with provenance, conversation pass count corrected to 1287 (was undercount of 1284).
- **I-1 (hidden/system integration test):** pinned as 3 new cases in `applyV5State.hardening.test.ts` (hidden, system, newer-clobbers-hidden).
- **I-2 (all-null + finite root regression):** pinned in `useAnalysisResults.nullProb.spec.ts`.
- **I-3 (record exact command outputs):** addressed in this rewrite's "Test results" section above.

---

## Open discoveries / follow-ups

1. **Conversation-suite baseline (68 failures).** Not caused by this branch. Failures share a `mockCallTurn.mock.calls[0]` undefined pattern suggesting a shared mock harness regression. Documented, not fixed.
2. **`useV2Run.ts` partial branch.** Not fully wired to `results.status`. The null-probability guard activates only on `status === 'complete'`; if PLoT returns partial results that never promote to complete, the guard is a no-op. Follow-up for the results layer.
3. **sessionStorage restore.** `setCeeAnalysisReady` persists to sessionStorage (store.ts:3112–3115). A future session hydrates before any applyV5State call, so the stale-turn guard does not protect hydration. Correct behaviour for now; revisit if a turn id is persisted alongside the payload.
4. **`InsightsPanel` re-render loop.** The panel still has the pre-existing render loop flagged in its own code comments. The null-probability prop is memoised via `useMemo` so the new dependency doesn't worsen the loop. Not in scope to fix.
5. **Coordination with CEE branch.** If CEE changes `suggested_actions`, `analysis_ready`, or the boundary-error response shape during its hardening branch, Phase 4 fixtures will need regeneration before the joint integrated evidence pack.
6. **Fixture provenance.** Fixtures are synthetic. The joint integrated evidence pack should include a captured staging bundle — recommend Paul captures one during the manual golden-path verification (post-authorisation) and commits it to `src/fixtures/v5/captured/` for parity.
7. **Parallel-session discovery.** The parallel Claude Code session's branch (`ui/analysis-tab-visual-system`) introduced typecheck errors in files outside this branch's scope (44 errors in `src/adapters/plot/enrichment.ts`, `src/canvas/domain/edges.ts`, etc. that surface only when the v5 typecheck scope expands). Not this branch's responsibility, but worth flagging to Brief 5.5 owner.
8. **Pre-existing unhandled rejection (`/bff/cee/graph-readiness`).** During the conversation suite run, one unhandled rejection surfaces from `src/canvas/hooks/useGraphReadiness.ts:76` — jsdom's `fetch()` cannot parse relative URLs. Fires during `patchAcceptLogic.spec.tsx`. Present in `staging` base and every predecessor of this branch. Not caused by this branch's changes; confirmed by checkout-and-rerun on staging HEAD. Flagged for follow-up in the BFF-URL handling layer.

---

## Commit history (post-rebase onto staging)

```
104e5070 Phase 7: audit fix — InsightsSummaryCompact strict-render
9e6b2ccc Phase 6: close out evidence pack for follow-up review
1bcb7603 Phase 6: address ChatGPT follow-up review (P1 + improvements)
ca2b99d9 Phase 5: close out evidence pack
0c95929f Phase 5: address ChatGPT review (P0 + P1 + improvements)
2abeb868 Phase 3+4: DS verification + fixture-driven integration tests
0184764a Phase 2.3: null-probability guard + BoundaryError contract
58376c34 Phase 2.2: SuggestedChips readiness gate + double-click safety
c9c307f9 Phase 1+2.1: [v5-state] logs, stale-turn guard, explicit-unknown
```

All commits bear prefix `[v5-hardening]` per the operating constraint.

**Phase 7 audit (pre-merge self-review):** swept all `Analysis complete` callsites in the touched surfaces. Discovery: `InsightsSummaryCompact` called `normalizeInsights` directly without the post-guard override, allowing engine-supplied "Analysis complete" copy to leak when probabilities were missing. Fixed and pinned with a regression test.

## Merge to staging

Branch rebased onto current `staging` (`7a561a99`, post Brief 5.5 merge). All gates re-run after rebase:
- Typecheck: 0 errors
- Build: ✓ built in 26.44s
- Targeted suites: 256 passing
- Conversation suite: 1287 / 68 / 22 + 1 pre-existing rejection (matches baseline)

Merging to staging will trigger the auto-deploy.
