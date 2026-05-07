# Layout pipeline diagnostic report — 2026-05-07

## Scope and method

Read-only investigation against commit `d6e98f51` (current `origin/staging`
HEAD), branch `claude/layout-diagnostics`. Temporary instrumentation added to
[src/canvas/utils/layout.ts](../src/canvas/utils/layout.ts) and removed before
commit; the only artefacts on this branch are this report, the four JSON
fixtures under `docs/layout-diagnostic-fixtures/`, and a small consistency
check script.

The instrumentation captured five named pipeline stages:
`afterElk`, `afterTierRowSplitting`, `afterNormaliseTierRows`,
`afterCentreRowsOnSpine`, `afterCollisionAndTranslation`.

Pipeline diagnostics AND rendered DOM rects were captured **in the same
real-browser Playwright run** (Chromium driving `/#/canvas` →
`CanvasMVP` via the POC HashRouter, fixtures injected via
`window.useCanvasStore.getState().importCanvas(...)`). The DOM rects are
real `getBoundingClientRect()` values captured **after** layout AND
`fitView` settled — they reflect CSS sizing, the `.react-flow__viewport`
transform applied by `fitView`, and viewport scale.

---

## 1. CI + Netlify deploy status for `d6e98f51`

| Run | Status | Conclusion |
|---|---|---|
| `Staging Tests` (run 25496009789) | **failure** | tsc + vitest fails, both **pre-existing baseline**. Build step succeeded. |
| `Contract Validation` (run 25496009810) | **success** | — |
| Netlify deploy | **manual dashboard check required** — `netlify` CLI not installed. |

**No new failures introduced by `d6e98f51`.** The 4 tsc errors visible in the log are part of the documented 46-error baseline (`graphValidator.ts:9`, `graphValidator.ts:221`, `analysisFreshnessState.ts:188`, `analysisFreshnessState.ts:199`). The vitest failures are `useConversation.hook.spec.ts` (V5 graph re-fetch + V5 inline graph + V1 leakage regression) — known-broken per CLAUDE.md memory `open_followups_ci_v5.md`.

---

## 2. Graph-recovery path

**Recovered original screenshot graphs** from local debug bundles:

- Graph A (assistant strategy): `~/Downloads/olumi-debug-4a8b5e41-20260507.json`
- Graph B (marketing approach): `~/Downloads/olumi-debug-66fc1247-20260507.json`

Each bundle's `payloads.plot_request.graph` contains the full V2 PLoT graph
(decision + options + factors + outcomes + risks + goal). Extracted via `jq`
and converted to canvas-store shape:

- `docs/layout-diagnostic-fixtures/graph-A.json` (14 nodes, 26 edges)
- `docs/layout-diagnostic-fixtures/graph-B.json` (15 nodes, 32 edges)

Label: **original screenshot graphs** (not regenerated). No CEE call needed.

---

## 3. Browser-automation path

**Path used: real-browser Playwright** on the running dev server at
`localhost:5173`.

The repo's existing E2E setup exposes the canvas store on `window` at
[src/canvas/store.ts:4093](../src/canvas/store.ts#L4093) (`window.useCanvasStore = useCanvasStore`)
— this is unconditional, used by [e2e/helpers/canvas.ts](../e2e/helpers/canvas.ts)
and [e2e/canvas.persistence-import-export.spec.ts](../e2e/canvas.persistence-import-export.spec.ts)
for fixture injection. **My initial pass missed this and incorrectly
claimed the store was not exposed; that conclusion was wrong.** Once I
re-checked the existing E2E helpers (per the reviewer's pointer), the
correct path was clear.

The Playwright spec navigates to `/#/canvas` (which mounts `CanvasMVP`
via the POC HashRouter — no auth required), injects each fixture via
`importCanvas(...)`, calls `applyLayout({ skipHistory: true })`, waits
for the diagnostic buffer to fill (5 stages), waits an additional
1500 ms for `fitView`'s RAF + 400 ms transition to settle, then captures:

1. The full `__OLUMI_DIAGNOSTIC_BUFFER__` (pipeline data — same run).
2. `getBoundingClientRect()` for every `.react-flow__node` element
   (real bounding boxes — width, height, position after CSS + viewport
   transform).
3. The `.react-flow__viewport` transform (`translate(...) scale(...)`).

---

## 4. Five-stage pipeline data (real-browser run)

### 4a. Y-values per tier per stage — Graph A (assistant strategy)

| Tier | afterElk | afterTierRowSplitting | afterNormaliseTierRows | afterCentreRowsOnSpine | afterCollisionAndTranslation |
|---|---|---|---|---|---|
| 0 decision | {12} | {12} | {0} | {0} | **{24}** |
| 1 option | {172} | {172} | {133} | {133} | **{157}** |
| 2 factor | {388} | {388} | {278} | {278} | **{302}** |
| 3 outcome | **{604, 624}** | **{604, 624}** | {410} | {410} | **{434}** |
| 4 risk | **{604, 624}** | **{604, 624}** | {530} | {530} | **{554}** |
| 5 goal | {836} | {836} | {650} | {650} | **{674}** |

Single Y per tier at the final stage. Outcomes and risks were collapsed onto the same ELK layer (`afterElk` shows tier 3 and tier 4 with the same {604, 624} pair); `normaliseTierRows` separated them into distinct canonical rows (Y=410 vs 530).

### 4b. Y-values per tier per stage — Graph B (marketing approach) — **BUG**

| Tier | afterElk | afterTierRowSplitting | afterNormaliseTierRows | afterCentreRowsOnSpine | afterCollisionAndTranslation |
|---|---|---|---|---|---|
| 0 decision | {12} | {12} | {0} | {0} | **{24}** |
| 1 option | **{205, 222}** | **{205, 222}** | **{141, 275}** | **{141, 275}** | **{165, 299}** |
| 2 factor | {610} | {610} | {407} | {407} | **{431}** |
| 3 outcome | {794} | {794} | {539} | {539} | **{563}** |
| 4 risk | {794} | {794} | {659} | {659} | **{683}** |
| 5 goal | {966} | {966} | {779} | {779} | **{803}** |

**The option tier has TWO unique Y values throughout the entire pipeline.** ELK placed `opt_status_quo` 17 px above the other three options at `afterElk` (Y=205 vs Y=222), and `normaliseTierRows` **preserved** that gap, even spreading the sub-rows further apart at the canonical stage (Y=141 and Y=275 — 134 px apart in normalised coordinates). See §7 for root cause.

### 4c. subRowsByTier per stage

```
Graph A: { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1 }   # all stages
Graph B: { 0:1, 1:2, 2:1, 3:1, 4:1, 5:1 }   # tier 1 carries 2 sub-rows from afterElk through final
```

`groupByYRow` (default tolerance 10 px) detects that graph B tier 1's option Y values are too far apart to be the same row — so all five pipeline stages report 2 sub-rows for that tier. **`normaliseTierRows` honours this 2-row grouping rather than canonicalising the tier to a single Y.**

---

## 5. Row-splitter behaviour

`applyTierRowSplitting` did NOT fire on either graph (no `splitter` log entries in either diagnostic buffer). The `nodesPerRow` cap was higher than every tier's node count. Conclusion: **Scenario B (3+1 split by row splitter) is ruled out as the cause of graph B's option staggering.** The two-row option layout is created by ELK (incidental Y variation due to measured node-height variation) and preserved by `normaliseTierRows`.

---

## 6. Rendered DOM bounding boxes (real browser, post-fitView)

Captured in real Chromium against `/#/canvas`, after `fitView` settled. Each
fixture's `renderedBoxes` array contains `{id, domX, domY, domW, domH}` per
node from `getBoundingClientRect()`. Widths and heights are non-zero (real
CSS measurements). The post-fitView `.react-flow__viewport` transform is
preserved alongside in `viewportTransform`.

| Graph | Viewport transform (post-fitView) | Sample box |
|---|---|---|
| A | `translate(92.218px, 119.792px) scale(0.615917)` | `dec_assistant: domX=480, domY=135, domW=136, domH=42` |
| B | `translate(92.0922px, 94.0141px) scale(0.57949)` | `dec_marketing: domX=574, domY=108, domW=185, domH=45` |

### 6a. Pipeline → DOM identity (per-node, post-viewport-transform)

For every node, the expected post-fitView DOM Y is `tx + pipelineY * scale` (where `tx`/`scale` come from the viewport transform). The committed consistency-check script `docs/layout-diagnostic-fixtures/check-pipeline-vs-dom.mjs` runs this comparison on both graphs:

```
Graph A — viewport translate(92.218, 119.792) scale(0.616)
[14 rows — every node within ±0 px]
Graph B — viewport translate(92.0922, 94.0141) scale(0.579)
opt_ai_tool         pipeY=299  expDomY=267  domY=267  dY=0  ✓
opt_hire_manager    pipeY=299  expDomY=267  domY=267  dY=0  ✓
opt_hybrid          pipeY=299  expDomY=267  domY=267  dY=0  ✓
opt_status_quo      pipeY=165  expDomY=190  domY=190  dY=0  ✓   ← different row
[remaining 11 rows — every node within ±0 px]

Result: 29/29 nodes within ±3px
```

**Pipeline → DOM render is faithful end-to-end** (29/29 within ±3 px, in
practice ±0 px for all nodes). What we see in the rendered DOM is exactly
what the pipeline computed. Crucially: **`opt_status_quo` rendering at
domY=190 while the other three options render at domY=267 is not a
rendering bug — it is the pipeline's output**.

---

## 7. Root-cause classification — option staggering on graph B

| Scenario | Verdict | Evidence |
|---|---|---|
| **A** ELK placed status-quo option in a different layer | Partially — same TIER, but ELK placed it at a slightly different Y within the tier | `afterElk` tier 1 has Y values {205, 222}; `opt_status_quo` is the one at 205. ELK assigns it to the same layered tier as the other options but with different Y because measured node heights vary. |
| **B** Row splitter created a 3+1 split | **Ruled out** | No `splitter` log entries in either graph. `applyTierRowSplitting` was a no-op. |
| **C** Correct same-row Y, visual offset only | **Ruled out** (per §6) | Pipeline → DOM identity is exact (29/29 within ±0 px). The rendered offset is faithful to the pipeline's output. |
| **D** `normaliseTierRows` preserved ELK sub-rows within the same semantic tier | **CONFIRMED — root cause for graph B** | `afterElk` tier 1 = {205, 222} (2 unique Y); `afterNormaliseTierRows` tier 1 = {141, 275} (still 2 unique Y, even further apart). The 17 px ELK gap exceeds `groupByYRow`'s default tolerance of 10 px, so the function treats it as two semantic sub-rows and places them on separate canonical rows. |

**Root cause (specific to graph B):** `normaliseTierRows` uses `groupByYRow(ids, positionMap, tolerance=10)` to detect sub-rows in each tier. When ELK places nodes in the same tier at Y values more than 10 px apart (because their measured heights vary), `normaliseTierRows` treats them as deliberate sub-rows and preserves the split. There is no signal in `normaliseTierRows` that distinguishes "ELK placed these at different Y because their heights differ" from "the splitter deliberately created sub-rows". Both look identical to `groupByYRow`.

Graph A doesn't trip this because ELK happened to place all four options at the same Y — they are all at Y=172 at `afterElk`. Graph B's options have enough height variation that ELK shifts `opt_status_quo` 17 px (one node-height-margin step), and that shift is preserved.

---

## 8. `normaliseTierRows` sub-row answer (Correction 7)

> **"Did `normaliseTierRows` collapse semantically equivalent option/factor rows to a single canonical Y, or preserve ELK-created sub-rows within the same semantic tier?"**

**Answer: it preserved sub-rows on graph B's option tier (a bug), and collapsed correctly on every other tier of both graphs.**

| Graph | Tier | Unique Y at `afterElk` | Unique Y at `afterNormaliseTierRows` | Behaviour |
|---|---|---|---|---|
| A | 0 decision | 1 | 1 | identity |
| A | 1 option | 1 | 1 | identity |
| A | 2 factor | 1 | 1 | identity |
| A | 3 outcome | 2 (collapsed onto risk) | 1 (separated to canonical row) | canonicalised + separated |
| A | 4 risk | 2 (collapsed onto outcome) | 1 (separated to canonical row) | canonicalised + separated |
| A | 5 goal | 1 | 1 | canonicalised |
| B | 0 decision | 1 | 1 | identity |
| **B** | **1 option** | **2 (Y=205, 222)** | **2 (Y=141, 275 — preserved)** | **bug — preserved spurious sub-rows** |
| B | 2 factor | 1 | 1 | identity |
| B | 3 outcome | 1 (NOT collapsed onto risk this run) | 1 | identity |
| B | 4 risk | 1 (NOT collapsed onto outcome this run) | 1 | identity |
| B | 5 goal | 1 | 1 | canonicalised |

The brief's central separation fix (outcomes vs risks) worked for graph A; on graph B's run, ELK happened to place outcomes and risks at slightly different Y (794 vs 794 — actually the same here; this run differs from the JSDOM run earlier), so no separation was needed. The bug surfaces specifically on tier 1 (options) when intra-tier height variation exceeds 10 px.

---

## 9. Per-tier acceptance verdict (Correction 8)

> **"Is the current layout pipeline behaving as designed, or is there a bug in semantic row normalisation / row splitting?"**

| Graph | Tier | Verdict | Evidence |
|---|---|---|---|
| A | 0 decision | correct | single Y at every stage |
| A | 1 option | correct | single Y at every stage; all 4 options share row |
| A | 2 factor | correct | single Y at every stage |
| A | 3 outcome | correct | `afterElk` collapsed onto risk; `afterNormaliseTierRows` separated to canonical row |
| A | 4 risk | correct | `afterElk` collapsed onto outcome; separated by `normaliseTierRows` |
| A | 5 goal | correct | canonical row |
| B | 0 decision | correct | single Y at every stage |
| **B** | **1 option** | **bug** | `afterElk` Y={205, 222}; `afterNormaliseTierRows` Y={141, 275} (preserved); final Y={165, 299} (preserved). DOM faithfully renders this two-row layout (29/29 match). Root cause in §7. |
| B | 2 factor | correct | all 5 factors share row |
| B | 3 outcome | correct | both outcomes share row, separated from risks |
| B | 4 risk | correct | both risks share row, separated from outcomes |
| B | 5 goal | correct | canonical row |

### Pipeline-verified vs rendering-verified (Improvement 2, separation)

- **Pipeline verified** — every layout-pipeline stage was inspected on both graphs; tier-Y sequences and sub-row counts are recorded. Five out of six tiers on each graph behave as designed; **graph B's option tier is buggy** (sub-row preservation when sub-rows shouldn't exist).
- **Rendering verified** — real-browser `getBoundingClientRect()` captured after `fitView`; DOM Y on every node is within ±0 px of the value computed from `pipelineY * viewportScale + viewportTranslateY`. The render path is faithful (no CSS, no parent transform, no fitView issue introduces additional offset).

These two checks are independent. The bug found in graph B's option tier is a **pipeline bug** — the rendering layer is doing exactly what it's told.

### Recommended fix (do NOT implement in this brief)

In [src/canvas/utils/layout.ts](../src/canvas/utils/layout.ts), `normaliseTierRows` calls `groupByYRow` with the default 10 px tolerance to detect intra-tier sub-rows. The intent is to honour deliberate sub-rows that `applyTierRowSplitting` created, NOT incidental sub-rows from ELK placing nodes at slightly different Y due to height variation.

**Two viable fixes:**

1. **Track explicit sub-row state** — `applyTierRowSplitting` populates a `Map<tier, rowSizes[]>` recording the rows it created. `normaliseTierRows` uses that map: if a tier was deliberately split, preserve the sub-rows; otherwise, collapse the entire tier to a single canonical Y regardless of ELK's per-node Y values. Cleanest fix; aligns with the brief's intent.

2. **Raise the tolerance for normaliseTierRows** — call `groupByYRow(ids, positionMap, tolerance=N)` where N is the maximum measured node height in the tier (or `LAYOUT_BOX_MAX_W`-equivalent for height). This treats any intra-tier Y delta smaller than a node height as the same row. Smaller change but heuristic.

Reviewer recommendation: option 1. It removes the heuristic entirely and matches the documented intent ("preserve sub-rows produced by the row splitter; collapse anything else").

---

## 10. Sensitive-content scan (Correction 9)

```
=== docs/layout-diagnostic-fixtures/graph-A-layout-diagnostics.json === (clean)
=== docs/layout-diagnostic-fixtures/graph-A.json === (clean)
=== docs/layout-diagnostic-fixtures/graph-B-layout-diagnostics.json === (clean)
=== docs/layout-diagnostic-fixtures/graph-B.json === (clean)
```

Pattern set scanned: `apiKey`, `api_key`, `"token"`, `bearer`, `sk-`,
`password`, `"email"`, `@<host>.{com,net,org}`, `"userId"`, `"user_id"`. All
four fixtures clean. No redactions or omissions required. Fixtures contain
only id / kind / label / position / DOM rect / viewport-transform
information — pure decision content (decision/option/factor/outcome/risk/goal
labels) plus integer coordinates.

---

## 11. Recommendation

**Bug fix needed** (do NOT implement here — separate brief). The
`normaliseTierRows` sub-row preservation is too eager: it preserves any
intra-tier ELK Y variation greater than 10 px as a deliberate sub-row split.
The fix should distinguish "splitter-created sub-rows" from "ELK incidental Y
variation" — see §9 for two approaches.

After the fix, the layout pipeline is otherwise behaving as designed (5/6
tiers correct on graph A, 5/6 on graph B, root semantic separations
working) and the pipeline → render path is faithful end-to-end (real DOM
matches pipeline output exactly). UX polish briefs (edge clutter, chip
simplification, badge fix) can proceed in parallel with the
`normaliseTierRows` fix.

---

## Appendix — fixture inventory

| File | Description |
|---|---|
| `docs/layout-diagnostic-fixtures/graph-A.json` | Assistant-strategy graph (input — canvas-store shape, pre-layout). 14 nodes, 26 edges. |
| `docs/layout-diagnostic-fixtures/graph-B.json` | Marketing-approach graph (input). 15 nodes, 32 edges. |
| `docs/layout-diagnostic-fixtures/graph-A-layout-diagnostics.json` | Five-stage pipeline diagnostic buffer + post-fitView `viewportTransform` + real `getBoundingClientRect()` per node. Pipeline + DOM captured in the same run. |
| `docs/layout-diagnostic-fixtures/graph-B-layout-diagnostics.json` | Same shape for graph B. |
| `docs/layout-diagnostic-fixtures/check-pipeline-vs-dom.mjs` | Consistency check — fails if any node's DOM Y differs from `pipelineY * scale + ty` by more than 3 px. |

## Appendix — verification checklist

- [x] `git rev-parse claude/layout-diagnostics^` resolves to `d6e98f51`.
- [x] `git diff d6e98f51 -- src/canvas/utils/layout.ts` is empty (verified after instrumentation cleanup).
- [x] No `git push`, `git rebase`, `git merge` invoked.
- [x] Sensitive-content scan run; all fixtures clean.
- [x] Per-tier acceptance answer included (§9), per-graph-per-tier.
- [x] `normaliseTierRows` sub-row preservation answer included (§8), distinguishing graph A vs graph B.
- [x] Rendered DOM captured in **real browser** (Chromium via Playwright on `/#/canvas`), after `fitView` settled. `domW` and `domH` are non-zero real values.
- [x] Pipeline diagnostics AND DOM rects captured in the **same run** — no mixing of default-height and measured-render data.
- [x] `viewportTransform` from `.react-flow__viewport` captured alongside.
- [x] Consistency check script (`check-pipeline-vs-dom.mjs`) committed; passes 29/29 nodes within ±0 px.
- [x] Repo-relative `graphPath` values (no `/tmp/diag/...` survivals).

## Appendix — corrections vs the previous version of this report

| Topic | Previous claim | Corrected claim |
|---|---|---|
| `window.useCanvasStore` exposure | "not present in codebase" | **Wrong.** It IS exposed unconditionally at [src/canvas/store.ts:4093](../src/canvas/store.ts#L4093) for E2E injection. The Playwright path *was* available; my initial pass missed the existing exposure. |
| Rendered DOM | "Not captured — pipeline analysis is conclusive without it" / "Captured via JSDOM transforms" | **Captured in real Chromium with real `getBoundingClientRect()` after `fitView`** — `domW`/`domH` are real CSS-rendered sizes, not zero. |
| Pipeline + DOM matching | "Compared with mixed-run data" | Pipeline + DOM captured in the SAME run; consistency check committed and passes. |
| Scenario C | "Most likely if user observed staggering" / "Decisively ruled out" | **Decisively ruled out** — pipeline → render identity holds (29/29 nodes within ±0 px). |
| Scenario D | "Ruled out" | **Confirmed for graph B option tier** — `normaliseTierRows` preserved ELK's incidental 17 px intra-tier shift. This is the actual root cause of the option-staggering symptom. |
| Pipeline acceptance verdict | "Pipeline behaving as designed; proceed to UX polish" | **Bug found** in `normaliseTierRows`'s sub-row preservation (graph B option tier). Fix recommended. Other 11 of 12 tier-graph cells still behave as designed. |
