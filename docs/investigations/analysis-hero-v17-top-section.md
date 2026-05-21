# V17 Hero — Top-Section Investigation

**Date:** 2026-05-21
**Phase:** 0 (investigation only — no implementation)
**Flag:** `analysisHeroV17` remains off-by-default. No flag changes in this brief or its follow-on.
**Files modified by this brief:** zero source files; this report only.

## Scope recap

- **In scope:** refresh banner sizing/copy; "No inputs verified" header placement; result context structure; meta pills retention; Key question card retention/conditional render.
- **Out of scope:** everything below the Needs your input section; footer checks/CTA/Also-line; TriageActionCardsBody body content; V5 Phase 3 backend wiring.
- **Branch:** `claude/relaxed-dhawan-f108ba` (worktree off staging).

## Stop-condition results (all clear)

| Stop condition | Result |
|---|---|
| Refresh banner upstream of ResultsBody / shared with non-Analysis surfaces | **Clear.** `AnalysisOrphanBanner` is rendered inside `ResultsBody` and is V17+ only — legacy panel has no knowledge of it. |
| `factor_sensitivity.elasticity` not available per-option | **N/A — alternative path is safe.** Elasticity is decision-level (not per-option) in PLoT v2, but PLoT B1 emits `dominant_factor` directly on the response. Dominance is correctly framed as a decision property, not an option property — the proposed copy ("the result depends most on X") is grounded by this field. |
| Key question chips wired to state Paul does not want to lose | **Clear.** Chips fire `onPrefillChat` only (populate chat composer text). No state is persisted, no handler beyond prefill. Hiding the card loses no behaviour. |
| Meta pills have downstream test dependencies requiring broader refactor | **Bounded.** ~20 assertions across 3 V17-scoped test files. No tests outside the hero folder reference the pills. |
| Any change requires backend/CEE/PLoT/schema/prompt edits | **Clear.** All five changes are pure front-end. V5 Phase 3 substitution is forwards-compatible by design. |

---

## Task 1 — Refresh banner audit

### Current state

- **Component:** `src/components/results/AnalysisOrphanBanner.tsx`
- **Renders at:** `src/components/results/ResultsBody.tsx:219` (inside ResultsBody — not upstream)
- **Trigger:** `useAnalysisStateSource().showOrphanBanner === true` — true when canonical-analysis flag is ON and no `run_analysis` fact exists for the current scenario (`orphaned_plot_result` classification).
- **Scope confirmation:** V17+ Analysis surface only. The legacy `DecisionConfidencePanel` does not import or reference this banner. Safe to restyle.

Current markup (two stacked text lines + button):

```tsx
<div className="flex items-start gap-3 rounded-lg border border-panel-border bg-panel p-3">
  <div className="flex-1">
    <p className={`${typography.body} text-text-body`}>Analysis needs refresh</p>
    <p className={`${typography.bodySmall} text-text-light mt-1`}>
      Re-run analysis to attach AI explanations to these results.
    </p>
  </div>
  <button className="...min-h-[44px] bg-primary text-text-on-color" onClick={handleRunAnalysis}>
    Run analysis
  </button>
</div>
```

- Body line uses `typography.body` + `bodySmall` stack → ~64 px tall including padding.
- Action dispatcher: `useGuidanceStore._dispatchAction({ action_type: 'run_analysis', source: 'chip' })` — same path the suggested chips use.

### Recommendation

Collapse to a single-row strip using `panelMeta` typography:

```
Refresh analysis · Coaching may be out of date          [Run analysis]
```

- Title copy uses **"Refresh analysis"** rather than "Analysis needs refresh" — action-led phrasing.
- One `<p>` element with the dot-separator pattern already used elsewhere in the hero (`HeroFooter` uses the same `·` glyph).
- Body copy "Re-run analysis to attach AI explanations to these results." removed — its content is already implied by the title and CTA.
- Button keeps `min-h-[44px]` for touch target; visually it now matches the row height.
- Estimated height: ~64 px → ~36 px (–28 px / –44%).
- `role="status"` and `data-testid="analysis-orphan-banner"` preserved.

### Files affected

- `src/components/results/AnalysisOrphanBanner.tsx` — restyle markup, drop second `<p>`, change typography token.
- `src/components/results/__tests__/AnalysisOrphanBanner.spec.tsx` — update copy assertion (remove "Re-run analysis to attach AI explanations…" expectation; add `Refresh analysis` + `Coaching may be out of date` + dot-separator check).

---

## Task 2 — Header strip "No inputs verified" placement

### Current state

- **Component:** `src/components/results/analysisHeroV17/ReadinessColourStrip.tsx:22–25`
- **Source:** `buildAnalysisHeroViewModel.ts:437–453` (`checkedCount` field).
- Renders as a meta-line **right of the "Strengthen this decision" title**:

```tsx
<div className="flex items-baseline justify-between gap-2">
  <p className={typography.panelHeader}>Strengthen this decision</p>
  {checkedCount && <p className={typography.panelMeta}>{checkedCount}</p>}
</div>
```

Then the 4-segment fill bars render below, and a legend row repeats the dimension labels (Structure / Evidence / Coverage / Verified). The Verified segment's fill width = `confirmedFactorCount / totalFactorCount`, so the same count is encoded twice: once as the strip fill (geometric) and once as the text "No inputs verified" (literal). The legend label "Verified" appears a third time underneath the strip as a static word but does not duplicate the count.

### Recommendation

Remove the `checkedCount` text from the strip header entirely. Move the count to an accessible tooltip / `aria-label` on the Verified segment.

Concrete change:

1. In `ReadinessColourStrip.tsx`, drop the `{checkedCount && <p>…}` element.
2. On the Verified fill bar, extend the existing `title` attribute — for the Verified dimension specifically, append the literal count: `"Verified: 0% (No inputs verified)"` / `"Verified: 100% (3 inputs verified)"`. Other dimensions keep their unmodified `Label: NN%` tooltip.
3. The Verified segment gains a matching `aria-label` carrying the same composite text.
4. `buildAnalysisHeroViewModel.ts` retains `checkedCount` for the tooltip string; it is no longer rendered as visible text.

This honours Paul's preference ("Do not retain visible header text") while keeping the signal screen-reader and pointer-hover discoverable.

### Files affected

- `src/components/results/analysisHeroV17/ReadinessColourStrip.tsx` — remove visible label, augment Verified segment tooltip + aria-label.
- `src/components/results/analysisHeroV17/__tests__/buildAnalysisHeroViewModel.spec.ts` — keep `checkedCount` selector tests (the VM string is unchanged), but mark them as tooltip-text tests rather than visible-text tests. Update the `p1Fixes.spec.tsx` regex if it relied on rendered text.

---

## Task 3 — Result context: add "depends most on" line

### Data availability map

| Question | Finding |
|---|---|
| Which field produces the **result line** today? | `data.recommendation.recommendedOption.label` → "{label} currently leads." Fallback: "No option currently leads." (`buildResultLine` in `buildAnalysisHeroViewModel.ts:130`). |
| Which field produces the **reason line** today? | `data.confidence.topFragileEdge` (or `m1CoachingTopFragileEdge`). Format: "If {fromLabel} shifts, {alt} could come out ahead." Null when no fragile edge (`buildReasonLine`, line 142). |
| Is `factor_sensitivity.elasticity` available **per-option**? | **No.** `V2FactorSensitivity` has no `option_id` field. The `factor_sensitivity[]` array is a single global list across the analysis. |
| Is elasticity available for the **leading option specifically**? | Not per-option. But this is fine — see next row. |
| What confidence/threshold makes a single dominant factor safe? | PLoT B1 (already shipped) emits a top-level `dominant_factor: { factor_id, factor_label }` on `V2RunResponse`. UI currently consumes it at `useResultsSectionData.ts:1825–1850` with precedence: (1) PLoT `dominant_factor`, (2) M1 coaching `key_drivers.dominant_factor`, (3) legacy heuristic `detectDominantFactorLegacy` (UI-SEM-040, scheduled for removal). Heuristic uses `top1Influence > 0.5` AND `top1/top2 > 2:1`. |
| Recommended fallback when sparse/ambiguous | Omit the dependency clause entirely. Render only the result line. Never fabricate a factor name. **Legacy heuristic output is explicitly NOT a safe source — implementation must distinguish it from PLoT B1 / M1 sources and omit the dependency line when only the heuristic is available.** |

### Recommendation — structure

```
Hire a Tech Lead comes out ahead most often.
The result depends most on Technical Leadership Capacity.
```

Implementation in `buildAnalysisHeroViewModel.ts`:

1. **Update the result-line copy** from "{label} currently leads." → "{label} comes out ahead most often." This is the Olumi Communication Glossary's preferred phrasing (probabilistic, not categorical) and is already used in row reason copy ("could come out ahead").
2. **Add a second computed field** `dependencyLine: string | null`. Source from `data.recommendation.dominantFactor` (existing field surfaced from `useResultsSectionData`), restricted to PLoT B1 or M1 origins. If `dominantFactorLabel` is present and passes `safeInterpolatedLabel`, render:
   ```
   The result depends most on {label}.
   ```
   Otherwise return `null`.
3. **Move the flip-risk line** out of the Row-0 result context block. It is already mirrored in Row 1's reason copy (the fragile edge surfaces as the top input row when present). The result context becomes: result line + dependency line (when safe). The fragile narrative remains visible immediately below in the input rows.

#### `HeroResultContext.tsx` after change

```tsx
<section className="rounded-md border p-2.5 flex flex-col gap-1.5">
  <p className={typography.panelHeader}>{resultLine}</p>
  {dependencyLine && <p className={typography.panelBody}>{dependencyLine}</p>}
  {/* metaPills block removed — see Task 4 */}
</section>
```

#### Wording rationale

- "depends most on" is dependency framing, grounded by a measured field. "because" is causal framing and would over-claim against M1's current shape. When V5 Phase 3 ships `narrative_summary`, the dependency line can be replaced by the richer causal sentence without breaking the slot.
- The leading-option `label` is already passed through `safeLabel` (existing helper using `containsBannedTerm`). Apply the same guard to the dominant factor label.

### Files affected

- `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts` — change `buildResultLine` copy; add `selectDependencyLine` selector; export `dependencyLine: string | null` on `AnalysisHeroVM`.
- `src/components/results/analysisHeroV17/HeroResultContext.tsx` — render `dependencyLine` between result line and the now-removed pills.
- `src/components/results/analysisHeroV17/analysisHeroVM.types.ts` — add `dependencyLine` field to interface; reasonLine becomes redundant in result context but is kept on VM as a future slot for V5 Phase 3.

---

## Task 4 — Meta pills removal

### Current state

In `buildAnalysisHeroViewModel.ts:148–198`:

- **Stability pill** always emitted when `stability` is finite. Four bands → "Fragile result" / "Moderate stability" / "Stable result" or "Mostly stable" / "Highly stable".
- **Evidence pill** always emitted. Three tiers → "Evidence limited" / "Evidence moderate" / "Evidence adequate".
- **Reflect pill** emitted only when `state === 'reflect'`.

So in the typical case, the result context always renders **two pills** (stability + evidence). They contradict-feel because the user reads "Highly stable" and "Evidence limited" simultaneously — a classic "what does that mean?" pattern that the Footer checks already address with concrete checks ("Sensitive assumption", "Stability limited", etc.).

The Footer checks row (`HeroFooter.tsx`) is the existing home for these signals. Each state has 4 checks plus state-specific hints — stability and evidence are both represented there.

### Co-occurrence in real fixtures

Stability and evidence pills **always co-occur** when their inputs are defined. There is no guard suppressing either. The "Highly stable" + "Evidence limited" pairing is not a fixture artefact — it is the default for any analysis with high stability and a poor evidence tier.

### Downstream usage

- Pills are read by `HeroResultContext.tsx` only.
- ~13 assertions in `buildAnalysisHeroViewModel.spec.ts` lines 491–560, plus ~7 in `accessibility.spec.tsx`, plus 1 in `p1Fixes.spec.tsx`. No consumer outside the V17 hero folder reads the `metaPills` field.

### Recommendation — clean removal

Full removal, no zombie fields:

- Delete `MetaPill` type from `analysisHeroVM.types.ts`.
- Delete `metaPills` field from `AnalysisHeroVM`.
- Delete `selectMetaPills` selector from `buildAnalysisHeroViewModel.ts`.
- Delete pills block from `HeroResultContext.tsx`.
- Delete `META_PILL_CLASS` export from `tokens.ts`.

This is the largest single vertical-space win in the brief. Stability and evidence signals remain in `HeroFooter` checks below — no UX regression.

### Files affected

- `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts`
- `src/components/results/analysisHeroV17/analysisHeroVM.types.ts`
- `src/components/results/analysisHeroV17/HeroResultContext.tsx`
- `src/components/results/analysisHeroV17/tokens.ts`
- Test surface — see §8.

---

## Task 5 — Key question card: conditional render

### Source logic

`selectKeyQuestion` (`buildAnalysisHeroViewModel.ts:202–261`) has three branches:

1. **`state === 'strong'`** → returns `null` (card hidden).
2. **`data.confidence.m2DecisionQualityPrompts[0].question` present and glossary-safe** → returns the DQP verbatim plus up to 3 extras from `dqps.slice(1, 4)`.
3. **Fallback** → category-driven template keyed off `topRow.category`:
   - `evidence` / `causal` / `risk` → "How confident are you this estimate is realistic?"
   - `coverage` → "Are the alternatives genuinely different?"
   - `reflect` → "Could early preference for one route be influencing the framing?"
   - `ready` → null
4. **No safe template** → returns `null`.

Chips are always `['High', 'Some', 'Not sure', 'Add note']`. They fire `onPrefillChat(`${question} My answer: ${chip}`)` — chat-composer prefill only. No state is dispatched, no handler beyond prefill exists.

### Frequency

- `m2DecisionQualityPrompts` is populated by the V5 Phase 3 `decision_review` block, which is **not yet wired** on M1. Today, branch (2) virtually never fires; the card lands in branch (3) for almost every decision.
- The templated questions are by design generic ("How confident are you this estimate is realistic?") — same copy across every decision sharing the same `topRow.category`. Hence "templated, repetitive across decisions".

### Click-behaviour audit

The chips' only side effect is `onPrefillChat`. `onPrefillChat` reads from `useGuidanceStore.getState()._prefillChat(text)` which populates the chat composer text. Paul's "broken on click" report likely means:

- The composer is not visible (chat panel closed) — `chatPrefillAvailable === false`. In this case, `HeroKeyQuestion.tsx` already hides the chip strip (Fix 6, lines 38–55). The text "{question}" still renders but the chips disappear. From the user's perspective the card looks broken because the chips are advertised but cannot be clicked.
- Or the chip click does fire but visibly nothing happens because the composer is off-screen.

This is a UX failure mode rather than a wiring bug. The fix is to hide the **whole card** when chips cannot meaningfully complete their action, not just the chip strip.

### Recommendation

Tighten the conditional render. Card shows only when all three are true:

1. `data.confidence.m2DecisionQualityPrompts[0]` is genuinely present.
2. Question passes `containsBannedTerm` glossary check.
3. `chatPrefillAvailable === true`.

```ts
// in selectKeyQuestion
if (state === 'strong') return null

// 1. Real DQP path — only this path gets the card on M1
const dqp = data?.confidence?.m2DecisionQualityPrompts?.[0]?.question
if (dqp && !containsBannedTerm(dqp)) {
  return { text: dqp, extras: dqps.slice(1, 4), chips: [...] }
}

// 2. Template fallback — REMOVED (return null)
return null
```

- Branch (3) (the category template) is removed entirely. The card renders only when V5 Phase 3 supplies a real `decision_quality_prompts[0]`.
- When hidden on M1, the coaching intent already lives in Row 1's AI action prompt ("Help me check whether the [factor] estimate is realistic"). No regression — templated questions were already generic.
- When V5 Phase 3 ships, branch (1) fires automatically with real, decision-specific copy. No further code change.
- Additionally, in `HeroKeyQuestion.tsx`, if `chatPrefillAvailable === false`, return `null` — hide the entire card (not just the chip strip). This removes the "advertised but unclickable" failure mode.

#### Note on chip persistence

Chips do not write to any persistent state. They only call `_prefillChat`. Hiding them costs nothing.

### Files affected

- `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts` — drop the category-template branch in `selectKeyQuestion`. Replace with `return null` after the DQP branch.
- `src/components/results/analysisHeroV17/HeroKeyQuestion.tsx` — when `chatPrefillAvailable === false`, return `null` (hide entire card).
- Test surface — see §8.

---

## Proposed final top-section structure

```
[Banner — only when orphaned]
Refresh analysis · Coaching may be out of date              [Run analysis]

[Hero card]
Strengthen this decision                                       [Actions ▾]
[four-colour strip — Structure · Evidence · Coverage · Verified, count moved to tooltip]

Hire a Tech Lead comes out ahead most often.
The result depends most on Technical Leadership Capacity.

[Key question card — hidden on M1; renders when V5 Phase 3 supplies real DQP and chat is open]

Needs your input
Technical Leadership Capacity      High         ✦ 💬
Check this first. It could change the result.

[checks + CTA + Also-line]
```

---

## Vertical-height estimate

Approximate heights based on current DS v5 token sizes (1.5× line-height assumed, 12 px panelMeta, 14 px panelBody, 18 px panelHeader). Numbers are intentionally conservative.

| Block | Current | After |
|---|---:|---:|
| Refresh banner (when present) | ~64 px | ~36 px |
| ReadinessColourStrip header line | ~22 px (title + count) | ~22 px (title only, count in tooltip) |
| Result line | ~22 px | ~22 px |
| Reason line (when present) | ~22 px | 0 (moved/removed) |
| Meta pills row | ~28 px (with gap) | 0 |
| Dependency line | 0 | ~22 px (when data safe) |
| Key question card (typical M1) | ~84 px (question + chips + padding) | 0 (hidden until V5 P3) |
| **Total above "Needs your input"** | **~242 px (typical)** | **~102 px (typical)** |

**Net reduction: ~140 px above the input rows**, ~58% reduction in the top-block height. The cognitive load drop is larger than the pixel count suggests: two non-actionable text pills, a redundant header label, and a generic question card all vanish, leaving two grounded sentences ("X comes out ahead most often. The result depends most on Y.") above the input rows.

---

## V5 Phase 3 substitution notes (forwards-compatibility)

| Slot | M1 today (after this brief) | V5 Phase 3 substitution |
|---|---|---|
| Result line | "{label} comes out ahead most often." | Replace with `decision_review.narrative_summary.headline` when present; otherwise keep current copy. |
| Dependency line | "The result depends most on {dominantFactorLabel}." | Replace with `decision_review.narrative_summary.dependency_clause` (richer phrasing, may include direction/magnitude). |
| Reason line (currently surfaces in Row 1, not result context) | Fragile-edge templated copy | `decision_review.scenario_contexts[0].narrative` — drop the template entirely. |
| Key question card | Hidden | Renders automatically when `m2DecisionQualityPrompts[0]` is populated. No code change. |
| Meta pills | Removed | Replaced by structured evidence blocks in the existing Footer checks — no return of the pill UI. |
| Refresh banner | Same trigger; slimmer markup | Unchanged. |

Every slot is additive — no V5 Phase 3 field needs the M1 fallback removed before it can render. The V17 hero shape stays stable.

---

## Files affected — consolidated

| File | Change |
|---|---|
| `src/components/results/AnalysisOrphanBanner.tsx` | Collapse to single-row strip; drop second `<p>`; switch to `panelMeta` typography; change title to "Refresh analysis". |
| `src/components/results/analysisHeroV17/ReadinessColourStrip.tsx` | Remove visible `checkedCount` text; extend Verified segment tooltip + aria-label. |
| `src/components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts` | Update `buildResultLine` copy; add `selectDependencyLine`; remove `selectMetaPills`; drop category-template branch in `selectKeyQuestion`. |
| `src/components/results/analysisHeroV17/HeroResultContext.tsx` | Render `dependencyLine`; remove pills block. |
| `src/components/results/analysisHeroV17/HeroKeyQuestion.tsx` | Hide entire card when `chatPrefillAvailable === false`. |
| `src/components/results/analysisHeroV17/analysisHeroVM.types.ts` | Add `dependencyLine`; remove `metaPills` and `MetaPill`. |
| `src/components/results/analysisHeroV17/tokens.ts` | Remove `META_PILL_CLASS` export. |

**Reused existing utilities (no new code required):**

- `safeInterpolatedLabel` / `containsBannedTerm` — `analysisHeroV17/glossaryCheck.ts`
- `stripEncodingNotation` / `cleanFactorLabel` — `src/components/results/utils/cleanFactorLabel.ts`
- Dominant-factor selection — already wired in `useResultsSectionData.ts:1825–1850`; expose the existing `dominantFactor` field on `recommendation` for hero VM consumption.
- `_dispatchAction({ action_type: 'run_analysis', source: 'chip' })` — already used by `AnalysisOrphanBanner` and chip surfaces.
- Dot-separator glyph (`·`) — already used in `HeroFooter`.

---

## Tests to update / add

### Update (existing assertions to revise)

| File | Tests | Change |
|---|---|---|
| `src/components/results/__tests__/AnalysisOrphanBanner.spec.tsx` | `renders when canonical flag is on AND no V5 fact attached`; cross-scenario fact test | Replace "Re-run analysis to attach AI explanations to these results." expectation with "Refresh analysis" + dot-separator + "Coaching may be out of date" presence. Banner is one row. |
| `src/components/results/analysisHeroV17/__tests__/buildAnalysisHeroViewModel.spec.ts` lines 491–560 | All stability-band, evidence-tier, and "evidence thin" anti-drift tests | Delete tests asserting `metaPills` contents (entire `metaPills` selector removed). |
| `src/components/results/analysisHeroV17/__tests__/buildAnalysisHeroViewModel.spec.ts` lines 314–360 | "No inputs verified" / "1 input verified" / "N inputs verified" tests | Convert from "rendered text" expectation to "tooltip / aria-label text on Verified segment" expectation. |
| `src/components/results/analysisHeroV17/__tests__/buildAnalysisHeroViewModel.spec.ts` lines 363–448 | Key-question selection tests | Delete the category-template tests (`templates from top row for evidence category`, `risk-category top row → same factor/estimate template`). Keep the DQP-verbatim test and the banned-term-fallback test (latter now asserts the card is hidden when DQP fails the gate). Update `hides Key-question card when no DQP and no rows` to "hides Key-question card on M1 fallback (no DQP)". |
| `src/components/results/analysisHeroV17/__tests__/buildAnalysisHeroViewModel.spec.ts` lines 453–488 | Result line + reason line tests | Update result-line expectation to "{label} comes out ahead most often." Keep reason-line "fragile edge present → narrative" assertion but expect rendering in Row 1, not result context. |
| `src/components/results/analysisHeroV17/__tests__/accessibility.spec.tsx` lines ~185–230 | Stability label binding tests | Delete (pills no longer exist). The Fragile signal still surfaces via the Footer check. |
| `src/components/results/analysisHeroV17/__tests__/chatClosedRender.spec.tsx` | Chat-closed key-question test | Update to expect the entire card hidden (not just chips) when `chatPrefillAvailable === false`. |
| `src/components/results/analysisHeroV17/__tests__/p1Fixes.spec.tsx` | "No inputs verified" regex lock | Replace visible-text assertion with tooltip/aria-label assertion. |

### Add (new assertions)

| Coverage area | New test |
|---|---|
| Dependency line — happy path | Given `dominantFactor` from safe source (PLoT B1 or M1), hero renders "The result depends most on Technical Leadership Capacity." below the result line. |
| Dependency line — safe fallback | When `dominantFactor` is undefined, the dependency line is omitted (no fabricated factor name). |
| Dependency line — legacy heuristic excluded | When the only dominant-factor source is the legacy heuristic, the dependency line is omitted. |
| Dependency line — banned-term gate | When `dominantFactor.factor_label` contains a banned glossary term, dependency line is omitted. |
| Dependency line — encoding strip | When `factor_label = 'Tech Lead Capacity (0/1)'`, rendered text reads "Tech Lead Capacity" (encoding stripped via existing `stripEncodingNotation`). |
| Meta pills absent | The result context section never contains any element with the pill class or stability/evidence labels. |
| Key question card hidden on templated fallback | Given no `m2DecisionQualityPrompts`, the hero does not render any element with `data-testid="hero-v17-key-question-text"`. |
| Key question card hidden when chat closed | Given a real DQP but `chatPrefillAvailable === false`, the entire card is hidden. |
| Refresh banner scope | Banner only renders inside ResultsBody when `showOrphanBanner === true`. |
| Verified-count tooltip | The Verified segment in `ReadinessColourStrip` carries both percentage and literal count in its `title` and `aria-label`. |

---

## Acceptance criteria (Paul-verifiable on staging)

With `analysisHeroV17` flag ON and an orphaned-analysis fixture:

1. The refresh banner renders as a single row: `Refresh analysis · Coaching may be out of date` followed by a `Run analysis` button. No body copy line below the title.
2. The hero header reads "Strengthen this decision" with no "No inputs verified" text on the same row. Hovering the Verified segment of the strip shows the count in a tooltip.
3. Above the input rows, exactly two sentences render: a result line ending "...comes out ahead most often." and a dependency line of the form "The result depends most on {factor}." The dependency line is absent when no safe dominant-factor source is supplied.
4. No "Highly stable", "Evidence limited", "Stable result", "Mostly stable", "Fragile result", or other pill copy appears in the result context block. Footer checks below still surface stability and evidence signals.
5. The Key question card does not render in M1 fallback mode (templated questions removed). The card renders automatically when a real `decision_quality_prompts[0]` is provided via V5 Phase 3 fixture AND chat is open.
6. With chat panel closed (`chatPrefillAvailable === false`), the Key question card is fully hidden — neither chips nor question text appear.
7. Vertical height of the block above "Needs your input" drops by ≥ 100 px on a typical analysis (measured on a desktop viewport at default zoom).
8. All hero tests pass (`npx vitest run --changed --bail=1`). Glossary scanner test continues to pass against the dependency-line copy.
9. Typecheck passes (`npm run typecheck`).
10. Production flag default is unchanged (`analysisHeroV17` off-by-default).

---

## Verification (during implementation, not in this brief)

When the implementation brief is authorised:

```bash
# Tier 1 smoke (after the change)
npm run typecheck
npx vitest run --changed --bail=1

# Targeted vitest pass over hero tests
npx vitest run src/components/results/analysisHeroV17/__tests__ \
              src/components/results/__tests__/AnalysisOrphanBanner.spec.tsx \
              --reporter=verbose

# Visual verification (staging or local dev with flag on)
# 1. localStorage.setItem('feature.analysisHeroV17', 'true')
# 2. Load a scenario that produces an orphaned plot result and a normal result.
# 3. Confirm acceptance criteria 1–7.
```

---

# Implementation appendix (2026-05-21)

This appendix captures decisions made **during implementation** that diverge from estimates in the body of the report above. The body is preserved as written so the reasoning is traceable; this appendix is what future agents should rely on for current state.

## A1. Banner height: 44 px floor, not 36 px

Task 1 estimated the slim banner at ~36 px. The actual floor is **~46 px** (44 px button + ~2 px border). The 36 px estimate didn't account for WCAG 2.1 AA target size (44×44 px minimum), which is non-negotiable for the "Run analysis" button. Implementation drops container vertical padding entirely (`px-3` only) so the visible row floors at the button's `min-h-[44px]`. Visual reduction is still meaningful (was ~64 px → now ~46 px, –28 %) but smaller than the body of this report claims.

**Do not chase 36 px** without breaking the touch target — that path is closed.

## A2. Dependency-line dominance gate: rank-1 + ratio, not `normalisedInfluence >= 0.5`

Task 3 implied a simple corroboration via `normalisedInfluence` could suffice. It can't. `computeNormalisedInfluences` at `useResultsSectionData.ts:420–446` always pegs the top driver at `1.0` when any real elasticity exists ("top factor = 100%, others proportional"). A `>= 0.5` gate on the top driver is therefore trivially satisfied — it cannot detect ties.

Final implementation in `buildDependencyLine` (after review-feedback round 2):

1. `data.recommendation.dominantFactorId` + `dominantFactorLabel` populated.
2. Named factor IS the **rank-1 driver** in `data.drivers.drivers[]` (consistency check).
3. Dominance gate: prefer `influenceScore >= 0.5` (absolute ISL structural causal influence) when available; otherwise require `top1/top2 normalisedInfluence ratio >= 2.0` (the same 2:1 threshold the legacy heuristic uses, applied here as a guard, not a selector).
4. Glossary banned-term gate on the cleaned label.

The "safe alternative path" wording in Task 3 referred to the absence of the legacy heuristic in the `recommendation` source path. That's still true — but it does NOT guarantee dominance is real, only that the source isn't the worst-case heuristic. The ratio/`influenceScore` gates above are what actually protect against M1 emissions without confidence checks and tie cases.

## A3. Key question card: `reviewStatus === 'complete'` gate added

Task 5 listed three conditions for rendering the Key question card. A fourth was added during implementation: **`data.confidence.reviewStatus === 'complete'`**. Upstream selector at `useResultsSectionData.ts:2524–2532` exposes `m2DecisionQualityPrompts` without that gate (comment on line 2512 explicitly defers gating to consumers). Without the gate, partial / in-progress / stale prompts could surface. The new gate mirrors the one `m2NarrativeSummary` uses (line 1461).

## A4. Stop condition resolution (Task 3 stop condition)

The Task 3 stop condition asked: "stop if the UI cannot distinguish safe `dominant_factor` sources from legacy heuristic output without modifying `useResultsSectionData.ts`." The implementation resolves this by reading from `data.recommendation.dominantFactor*` rather than `data.drivers.dominantFactor*`. The `recommendation` aggregate is populated only from PLoT B1 or M1 `key_drivers` (see `useResultsSectionData.ts:1465–1476`) — the legacy heuristic only contaminates `data.drivers.dominantFactor*`, which the hero deliberately does NOT read. No modification to `useResultsSectionData.ts` was needed.

## A5. Vertical-height table revision

The body of this report estimates ~140 px reduction above the input rows. With the 44 px banner floor (A1) and the dependency line at ~22 px (only when data is safe), the actual reduction is closer to ~120 px in the typical M1 case. The qualitative argument stands — two non-actionable pills, a redundant header label, and a generic question card all vanish — but the precise pixel target should be measured in-browser, not predicted from the table at line 309.

