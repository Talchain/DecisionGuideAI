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
  - winner + prob present → "Analysis complete - Option A performs best at 74%" (unchanged)
  - explicit prob=null/0 → **new** "Analysis finished (no probability available)"
  - absent key → "Analysis run" (unchanged sentence-case fallback for legacy events)
- **Forbidden terms:** none introduced.

### Summary

One DS-visible behaviour genuinely changes (the filter gate on `SuggestedChips` — one chip disappears in the unready case; when it does appear, pixels are identical). Two surfaces swap copy strings only in a fallback path. One surface emits a different string into the timeline. All four remain DS v5 compliant.

---

## Phase 4 — Fixtures + integration tests (pending)

## Phase 5 — Pre-merge regression gate (pending)

---

## Open discoveries / follow-ups

1. **Conversation-suite baseline (68 failures).** Not caused by this branch. Failures share a `mockCallTurn.mock.calls[0]` undefined pattern suggesting a shared mock harness regression. Documented, not fixed.
2. **`useV2Run.ts` partial branch.** Not fully wired to `results.status`. The null-probability guard activates only on `status === 'complete'`; if PLoT returns partial results that never promote to complete, the guard is a no-op. Follow-up for the results layer.
3. **sessionStorage restore.** `setCeeAnalysisReady` persists to sessionStorage (store.ts:3112–3115). A future session hydrates before any applyV5State call, so the stale-turn guard does not protect hydration. Correct behaviour for now; revisit if a turn id is persisted alongside the payload.
4. **`InsightsPanel` re-render loop.** The panel still has the pre-existing render loop flagged in its own code comments. The null-probability prop is memoised via `useMemo` so the new dependency doesn't worsen the loop. Not in scope to fix.
5. **Coordination with CEE branch.** If CEE changes `suggested_actions`, `analysis_ready`, or the boundary-error response shape during its hardening branch, Phase 4 fixtures will need regeneration before the joint integrated evidence pack.
