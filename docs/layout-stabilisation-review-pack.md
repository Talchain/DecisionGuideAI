# Layout Stabilisation — Review Pack

Brief: deterministic semantic layout pipeline for the canvas. Replaces ELK's
DAG-based Y assignment with canonical tier rows, removes timer-based
`fitView`, gates layout invocation on React Flow's measurement completion,
and routes auto-trigger failures through the existing
`useLayoutProgressStore` retry banner.

This work shipped on the dedicated `claude/layout-stabilisation` branch to
avoid colliding with parallel agent work on `ws1/v5-receipts-and-freshness-hint`.

This review pack reflects four review rounds:
- **Brief D1–D6** plus the user's plan-time corrections (in original brief).
- **Round 1 post-D6 review** (P1.1, P1.2, P1.3, P1.4, P1.5, I1, I2, I3, I4).
- **Round 2 post-D6 review** (P0 mock failures, P1.1 real rejection test, P1.2
  effect-wiring tests, P1.3 orphan constant, P1.4 review-pack accuracy, I1
  surface failures, I2 type cleanup).
- **Round 3 post-await race review** (P0 mid-flight stale-commit guard for
  scoped requests).
- **Round 4 manual-call race review** (P0 generation-snapshot guard so the
  post-await check protects manual `applyLayout()` calls too, not only
  `applyLayout({ requestId })` paths).
- **Round 5 synchronous-claim hardening** (self-identified during
  thorough review: synchronous race window between the re-entry guard
  read and `set({ layoutInProgress: true })` — closed by claiming
  immediately after the guard, before any awaits).

---

## 1. Files changed

### New files
| Path | Purpose |
|---|---|
| `src/canvas/utils/nodeLayoutConstants.ts` | Single source of truth for dimensions, spacing, tier mapping, and the bounded fallback duration |
| `src/canvas/utils/measureLayoutGate.ts` | Pure gate logic for the measure-then-layout effect (extracted for unit testing; uses `MeasuredLookup` interface for clean typing) |
| `src/canvas/__tests__/applyLayout.lifecycle.spec.ts` | D2 lifecycle tests + P1.1 real rejection test |
| `src/canvas/__tests__/applyLayout.staleCommit.spec.ts` | Round-3 + Round-4 mid-flight supersession guards (post-await stale-commit + stale-rejection for scoped *and* manual calls). Isolated from `applyLayout.lifecycle.spec.ts` because vitest's module cache makes re-mocking the layout module unreliable after a previous test in the same file has loaded it. |
| `src/canvas/__tests__/layout.semantic.spec.ts` | D3 + D4 + D6 pipeline behaviour, including I.2 sub-row direct fixture |
| `src/canvas/__tests__/measureLayoutEffect.spec.tsx` | P1.2 effect-wiring tests for the measure-then-layout effect |
| `src/canvas/utils/__tests__/measureLayoutGate.spec.ts` | I.1 unit tests for measurement-gate decisions |
| `docs/layout-stabilisation-review-pack.md` | This document |

### Modified files
| Path | Change |
|---|---|
| `src/canvas/utils/layout.ts` | Imports new constants; old constants removed; new `normaliseTierRows` (exported), `centreRowsOnSpine`, `applyGlobalTranslation`; `applyTierRowSplitting` switched to exact-remainder distribution; `groupByYRow` made deterministic; edge filtering uses `unlockedIds` Set (I.3 perf); `applyUniformStride` deleted (subsumed by `centreRowsOnSpine`) |
| `src/canvas/nodes/BaseNode.tsx` | `MAX_NODE_W` → `NODE_CARD_MAX_W` |
| `src/canvas/nodes/OptionNode.tsx` | Comment updated |
| `src/canvas/nodes/__tests__/BaseNode.maxWidth.spec.tsx` | Test description updated |
| `src/canvas/__tests__/layout.spec.ts` | Imports new constants; references renamed |
| `src/canvas/__tests__/store.applyClarifierGraph.layoutFail.spec.ts` | Rewritten to verify the new contract: clarifier flips `pendingLayout=true` instead of calling `applyLayout` directly |
| `src/canvas/store.ts` | Removed `pendingFitView`/`setPendingFitView`. Added `pendingLayout`, `layoutInProgress`, `layoutVersion`, `layoutRequestId`, `setPendingLayout`. `applyLayout` gains `opts?: { skipHistory?, requestId? }`, has pre-await stale-request guard, re-entry guard, **post-await generation-snapshot guard** (Round 3 P0 + Round 4 P0 — protects both scoped and manual calls from mid-flight supersession), and clears `pendingLayout` in catch path only when the generation has not changed (P1.1 + Round 3/4 P0). Both clarifier paths now flip `setPendingLayout(true)` (P1.3) |
| `src/canvas/ReactFlowGraph.tsx` | Removed `pendingFitView` selector + 100 ms timer effect. Added measure-then-layout effect using `evaluateMeasurementGate` with `LAYOUT_MEASUREMENT_FALLBACK_MS` (P1.3 — no orphan); auto-trigger calls wrapped in `handleLayoutWithRecovery` so failures surface via `useLayoutProgressStore` (I1); added `layoutVersion` + `requestAnimationFrame` fitView effect (D5) |
| `src/canvas/utils/applyDraftResult.ts` | Replaced `handleLayoutWithRecovery(...)` with `setPendingLayout(true)` |
| `src/canvas/components/DraftChat.tsx` | Same |
| `src/canvas/conversation/utils/applyPatch.ts` | Same |
| `src/components/debug/PayloadLabTab.tsx` | Same (was setting `pendingFitView: true` directly + calling `applyLayout()`) |
| `src/canvas/utils/__tests__/applyDraftResult.spec.ts` | Mock renamed `setPendingFitView` → `setPendingLayout`. Added `setDraftCoaching` mock (was missing — caused 20 pre-existing failures). Failure-surfacing test rewritten to match new contract. |
| `src/canvas/conversation/utils/__tests__/applyPatch.v3Fields.spec.ts` | Mock renamed |
| `src/canvas/conversation/__tests__/autoApplyPatch.spec.ts` | Mock renamed; layout-trigger test asserts new `setPendingLayout(true)` contract |
| `src/adapters/plot/v2/__tests__/reconcile.patchAccept.spec.ts` | Mock renamed |

---

## 2. Constants cross-check

Every constant in `nodeLayoutConstants.ts`:

| Constant | Value | Defined | Consumed by | Orphan? |
|---|---|---|---|---|
| `NODE_LAYOUT_MIN_W` | 140 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.spec.ts`, `layout.semantic.spec.ts` | No |
| `NODE_CARD_MAX_W` | 320 | `nodeLayoutConstants.ts` | `layout.ts`, `BaseNode.tsx`, `OptionNode.tsx` (comment), `BaseNode.maxWidth.spec.tsx`, `layout.spec.ts`, `layout.semantic.spec.ts` | No |
| `LAYOUT_PADDING_X` | 24 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.spec.ts`, `layout.semantic.spec.ts` | No |
| `LAYOUT_PADDING_Y` | 16 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.spec.ts`, `layout.semantic.spec.ts` | No |
| `LAYOUT_BOX_MAX_W` | derived | `nodeLayoutConstants.ts` | `layout.semantic.spec.ts` | No |
| `LAYOUT_BOX_MIN_W` | derived | `nodeLayoutConstants.ts` | `layout.semantic.spec.ts` | No |
| `DEFAULT_NODE_HEIGHT` | 100 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.spec.ts`, `layout.semantic.spec.ts` | No |
| `MIN_GAP` | 30 | `nodeLayoutConstants.ts` | `layout.ts` | No |
| `COLLISION_GAP` | 20 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.semantic.spec.ts` | No |
| `CANVAS_MARGIN` | 24 | `nodeLayoutConstants.ts` | `layout.ts`, `layout.semantic.spec.ts` | No |
| `LAYOUT_MEASUREMENT_FALLBACK_MS` | 500 | `nodeLayoutConstants.ts` | `ReactFlowGraph.tsx`, `measureLayoutEffect.spec.tsx` | No |
| `TIER_BY_KIND` | mapping | `nodeLayoutConstants.ts` | `layout.ts`, `layout.semantic.spec.ts` | No |

All 12 constants consumed. No orphans (P1.4 fix — round 1 had `LAYOUT_MEASUREMENT_FALLBACK_MS` defined but unused; this round wires it into ReactFlowGraph and the effect-wiring test).

`grep -rn 'pendingFitView\|setPendingFitView' src/` returns nothing.

`grep -rn 'MIN_NODE_W\|MAX_NODE_W\|sizePaddingX\|sizePaddingY' src/` returns nothing.

### Tier-number behaviour change

Pre-brief tiers had `outcome:3, risk:3, goal:4` — outcomes and risks shared a
row. The new tiers separate them (`outcome:3, risk:4, goal:5`). This is the
central semantic fix surfaced by `normaliseTierRows`.

---

## 3. Lifecycle sequence

```
┌─ Call site (applyDraftResult / DraftChat / applyPatch / clarifier preview /
│  clarifier finalize / PayloadLabTab debug)
│    │
│    ├─ pushHistory()                      [auto-trigger sites]
│    ├─ setState({ nodes: [...] })          [insert nodes at (0,0)]
│    └─ setPendingLayout(true)              [bumps layoutRequestId]
│
├─ React renders nodes → React Flow measures → nodeLookup populated
│
├─ ReactFlowGraph measure-then-layout effect:
│    │
│    │  evaluateMeasurementGate({ pendingLayout, layoutInProgress,
│    │     nodesInitialized, storeNodes, allUnlockedNodesMeasured })
│    │
│    ├─ 'idle'                → no-op
│    ├─ 'blocked'              → no-op (re-entry guard)
│    ├─ 'run-now'              → handleLayoutWithRecovery(applyLayout({skipHistory, requestId}))
│    └─ 'wait-with-fallback'   → setTimeout(LAYOUT_MEASUREMENT_FALLBACK_MS) →
│                                handleLayoutWithRecovery(applyLayout(...))
│
├─ handleLayoutWithRecovery wraps applyLayout (I1):
│    ├─ on success → useLayoutProgressStore goes idle
│    └─ on failure → useLayoutProgressStore.fail(retry) → retry banner shown
│
├─ Store.applyLayout(opts):
│    ├─ pre-await guard: if opts.requestId !== undefined &&
│    │                       opts.requestId !== layoutRequestId → return
│    ├─ re-entry guard + SYNCHRONOUS CLAIM:                  ← Round 5:
│    │    if (layoutInProgress) return                          claim runs
│    │    set({ layoutInProgress: true })                       in same tick
│    │                                                          as the guard,
│    │                                                          before any
│    │                                                          await — closes
│    │                                                          the dynamic-
│    │                                                          import race.
│    ├─ startGen = layoutRequestId             ← Round 4 P0: snapshot taken
│    │                                           for ALL calls (manual too).
│    ├─ try {
│    │    pushToHistory() [if !opts.skipHistory]
│    │    layoutGraph(...) [ELK → balanced split → normaliseTierRows
│    │                       → centreRowsOnSpine → applyCollisionGuard
│    │                       → applyGlobalTranslation]
│    │    if (layoutRequestId !== startGen) return    ← Round 3 + 4 P0:
│    │                                                  post-await stale-commit
│    │                                                  guard. Skip commit so
│    │                                                  the newer request's
│    │                                                  pendingLayout=true and
│    │                                                  inserted nodes survive.
│    │    set({ nodes, layoutVersion+1, pendingLayout:false })
│    │  } catch (err) {
│    │    if (layoutRequestId === startGen)            ← only clear if we are
│    │      set({ pendingLayout:false })                  still current
│    │    throw err
│    │  } finally {
│    │    set({ layoutInProgress: false })             ← always clears, even
│    │  }                                                if the dynamic
│    │                                                   import itself failed
│    │                                                   (Round 5 moved imports
│    │                                                   inside the try block)
│
└─ ReactFlowGraph layoutVersion effect:
     useEffect on layoutVersion → requestAnimationFrame(() => fitView(...))
```

**Timer policy.** No blind layout-settling timers. The single timer is the
`LAYOUT_MEASUREMENT_FALLBACK_MS` (500 ms) bounded measurement-failure
fallback. The legacy 100 ms `pendingFitView` `setTimeout` is removed.

**Race conditions.** Three layers of protection:

1. `layoutRequestId` (the **generation** counter) — bumped by every
   `setPendingLayout(true)`. Ensures a fast second draft arriving before
   the first is laid out is correctly superseded.
2. `layoutInProgress` claimed **synchronously** in the same tick as the
   re-entry-guard read (Round 5). Closes the synchronous race where two
   near-simultaneous calls could both pass the guard before the dynamic
   `await import('./utils/layout')` had given either a chance to set the
   flag.
3. **Post-await generation-snapshot guard** (Round 3 + Round 4 P0). A
   layout whose `await layoutGraph(...)` is suspended cannot commit stale
   `layoutedNodes` if the store mutated during the await. Applies to
   both `applyLayout({ requestId })` (auto-trigger) and `applyLayout()`
   (manual toolbar/command).

**Failure recovery.** `applyLayout` rejects → catch path sets
`pendingLayout: false` (P1.1) so the measurement effect doesn't retrigger;
`finally` clears `layoutInProgress`; the rejection propagates to
`handleLayoutWithRecovery`, which calls `useLayoutProgressStore.fail(retry)`
to surface the retry banner. Both manual and auto-triggered layouts now
share the same failure UX (I1).

---

## 4. Acceptance — actual test counts

**183 tests passing across 17 test files.** Run with:

```bash
npx vitest run \
  src/canvas/__tests__/layout.spec.ts \
  src/canvas/__tests__/layout.semantic.spec.ts \
  src/canvas/__tests__/layout.integration.spec.ts \
  src/canvas/__tests__/applyLayout.lifecycle.spec.ts \
  src/canvas/__tests__/applyLayout.staleCommit.spec.ts \
  src/canvas/__tests__/store.applyClarifierGraph.layoutFail.spec.ts \
  src/canvas/__tests__/measureLayoutEffect.spec.tsx \
  src/canvas/utils/__tests__/measureLayoutGate.spec.ts \
  src/canvas/utils/__tests__/applyDraftResult.spec.ts \
  src/canvas/conversation/utils/__tests__/applyPatch.v3Fields.spec.ts \
  src/canvas/conversation/__tests__/autoApplyPatch.spec.ts \
  src/adapters/plot/v2/__tests__/reconcile.patchAccept.spec.ts \
  src/canvas/layout/__tests__ \
  src/canvas/nodes/__tests__/BaseNode.maxWidth.spec.tsx
```

Per-file breakdown (verified):

| Test file | Count | Coverage |
|---|--:|---|
| `layout.spec.ts` | 25 | ELK pipeline integration; locked preservation; multi-row split; no-overlap; tier ordering |
| `layout.semantic.spec.ts` | 22 | Direct `normaliseTierRows` fixture (I.2 sub-row cumulative); pipeline tier monotonicity; outcome/risk/goal separated; sparse-tier no phantom gap; determinism; `groupByYRow` determinism; spine centring; balanced row splits; global translation; locked-node translation invariant; constants contract; end-to-end no-overlap |
| `layout.integration.spec.ts` | 4 | `applySimpleLayout` store wiring (existing) |
| `applyLayout.lifecycle.spec.ts` | 10 | `layoutVersion` increment, `pendingLayout` clearing, stale-request guard, `skipHistory`, history push, `setPendingLayout` setter contract, **P1.1 real rejection test (vi.doMock layoutGraph to reject)**, re-entry guard |
| `applyLayout.staleCommit.spec.ts` | 4 | Round-3/4/5 race protection: scoped stale-commit (data not lost, no layoutVersion bump, pendingLayout preserved), scoped stale-rejection (catch leaves pendingLayout=true), manual-call stale-commit (Round 4: `applyLayout()` with no requestId is also protected — generation snapshot taken for every call), **synchronous-call race** (Round 5: two back-to-back synchronous calls run `layoutGraph` exactly once and bump `layoutVersion` exactly once) |
| `store.applyClarifierGraph.layoutFail.spec.ts` | 2 | Clarifier preview + finalize both flip `setPendingLayout(true)` (P1.3) |
| `measureLayoutEffect.spec.tsx` | 6 | **P1.2 effect wiring**: incomplete-measurement holds, fallback timer fires, cleanup cancels timer, immediate run-now, re-entry guard, `layoutVersion` triggers RAF `fitView` exactly once |
| `measureLayoutGate.spec.ts` | 13 | I.1 unit: `evaluateMeasurementGate` for all 4 decision paths; `allUnlockedNodesMeasured` covering measured/missing/zero-width/zero-height/locked-skip; composed scenarios |
| `applyDraftResult.spec.ts` | 35 | All previous scenarios — mocks now include `setPendingLayout` and `setDraftCoaching` (P0 fix); failure-surfacing test rewritten to verify new deferral contract |
| `applyPatch.v3Fields.spec.ts` | varies | Mock renamed; tests pass |
| `autoApplyPatch.spec.ts` | 32 | Layout-trigger test rewritten to assert `setPendingLayout(true)` was called (P0 fix) |
| `reconcile.patchAccept.spec.ts` | varies | Mock renamed; tests pass |
| `layout/__tests__/handleLayoutWithRecovery.spec.ts` | 4 | Layout failure recovery (existing) |
| `layout/__tests__/layoutProgressStore.spec.ts` | 5 | Progress store (existing) |
| `layout/__tests__/runLayoutWithProgress.spec.ts` | 2 | (existing) |
| `layout/__tests__/grid.spec.ts` | 6 | Grid engine (existing) |
| `BaseNode.maxWidth.spec.tsx` | 5 | `NODE_CARD_MAX_W` fallback width contract |
| **Total** | **183** | All passing. |

The previously-failing `applyDraftResult.spec.ts` (21 failures pre-fix) and
`autoApplyPatch.spec.ts` (1 failure pre-fix) are now green.

---

## 5. Consistency check

**Typecheck.** Baseline (before these changes): 46 errors. After: 46 errors.
**Zero new typecheck errors introduced.** All 46 are pre-existing in
unrelated areas (`store.ts` typing issues from
ScenarioState/EdgeData/CEEGoalConstraint declarations — unchanged by this
brief).

**No phantom files.** Every test file referenced in §4 exists on disk and
runs in the targeted suite.

**No casts.** `measureLayoutGate.allUnlockedNodesMeasured` takes
`MeasuredLookup` (a minimal `{ get(id) }` interface). The call site in
`ReactFlowGraph.tsx` passes React Flow's `nodeLookup` directly with no
`as unknown as` cast (I2 fix).

---

## 6. Verdicts on the two review rounds

### Round 1 (post-D6)

| # | Issue | Verdict | Action |
|---|---|---|---|
| **P1.1** | `applyLayout` failure leaves `pendingLayout=true`, retriggers infinitely | **Valid** | `set({ pendingLayout:false })` in catch path. |
| **P1.2** | `pendingFitView` field still kept as vestigial state | **Valid** | Fully removed: field, setter, initial state, two clarifier writes, debug-bundle log, all five test mocks. |
| **P1.3** | Clarifier paths bypass measurement | **Valid** | Both preview + finalize branches now `setPendingLayout(true)`. |
| **P1.4** | 500 ms `setTimeout` violates "no timers" | **Reject** | User explicitly accepted in Correction 7 of original plan. |
| **P1.5** | Spine excludes goal | **Reject** | User explicitly required excluding goal in Correction 4. |
| **I.1** | No DOM tests for measurement effect | **Valid** | Pure gate logic extracted to `measureLayoutGate.ts`; 13 unit tests cover all 4 decision paths. (Round 2 P1.2 added the effect-wiring tests on top.) |
| **I.2** | `normaliseTierRows` private | **Valid** | Function exported; direct fixture test added. |
| **I.3** | `unlocked.some` repeated scans (O(E·V)) | **Valid** | Replaced with `unlockedIds: Set<string>`. |
| **I.4** | No review-pack docs | **Valid** | This document. |

### Round 3 (post-await race)

| # | Issue | Verdict | Action |
|---|---|---|---|
| **P0** | `applyLayout({ requestId })` re-checks rid only before `await layoutGraph` — during the await, store mutations + `setPendingLayout(true)` produce a newer rid; the in-flight request still commits stale `layoutedNodes` and clears `pendingLayout` | **Valid** | Added a post-await commit guard (`isCurrent()` re-check immediately before `set({ nodes })`) and a guarded catch path. Two tests in new `applyLayout.staleCommit.spec.ts` drive the race from inside the `layoutGraph` mock — one stale resolve, one stale rejection. |

### Round 4 (manual-call race)

| # | Issue | Verdict | Action |
|---|---|---|---|
| **P0** | The Round-3 `isCurrent()` short-circuited `true` when `opts.requestId === undefined`, leaving manual `applyLayout()` calls (toolbar, command palette) unprotected from mid-flight supersession | **Valid** | Replaced the requestId-based check with a generation snapshot (`startGen = get().layoutRequestId`) taken for **every** call. The post-await guard and catch guard now use `get().layoutRequestId === startGen` so manual layouts are protected too. Added a third test to `applyLayout.staleCommit.spec.ts` that drives the manual-call race (a CEE draft arriving while the user clicked "Re-layout"). |

### Round 5 (synchronous-claim hardening — self-identified)

Surfaced during a thorough self-review after Round 4. Not raised externally; included for completeness.

| # | Issue | Verdict | Action |
|---|---|---|---|
| **P1** | Re-entry guard read of `layoutInProgress` was followed by two `await import(...)` lines BEFORE `set({ layoutInProgress: true })`. A second synchronous `applyLayout()` call entering during the import yield would also pass the guard (flag still `false`), then both calls would push history, run `layoutGraph`, commit, and double-bump `layoutVersion`. Pre-existing behaviour — unrelated to the brief but clearly suboptimal. | **Valid** | Moved the `set({ layoutInProgress: true })` claim to the same synchronous tick as the guard read, before any await. Wrapped pushHistory and the dynamic imports inside the existing try block so the `finally` still clears `layoutInProgress` if the import itself fails. Added a regression test (`synchronous-race`) that fires two back-to-back synchronous `applyLayout()` calls and asserts `layoutGraph` ran once and `layoutVersion` bumped by 1. |

### Round 2 (post-Round-1)

| # | Issue | Verdict | Action |
|---|---|---|---|
| **P0** | `applyDraftResult.spec.ts` + `autoApplyPatch.spec.ts` fail (21+1 failures) | **Valid** | Mocks renamed `setPendingFitView` → `setPendingLayout`; `setDraftCoaching` mock added (was missing — root cause of 20 pre-existing failures); layout-trigger assertions updated to new contract. Both files now green. |
| **P1.1** | Lifecycle test only covers no-op + success | **Valid** | Added a real rejection test using `vi.doMock('../utils/layout', ...)` that returns a rejecting `layoutGraph`. Asserts `pendingLayout=false`, `layoutInProgress=false`, `layoutVersion` unchanged. |
| **P1.2** | No DOM/hook coverage of effect wiring | **Valid** | New `measureLayoutEffect.spec.tsx` with 6 tests covering: incomplete-measurement holds, fallback timer fires after `LAYOUT_MEASUREMENT_FALLBACK_MS`, cleanup cancels timer, immediate run-now, re-entry guard, `layoutVersion` → exactly-one RAF fitView. Uses `vi.useFakeTimers()` and mocked `@xyflow/react` hooks. |
| **P1.3** | `LAYOUT_MEASUREMENT_FALLBACK_MS` orphaned | **Valid** | Imported and used in `ReactFlowGraph.tsx` — replaces hardcoded `500`. Constants table above confirms zero orphans. |
| **P1.4** | Review-pack inaccuracies | **Valid** | This document: removed phantom `ReactFlowGraph.measureLayout.dom.spec.tsx` reference; test counts now reflect actually-run files (verified 182 passing across 17 files after Rounds 3/4); orphan claim now backed by the constants table. |
| **I1** | `void applyLayout(...)` swallows rejections | **Valid** | Auto-trigger calls now wrapped in `handleLayoutWithRecovery` — same failure routing as manual triggers. The `useLayoutProgressStore` retry banner surfaces auto-trigger failures the same way it already surfaces manual ones. |
| **I2** | `as unknown as Map<...>` cast | **Valid** | `measureLayoutGate.ts` defines `MeasuredLookup` (minimal `{ get(id) }`); `allUnlockedNodesMeasured` accepts it; call site passes `nodeLookup` directly without a cast. |

---

## 7. End-to-end verification

```bash
npm run typecheck                    # 46 errors (= baseline; zero new)
# Targeted suite (see §4):           # 183 passed (17 files)
grep -rn 'MIN_NODE_W\|MAX_NODE_W\|sizePaddingX\|sizePaddingY' src/   # (no matches)
grep -rn 'pendingFitView\|setPendingFitView' src/                     # (no matches)
```
