# Brief 5.4 — Phase 0 pre-flight findings

**Branch:** `ui/post-analysis-refinement` from `origin/staging` @ `ed6baa6b`  
**Date:** 2026-04-21  
**Scope:** Investigation only — no code edits. All paths verified by reading source files.

---

## Phase 0 gates — summary

| Gate | Decision |
|------|----------|
| P0.1 Data-source trace | **GO** — single hook, no structural data-flow changes in this brief |
| P0.2 Duplication map | **GO** — delete HeroSection.tsx + RecommendationSection.tsx (Phases 1–2); remove TippingPoints (Phase 1) |
| P0.3 Section headers | **GO** — SectionHeader.tsx shared component in use; audit only |
| P0.4 Card padding | **LOCK: `p-3` canonical for panel content cards** — DS v5 §2.2 panel density + explicit §6.4 examples; `px-4 py-3` for coaching accent blocks only |
| P0.5 Driver row density | **LOCK: `py-1.5 px-3` unchanged** — DS v5 §2.2 information-dense panel context |
| P0.6 Numbered badges | **LOCK: keep flat text** — ordinal rank badge semantics differ from count pill; see below |
| P0.7 Sticky footer | **LOCK: AnalysisFooter already sticky** — remove "Create decision brief" primary; promote "Rerun analysis" (Phase 11) |
| P0.8 Option colours | **LOCK: compliant** — no changes; documentation comment only (Phase 5) |
| P0.9 Top evidence card | **LOCK: remove TippingPoints** — deprecated, superseded by TornadoChart (Phase 1) |
| P0.10 Hero capitalisation | **GO** — audit DecisionConfidencePanel.tsx (Phase 14) |
| P0.11 Tornado drag reality check | **LOCK: remove Apply & rerun button** — copy rewrite to exploration-only (Phase 16) |
| P0.12 Semantic pill missing-axis rule | **LOCK: compliant** — no violations found; documentation comment only (Phase 15) |
| P0.13 Signal Registry audit | **BLOCKED** — doc not found on disk; see below |
| P0.14 Grep gates | **GO** — all 6 gates defined in Phase 17 |

**Open questions for Paul before Phase 3:** None — all decisions are deterministic from DS v5 or investigation below.

---

## 0.1 Data-source trace

| Component | Data entry point | Source |
|-----------|-----------------|--------|
| DecisionConfidencePanel | `data: ResultsSectionDataReturn` prop | `useResultsSectionData.ts` (2508 lines) |
| OptionCards | `options: OptionData[]` via `resultsSectionData.recommendation.allOptions` | Same hook |
| WinGauge | `shares: OptionWinShare[]` derived inline in ResultsBody | Same hook |
| DriversSection | `data: DriversSectionData` via `resultsSectionData.drivers` | Same hook |
| TornadoChart | `tornadoData` prop (separate from resultsSectionData) | `useResultsSectionData` + canvas store |
| ChallengeSection | `data` via `resultsSectionData.confidence` | Same hook |
| ResultsFooter | `stability`, `influencePct`, `confidenceTier`, `coachingReadiness` | Same hook |
| AnalysisFooter | `handleRunAnalysis`, `isRunning`, `canRunAnalysis` | OutputsDock state |

**Root composition:** `ResultsBody.tsx` (482 lines) receives `resultsSectionData` and passes slices to each section. `buildResultsVM.ts` (285 lines) derives `DecisionState` / hinge / evidenceLevel from the hook output.

---

## 0.2 Duplication map

| Component | Status | Action |
|-----------|--------|--------|
| HeroSection.tsx (1097 lines) | SUPPRESSED at ResultsBody.tsx:199 | DELETE in Phase 2 |
| RecommendationSection.tsx | SUPPRESSED — wraps HeroSection | DELETE in Phase 2 |
| TippingPoints.tsx | `@deprecated` in jsdoc — "Superseded by tornado flip indicator (Phase 3.4). Kept until tornado drag ships." | REMOVE from ResultsBody in Phase 1 |

No active render duplication between remaining components. DecisionConfidencePanel's condition card (flip-risk) and TornadoChart serve complementary roles:
- DCP condition card: actionable summary ("If X weakens, Y overtakes")
- TornadoChart: interactive exploration of full sensitivity space

TippingPoints showed flip-threshold tracks that duplicate TornadoChart's content — this IS the duplication. Removal is safe.

---

## 0.3 Section header hierarchy

| Section | Header pattern | Status |
|---------|---------------|--------|
| "Decision confidence" | DecisionConfidencePanel internal | No SectionHeader needed (full-width panel) |
| "Your options" | `<SectionHeader title="Your options" icon="option" />` | ✅ Uses shared component |
| Drivers accordion | `Accordion title="What's driving this" subtitle="..."` | ✅ Uses Accordion |
| Tornado accordion | `Accordion title="What could change the result"` | ✅ Uses Accordion |
| Challenge accordion | `Accordion title="Before you decide"` | ✅ Uses Accordion |
| Advanced accordion | `Accordion title="Advanced"` | ✅ Uses Accordion |

No raw `<h2>`/`<h3>` tags found outside SectionHeader/Accordion in ResultsBody. All major sections comply. Phase 9 is a no-op or single-comment commit.

---

## 0.4 Card padding — DS v5 citation

**Rule derived from DS v5:**

| Context | Correct padding | DS v5 citation |
|---------|----------------|---------------|
| Panel content cards (option cards, driver rows, accordion body, triage cards) | `p-3` (12px all sides) | §2.2 panel density paradigm; §6.4 code example `px-3 py-2` on panel card; line 1123 "Summary card: px-3 py-2" |
| Accordion/section headers | `px-3 py-2` (12px/8px) | §6.4 header density |
| Coaching/left-border accent blocks | `px-4 py-3` (16px/12px) | §6.4 examples lines 915, 999 |
| Standalone non-panel cards | `p-4` (16px) = §27.2 sm size | §27.2 table (does NOT apply to panel context) |

**Conclusion:** Current codebase `p-3` pattern is correct for panel content cards. §27.2's "sm=16px" generic table does not override the panel density principle established in §2.2. Phase 13 will add citations, not change padding values.

---

## 0.5 Driver row density

`DriversSection.tsx` grid layout: `grid-cols-[minmax(120px,1fr)_85px_85px_28px]` with `py-1.5 px-3` on rows.

DS v5 §2.2: "Panel and canvas contexts use 10–12px for information density." A tabular display of 4 fixed-width columns within a scrollable panel is precisely the information-dense context §2.2 describes. `py-1.5` (6px vertical) keeps rows scannable without scroll thrash.

**Lock:** No changes to driver row padding.

---

## 0.6 Numbered badges

| Location | Current style | Semantics |
|----------|--------------|-----------|
| Option rank badge | `#${rank} of ${totalOptions}` — plain text, `panelBody text-text-light` | Ordinal position (rank 1 = winner) |
| Accordion section badges | `rounded-full border bg-transparent px-1.5 py-0.5 min-w-[22px]` pill | Count of items in section |
| SectionHeader badges | Same rounded-full pill as Accordion | Count of items |

**Rationale for lock (keep flat text):** Rank badges and count pills carry different semantics. A `rounded-full` pill on the option card would read as a "status" or "count" badge, not an ordinal rank. The flat `#1 of 3` format is unambiguous. DS v5 does not mandate a specific shape for ordinal rank labels. Unifying would reduce semantic clarity.

**Lock:** Keep option rank badges as flat text. In the indeterminate state (Phase 6), the rank badge is simply hidden rather than switching to win%. No shape changes.

---

## 0.7 Sticky footer audit

Two footer components — different roles:

| Component | Location | Sticky? | Purpose |
|-----------|----------|---------|---------|
| `ResultsFooter.tsx` | Bottom of ResultsBody scroll | NO — inline `min-height: 56px` | Metadata row (stability · influence%) |
| `AnalysisFooter.tsx` | Outside ResultsBody, in OutputsDock | YES — `sticky bottom-0 z-10` | CTA buttons |

**AnalysisFooter current state (OutputsDock.tsx lines 1628–1650):**
- Primary: `confirmLabel` = "Create decision brief" (when `isConfirmProvisional`) → `window.alert('Decision confirmed. Decision brief coming soon.')` — NOT wired, placeholder only
- Secondary: "Rerun analysis" → `handleRunAnalysis`

**Phase 11 change:** Remove "Create decision brief" primary entirely. Promote "Rerun analysis" to sole primary button. Remove all variables that only exist for the dead CTA: `confirmLabel`, `isConfirmProvisional`, `confirmGapCount`, `confirmTitle`.

---

## 0.8 Option colour differentiation

**`WinGauge.tsx` palette (already DS v5 §3.3 compliant):**

| Rank | Determined colour | Token | Indeterminate colour |
|------|------------------|-------|---------------------|
| 1 (winner) | `var(--success)` | `border-2 border-success/60` | `var(--info)` |
| 2 (runner-up) | `var(--info)` | `border-2 border-info/60` | `var(--info-light)` |
| 3 | `var(--option)` | `border-2 border-option/60` | `var(--border-default)` |
| 4+ | `var(--border-default)` | `border border-panel-border` | same |

No violations. Phase 5 adds a documentation comment only.

---

## 0.9 TippingPoints vs DCP analysis

**TippingPoints.tsx jsdoc (lines 1–17):**
> `@deprecated Superseded by tornado flip indicator (Phase 3.4). Kept until tornado drag ships. Do not add new features here — migrate unique logic (user-unit formatting) into TornadoChart before removal.`

**Overlap confirmed:** TippingPoints shows factor-level flip thresholds (Mode A) or relative driver strength bars (Mode B). TornadoChart shows the same data with interactive drag affordance. The deprecation jsdoc explicitly names TornadoChart as the replacement.

**Lock:** Remove `<TippingPoints>` from ResultsBody.tsx in Phase 1. The `formatOutcomeValue` utility it references already exists and can be imported by TornadoChart if needed.

**Note on TippingPoints.tsx file itself:** After removing from ResultsBody, TippingPoints.tsx has no remaining consumers. The file should be deleted (or added to vitest exclude) in Phase 1 cleanup.

---

## 0.10 Hero capitalisation

**Active hero component:** DecisionConfidencePanel.tsx (671 lines) — imported directly by ResultsBody.

**Suppressed legacy components** (HeroSection.tsx, RecommendationSection.tsx) — their capitalisation is irrelevant as they render nothing.

**Phase 14 audit scope:** Read DecisionConfidencePanel.tsx for any title-case violations in user-visible strings. DS v5 §2.4: "Sentence case for all UI labels, headings, and section headers. Never all caps. Title case only for main navigation items."

---

## 0.11 Tornado drag reality check

**TornadoChart.tsx:**
- Line 51: `const PLOT_BOUNDS_WIRED = false` — constant, never changes at runtime
- "Apply & rerun" button: rendered conditionally on `hasUserDragged && PLOT_BOUNDS_WIRED` — meaning the button NEVER renders in production

**Current copy around drag:** Drag handles visible (3-line horizontal bars), cursor changes to `grab`/`grabbing`. No instruction copy found in the visible card — instruction is implicit from the drag handle affordance.

**Brief dormancy rule:** Do not show a disabled button or "coming soon" tooltip. If dormant, copy must reflect reality.

**Phase 16 change:**
1. Remove the `PLOT_BOUNDS_WIRED` conditional render block for the "Apply & rerun" button entirely
2. Add explicit instruction copy: `"Drag bars to explore — see how outcomes shift"` (exploration-only, no apply language)
3. Leave `PLOT_BOUNDS_WIRED = false` constant untouched

---

## 0.12 Semantic pill missing-axis rule

**Grep result:** All `rounded-full` elements in `src/components/results/` use `bg-transparent` (pills) or are progress-bar fills/legend dots — no filled semantic pills. Full compliance with DS v5 §7.2.

**TornadoChart factor-selector pill (line 714):** `border-panel-border bg-transparent` — outlined ✓. Contains text label (factor name) ✓ — axis label requirement satisfied.

**Phase 15:** Documentation comment only.

---

## 0.13 Signal Registry audit

**Status: BLOCKED — document not found on disk.**

Searched:
- `/Users/paulslee/Documents/GitHub/DecisionGuideAI/` (entire repo, all files)
- `/Users/paulslee/` (home directory)
- Pattern: `olumi-ai-architecture-v3-signal-registry-addendum-v3.md` + variations

Only references found:
- `docs/brief-5_3-preflight-findings.md` — cites "signal registry compliance" as a gate
- `docs/follow-ups/top-evidence-ia-dedup.md` — mentions "Signal Registry v3 work (not in scope for Brief 5)"

**Known signal allocations derived from codebase:**

| Signal | Source | Correct surface | Notes |
|--------|--------|-----------------|-------|
| `truth.structural_repairs` | `ceePipelineTrace.repair_summary` | Model tab | Moved in Brief 5.3 (ModelAdjustments.tsx) |
| `m1_coaching` items | `useResultsSectionData` → `confidence.*` | Results — DecisionConfidencePanel | Active |
| `robustness.fragile_edges` | `useResultsSectionData` → `confidence.*` | Results — ChallengeSection | Active |
| `robustness.*` stats | ResultsBody → AdvancedSection | Results — Advanced accordion | Expert-only |
| `m2_coaching` bias + pre-mortem | `useResultsSectionData` → `confidence.*` | Results — ChallengeSection | Active |
| `tornado_data` / `flip_thresholds` | `tornadoData` prop | Results — TornadoChart (replacing TippingPoints) | Phase 1 migration completes this |

**Recommendation:** Team should commit `olumi-ai-architecture-v3-signal-registry-addendum-v3.md` to `docs/` as part of this brief or the next. Current surface allocations can be derived from the findings above.

---

## 0.14 Grep gates (to be run in Phase 17)

All six gates defined in the Phase 17 section of the plan. Run after each implementation phase as a lightweight check.

---

## Phase 3 lock — technique hint path decision

**Investigation:** `DriversSection.tsx` technique chip logic (lines 494–498):
```typescript
const techniqueSuggestion = (() => {
  const influence = driver.influenceScore ?? driver.normalisedInfluence
  const conf = typeof driver.confidence === 'number' ? driver.confidence : null
  if (typeof influence !== 'number' || conf === null) return null
  return influence > 0.6 && conf < 0.5 ? 'Try: reference class forecasting' : null
})()
```

In a typical analysis with 3+ high-influence / low-confidence factors, this chip appears 2–3 times with identical text. That violates the "no duplicated identical copy" principle.

**Drivers array:** `visibleDrivers[0]` is already the top-ranked driver (sorted by influence descending). `displayDrivers = visibleDrivers.slice(0, 3)` are rendered by default.

**Lock — Path A:** Show technique chip on index 0 driver only (top-ranked). Pass `isTopDriver={index === 0}` from the `displayDrivers.map()` call in DriversSection. Inside `DriverRow`, gate the chip render: `{isTopDriver && techniqueSuggestion && ...}`.

No new technique strings invented. Existing `'Try: reference class forecasting'` string is retained unchanged.

**Test file to update:** `src/components/results/__tests__/DriversSection.techniqueChip.spec.tsx` — add test case asserting chip only on first driver, not second.

---

## Summary of implementation phases

| Phase | Task | Files changed |
|-------|------|--------------|
| 0 | This findings doc | `docs/brief-5_4-preflight-findings.md` |
| 1 | Remove TippingPoints from ResultsBody | `ResultsBody.tsx` |
| 2a | Migrate HeroSection re-exports | `OptionCards.tsx` + consumers |
| 2b | Delete HeroSection + RecommendationSection | `HeroSection.tsx` + `RecommendationSection.tsx` (deleted) |
| 3 | Technique hint top-driver-only (Path A) | `DriversSection.tsx` + test |
| 4 | Top evidence card unification (TriageCard audit) | `DecisionConfidencePanel.tsx` |
| 5 | Option colour doc comment | `WinGauge.tsx` |
| 6 | Remove win% from rank badge in indeterminate state | `OptionCards.tsx` |
| 7 | `winnerChipCopy` utility | new `utils/winnerChipCopy.ts` + `OptionCards.tsx` + `ResultsBody.tsx` |
| 8 | Typography audit — replace raw classes | Results components |
| 9 | Section header audit | `ResultsBody.tsx` (likely no-op) |
| 10 | Numbered badge review (keep flat per lock) | No-op or comment |
| 11 | Remove "Create decision brief"; promote "Rerun analysis" | `OutputsDock.tsx` + `AnalysisFooter.tsx` |
| 12 | Add `title` to icon-only buttons | DriversSection, ChallengeSection, AdvancedSection, ConfidenceSection |
| 13 | Card padding citations (no value changes) | Results components (comment-only) |
| 14 | Hero capitalisation audit | `DecisionConfidencePanel.tsx` |
| 15 | Semantic pill doc comment | `DecisionConfidencePanel.tsx` |
| 16 | Remove Apply & rerun; add exploration copy | `TornadoChart.tsx` |
| 17 | Grep gates + staging walkthrough template | `docs/brief-5_4-staging-walkthrough-template.md` |
