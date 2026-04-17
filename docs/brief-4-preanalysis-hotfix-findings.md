# Brief 4 — Pre-analysis hotfix: pre-flight findings

**Branch:** `ui/analysis-tab-brief-4-preanalysis-hotfix` (from `origin/staging` @ `43d7125e`)
**Date:** 2026-04-17

Grounds the six-task surgical hotfix in verified code paths before any edit. Each finding locates the bug and documents the chosen fix approach including Paul's review corrections.

---

## Task 1 — ModelAdjustments header count

**File:** `src/canvas/components/pre-analysis/ModelAdjustments.tsx`

| Line | Code | Issue |
|---|---|---|
| 248 | `const grouped = groupAdjustments(adjustments)` | Collapses adjustments by `type ?? code`. N raw entries sharing a code → 1 grouped entry. |
| 249 | `const totalCount = grouped.length + repairActions.length` | Uses the collapsed grouped length. This is the line that makes the header under-report. |
| 254 | `if (totalCount === 1) { ... }` | Single-fix compact branch. `grouped[0]` renders one `AdjustmentRow`; still correct when `adjustments.length === 1` because `perItemDetails` carries the single entry. |
| 288 | `Olumi adjusted {totalCount} {totalCount === 1 ? 'factor' : 'factors'}` | Header copy; picks up the wrong count. |
| 298-300 | Expanded rows render from `grouped` (via `AdjustmentRow`), but each `GroupedAdjustment` carries `perItemDetails` which renders one row per raw adjustment when multiple share a code. | Expanded row count = `adjustments.length`; header currently = `grouped.length`. This is the mismatch. |

**Fix:** at line 249, replace `grouped.length` with `adjustments.length`. The single-fix branch at line 254 stays correct because `totalCount === 1` now means `adjustments.length === 1`, and the grouped collapse into `grouped[0]` still delivers the one row the user sees.

**Regression test (heterogeneous case per Paul's correction):** 2× `risk_coefficient_corrected` + 1× `factor_reclassified` (total 3 raw, 2 grouped entries). Header must read **"3 factors"**, expanded must show **3 rows** in total. Lock this as a snapshot.

---

## Task 5 — Improve confidence count mismatch

**File:** `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`

| Line | Code | Issue |
|---|---|---|
| 1116–1118 | `const improveConfidenceCount = 1 + improveConfidenceCards.length + (expertiseHasItems ? 1 : 0)` | Header count. The leading `1` is the always-on SuccessTarget row. |
| 1209 | `const improveActionable = improveConfidenceCards.length + (expertiseHasItems ? 1 : 0)` (used for dynamic top-card headline only) | This is for the top-of-panel headline, NOT the accordion subtitle. Different concern. |
| 1697 | `coachingLine={getImproveConfidenceCoachingLine(improveConfidenceCards.length + (expertiseHasItems ? 1 : 0))}` | Accordion coaching line — **this** is the one that disagrees with the header. Calls `getImproveConfidenceCoachingLine` with a count that omits the `+1` for the goal target. |

`getImproveConfidenceCoachingLine` (`src/canvas/components/pre-analysis/sectionCoaching.ts:52-55`) returns `null` for count ≤ 0 and `"N items could strengthen confidence."` otherwise.

`PreAnalysisData.isThresholdConfirmed` (hook `usePreAnalysisData.ts:261, 1405-1412`) tracks goal threshold confirmation via `goalNode.data.threshold_confirmed === true`. `isGoalConfirmed` is a separate flag at `:291, 1550`.

**Fix plan:** make the `+1` conditional on `!isThresholdConfirmed` in **both** header and subtitle. Apply consistently:
```ts
const includeGoal = data.isThresholdConfirmed ? 0 : 1
const improveConfidenceCount = includeGoal + improveConfidenceCards.length + (expertiseHasItems ? 1 : 0)
// ... at line 1697:
coachingLine={
  improveConfidenceCount === 0
    ? 'Your model looks well-calibrated.'
    : getImproveConfidenceCoachingLine(improveConfidenceCount)
}
```

**Zero-remaining edge case (Paul's correction):** when `improveConfidenceCount === 0` (threshold confirmed AND no cards AND no expertise items), render the complete-state message `"Your model looks well-calibrated."` as the coaching line. Header pill shows "(0)" — which is honest: the section renders for access to the goal target + expertise summary, but there are no actionable improvements. Alternative "hide coaching sentence entirely" is also acceptable; documented choice is **render the complete-state message**.

---

## Task 2 — Compact-variant subtitle truncation

**File:** `src/components/shared/TriageCard.tsx`

| Line | Code | Issue |
|---|---|---|
| 322-327 | `<p className="... truncate flex-1 min-w-0">{subtitle || ''}</p>` | Compact variant forces single-line truncation. A 40-char subtitle like `"Connects to 2 downstream relationships"` ends in "..." because Tailwind `truncate` is `text-overflow: ellipsis; overflow: hidden; white-space: nowrap;`. |
| 453-457 | Default variant uses `<ExpandableCoachingText text={subtitle \|\| displayDetail} className="text-text-light" />` | Correct pattern. 2-line clamp, expand button when overflow. |

The screenshot showing "Connects to 2 downstream..." is a compact-variant render. Fix: replace the raw `<p truncate>` with `<ExpandableCoachingText>`. `ExpandableCoachingText` already uses `flex-1 min-w-0` internally (line 65 of that file), so the adjacent right-side controls don't need layout changes.

---

## Task 3 — "$ 0" editor for "From brief" factor

**File:** `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`

Data path:
1. `usePreAnalysisData` builds `ImprovementItem` with `rawValue: os.raw_value ?? null`, `cap: os.cap ?? null`, `unit: os.unit ?? null` (`hooks/usePreAnalysisData.ts:904-906`).
2. `PreAnalysisPanel` constructs `editorConfig` for the triage card at lines 772-782:
   ```ts
   const numericValue = item.detail === 'Not set' ? null : (item.rawValue ?? null)
   // passed into editorConfig.rawValue
   ```
3. `InlineValueControls` (via `TriageCard`) pre-fills its input from `editorConfig.rawValue`. When `numericValue === 0`, input renders `"0"`. With `unit="$"` prefix, user sees `"$ 0"`.

Why brief-extracted factors hit this: CEE sets `cap = 70000` (the extracted ceiling from "up to £70k" in the brief) but leaves `observed_state.raw_value = 0` because no live baseline has been recorded. The card's "From brief" pill says the factor exists; the input contradicts the user's expectation that their brief figure is pre-filled.

**Guard invariant (Paul's correction, documented):** `ImprovementItem` does **not** carry a `confirmed` field directly. However, once a user confirms a brief-extracted factor via the triage Confirm action, the underlying node's `observed_state.source` changes to `user_confirmed`, and `mapImprovementToTriageCard` then assigns `sourceBadge` as something other than `'brief'` (see `mapImprovementToTriageCard.ts` + usePreAnalysisData `865-870` branching). The item effectively moves off the verify list. So **`sourceBadge === 'brief'` is the equivalent of "not yet confirmed"** — confirmed items exit the verify bucket entirely. No extra `confirmed` flag needed; the sourceBadge invariant provides belt-and-braces naturally.

**Type-strict cap check (Paul's correction):** use `typeof item.cap === 'number' && item.cap > 0`. Defends against `item.cap` being `null`, `undefined`, or any non-number sentinel — clearer than `item.cap != null && item.cap > 0`.

**Fix expression** (Task 3 final shape):
```ts
const isBriefExtractedWithCap =
  item.sourceBadge === 'brief' &&
  item.rawValue === 0 &&
  typeof item.cap === 'number' &&
  item.cap > 0
const numericValue = item.detail === 'Not set'
  ? null
  : isBriefExtractedWithCap
    ? item.cap
    : (item.rawValue ?? null)
```

---

## Task 4 — Start Here circle badge reads "0"

**Files:**
- `src/canvas/components/pre-analysis/PreAnalysisPanel.tsx:1515` — `ordinal={0}` passed explicitly to Start Here's TriageCard.
- `src/components/shared/TriageCard.tsx:293` (compact), `:411-412` (default) — both render the ordinal verbatim in a circular badge.
- Other Review next cards at `:1646` use `ordinal={i + 1}` (1-indexed correctly).
- Improve confidence cards at `:1729` also use `ordinal={i + 1}`.
- Post-analysis `DecisionConfidencePanel.tsx:492` uses `ordinal={i + 1}` (top 3). `AlsoConsiderDisclosure` uses `startOrdinal + i` starting at 4. Post-analysis is already 1-indexed; no change needed there.

**Start Here card structure** (`PreAnalysisPanel.tsx:1508-1509`): wrapped in `<div className="border-l-[3px] border-success rounded-[10px]">`. The green 3px left border is the card's distinguishing visual. Removing the numeric badge does not affect that border.

**Fix:**
- Make `ordinal` optional on both TriageCard variants: `ordinal?: number`.
- Wrap the badge render in `ordinal != null && (...)` in both compact (`:293`) and default (`:411-412`) variants.
- Remove `ordinal={0}` from the Start Here render at `:1515`.

**Layout verification (Paul's correction):** the compact/default variants both use `gap-2` flex rows where the ordinal badge is the first child (20px width). When the badge is absent, the next sibling (title) becomes the leftmost element. In the compact variant at `:292` the title has `min-w-0` and takes `flex-1`, so it moves left naturally. Row 2 (subtitle) uses `pl-7` (`:321`) to indent under where the badge was — that indent will look mismatched if the badge is absent. Add a layout audit step: when `ordinal` is absent, row 2 should drop the `pl-7` indent to align with the now-leftmost title. Snapshot test locks the DOM.

---

## Task 6 — "Your options" narrow-framing coaching inconsistency

**File:** `src/canvas/components/pre-analysis/OptionPreview.tsx`

| Lines | State | Copy |
|---|---|---|
| 370-374 | Collapsed | `"Your options work through similar factors."` (no link) |
| 416-429 | Expanded | `"Your options all work through similar factors. Consider a structurally different approach. Explore alternatives"` (link gated on `onSendMessage`) |

The two screenshots show the same coaching rendering differently because the cards are in different expanded/collapsed states — not because the bundle data differs. Unifying on the full expanded copy gives users the same affordance regardless of state.

**onSendMessage wiring audit (Paul's correction):**
- `OptionPreview` is rendered from one place: `PreAnalysisPanel.tsx:1570-1578`.
- That render site passes `onSendMessage={onSendMessage}` explicitly (line 1575).
- `PreAnalysisPanel`'s own `onSendMessage` prop is typed at `:208` (`onSendMessage?: (text: string) => void`).
- `OutputsDock.tsx:1401-1407` renders `<PreAnalysisPanel onSendMessage={sendMessage} ... />` — `sendMessage` is the shared useConversation handler.

**Conclusion:** `onSendMessage` is wired end-to-end in both bundles. The "Explore alternatives" link will render consistently once the expanded/collapsed copy is unified. No caller-side fix required.

**Fix:** in `OptionPreview.tsx`, replace the collapsed-state short message at `:370-374` with the same full message + link construction as the expanded state. Extract the shared JSX to a local helper to avoid duplication.

---

## Cross-cutting confirmations

- `ImprovementItem` does not have a `confirmed` field. Task 3 guard relies on `sourceBadge === 'brief'` invariant (confirmed items leave the verify list entirely).
- `isThresholdConfirmed` on `PreAnalysisData` is the right signal for Task 5's conditional `+1`.
- `onSendMessage` is fully wired; Task 6 is a pure rendering fix.
- `ExpandableCoachingText` component exists and handles the line-clamp + expand logic for Task 2.
- No new UI-SEM semantic-transform entries. Task 3's fallback is display-only, not an inference.

---

## Addendum — post-review follow-ups (ChatGPT feedback)

### P0 #1 refinement (applied in this hotfix)

Original Task 3 fix returned `cap` when `sourceBadge === 'brief' && rawValue === 0 && typeof cap === 'number' && cap > 0`. Review caught that this triple cannot distinguish two structurally-identical cases:

- (a) CEE extracted an upper bound (e.g. "up to £70,000") and left `raw_value` at 0 because no live baseline is recorded. → Want cap as suggested default.
- (b) Brief literally stated a 0 value (e.g. "current churn: 0%") and `raw_value=0` is the real figure. → Cap overwrite silently destroys the user's data.

Narrowed the fallback to return `null` instead of `cap`. Input renders empty with "Set value" placeholder; the "From brief" pill keeps the provenance signal; user re-enters the figure deliberately. Original "$ 0" bug still fixed (no misleading digit); zero-value scenarios no longer silently clobbered.

### P1 #1 refinement (applied in this hotfix)

Brief 4 Task 11's "Olumi adjusted N factors" copy was applied to `adjustments.length + repairActions.length`. Repair actions are pipeline-level fixes, not factor-level adjustments, so counting them under "factors" mislabels the aggregate. Switched to:

- `factorCount = adjustments.length` drives the "factors" pluralised count.
- When `factorCount === 0` but `repairActions.length > 0`, fall back to "Olumi applied N adjustments" copy — neutral terminology matching the actual row type.
- `totalCount` keeps its historic meaning (all visible rows) for the single-row / multi-row branch selector only.

### Known partial — out of scope for this hotfix

- **P1 #3 (Task 3 editor-only fix).** My resolver fixes the inline editor pre-fill but `item.detail` upstream in `usePreAnalysisData` may still format `raw_value=0` as a currency-prefixed zero for brief-extracted factors. The card body text ("$0") is therefore still inconsistent with the editor (which is now empty). Addressing this end-to-end requires plumbing `intervention_details[factor_id].display_value` from CEE through `ImprovementItem` → triage mapper → both the card body AND the editor, with one formatter sharing the priority chain. That's a pre-analysis refactor rather than a hotfix, so it's documented here as a known partial and scheduled as Improvement #1 below.

### Improvements (follow-up direction, not in this hotfix)

1. **Unified display-value pipeline.** Introduce `intervention_details[id].display_value` on `ImprovementItem`; route the card body text (detail / subtitle) and the editor pre-fill through a single formatter that prefers display_value → raw+unit → "Not set". Closes the detail-text gap from P1 #3 and obviates the cap fallback entirely.
2. **Fixture integration tests.** Render `PreAnalysisPanel` against both staging debug bundles (mid-market + hiring) and assert: no "0" circle badge, no single-line truncation ellipsis on subtitles ≤ 2 lines, no "$0" displayed for brief-extracted cost factors. Lock the three bug classes at the integration layer, not just at component unit-test level.
3. **Prune dead start-here branch.** `PreAnalysisPanel.tsx` still renders a `startHereSignal.kind === 'option_quality'` branch that `pickStartHere` (post-Brief 4) may never produce. Confirm and delete to cut dead-path drift.

### Scope note — vendor/schema commit

Commit `8e2ff4e3` (`chore(v5): vendored @talchain/schemas 0.4.0 -> 0.5.0`) is Paul's own commit that landed on this branch during hotfix work. It's unrelated to the pre-analysis UI fixes. Paul's decision at push time whether to keep it on this branch or split it to a separate release.

---

## Addendum — post-deploy verification (2026-04-17)

### Item 1 — card body vs editor mismatch (applied in this deploy)

Chosen option (a) from the verification list: surface the cap figure as a subtitle hint ("From brief: £70,000") without prefilling the input. `resolveCapHintSubtitle` in `utils/resolveEditorRawValue.ts` shares the `isBriefExtractedWithCap` predicate with the editor resolver, so the two always fire together. PreAnalysisPanel routes the hint into `mapped.subtitle` at the editorConfig branch so TriageCard's `subtitle || displayDetail` chain picks the hint over the upstream "$0" formatting. Four unit tests lock the helper.

### Item 2 — variant-coverage audit

Checked every Brief 4 Phase 8 change that touches TriageCard for default-vs-compact divergence. Structure: `TriageCard.tsx:408` branches `if (variant === 'compact') return <CompactTriageCard {...props} />` once; everything else is the default variant. Only one branch point.

| Brief 4 Phase 8 item | Surface | Default variant | Compact variant | Result |
|---|---|---|---|---|
| Task 2 — `ExpandableCoachingText` subtitles | TriageCard body | ✓ (Phase 8) | ✓ (hotfix Phase 3) | Consistent |
| Task 3 — `display_value` / cap-fallback | `editorConfig.rawValue` | ✓ | ✓ (compact doesn't render editor — deliberate) | Consistent |
| Task 4 — remove "AI estimate. Does this match?" | `mapImprovementToTriageCard.deriveSubtitle` | ✓ | ✓ (subtitle is a prop, mapper-agnostic) | Consistent |
| Task 8 — per-factor context derivation | Same mapper | ✓ | ✓ | Consistent |
| P1 #2 — EVPI `pp` pill always visible | TriageCard Row 1 | ✓ (Phase 8) | ✓ (hotfix ed17fa6f) | Consistent |
| Task 4 hotfix — optional ordinal | TriageCard Row 1 | ✓ (hotfix ff8c21e1) | ✓ (hotfix ff8c21e1) | Consistent |
| Task 1 hotfix — ModelAdjustments count | ModelAdjustments (not TriageCard) | n/a | n/a | out of scope |
| Task 6 hotfix — Options coaching | OptionPreview (not TriageCard) | n/a | n/a | out of scope |

Deliberate (not-bug) compact-variant differences: no `editorConfig` / `InlineValueControls`, no `displayDetail` fallback on subtitle, no `DiscussWithAiButton` sparkle — the variant is visually stripped by design for ranks 4-6.

**Conclusion: no further variant-coverage gaps after ed17fa6f.** The audit hit the remaining Brief-4-era divergence and closed it.

### Item 3 — dead-code cleanup

`handleResolveContestedEdge` traced to Brief 4 Task 6: it was the resolve-contested-edge handler passed into the expanded "Contested relationships" subgroup of `YourExpertise`. Brief 4 compressed `YourExpertise` to a single linking row, so the subgroup and its handler prop are gone. The local `handleResolveContestedEdge` in `PreAnalysisPanel` has no live consumer. Deleted.

`formatAdjustmentType` in `ModelAdjustments` pre-dates Brief 4. Grep confirms zero call sites. Deleted.

Also removed the two `isBrief` destructuring-only declarations in `TriageCard` (both variants) — declared but never read. Minor cleanup in the same commit.

