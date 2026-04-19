# Brief 5.2 — Phase 0 pre-flight findings

**Branch:** `ui/analysis-tab-brief-5_2-hotfix` from `staging` @ `9b1634d2`
**Scope:** evidence-led investigation to support corrected plan at `~/.claude/plans/brief-5-2-bright-donut.md`. No code edits in this phase. Commit separately.

## Phase 0 gates — summary

| Gate | Outcome | Decision |
|---|---|---|
| Task 1 — confidence_tier + coaching_readiness on VM | **Go** | Proceed with hero+footer calibration; extend suppressor; swap the strong-winner fallback to `buildCertaintyCopy`. |
| decision_brief.headline consumer audit | **Go** | Debug bundle export only; no Analysis-tab UI surface. |
| Task 2 — hash render sites | **Verification-only** | Single render site already `expertMode`-gated. Add `data-testid` for precise scoping; ship regression test. No gate change. |
| Task 3 — inline editor state model | **Go** | Missing-data rows render editor unconditionally when `activeEditorKey == null`. Pencil deleted entirely. |
| Task 4 — "Your options" coaching parity | **Verification-first** | Code inspection shows both states render `SameLeversCoaching`. Defer code change behind manual 1280×900 repro. |
| Task 5 — compact subtitle truncation | **Verification-first** | `CompactTriageCard` wires `ExpandableCoachingText`. Defer code change behind manual 1280×900 repro. |
| Task 6 — fragility structure | **Go** | Double-arrow + "could win" + inline pill + `(Status Quo)` leak all confirmed; plan is valid. |
| Task 7 — sparkle variant | **Go** | Two one-line fixes. |
| Task 8a — Improve confidence count | **Locked: rendered-only** | Drop expertise term from the header-count formula. |
| Task 8b — Confirm on `—` value | **Locked: hide icon** | Gate Confirm render on `display != null`. |
| Task 8c — Gauge icon at Risk profile | **Present** | No change. |
| Task 8d — technique chip | **Locked: (b) hint-only by deliberate design** | Keep non-interactive. Regression test asserts no click handler. |

---

## 1. Task 1 — hero headline + footer stability root cause

### The main-hero headline is hardcoded for standard winners

HeroSection has two rendering paths:

- **V16 path** (`decisionState` provided — the production path per the TODO at [HeroSection.tsx:918](../src/components/results/HeroSection.tsx#L918)): headline assembled at [HeroSection.tsx:700-760](../src/components/results/HeroSection.tsx#L700-L760). Near-tie branch renders `"{optA} and {optB} are too close to call"`. Standard-winner branch renders `v14Headline.text ?? <>{winnerLabel} performs best</>`.
- **Legacy V9.2 path** (fallback): headline at [HeroSection.tsx:912-946](../src/components/results/HeroSection.tsx#L912-L946) uses the `m1Headline` / `m2Headline` memo pair at [lines 342-377](../src/components/results/HeroSection.tsx#L342-L377).

`v14Headline.text` is derived at [lines 455-490](../src/components/results/HeroSection.tsx#L455-L490):
- `analysisStatus === 'partial'` → "Some analysis steps did not complete"
- near-tie → object with `isNearTie: true` + option pair
- `optionCount === 1` → "{winner} is your only option"
- **otherwise → `null`** → fallback to the hardcoded `{winnerLabel} performs best`

There is no code path where `v14Headline.text` becomes "Option X is the clear leader with a 95-point advantage". That text comes from `coachingHeadline` / `coachingKeyQualifier` (see §2 below), not from the main hero title.

### m2Headline is a dormant prop

`m2Headline?: string` is declared at [HeroSection.tsx:117](../src/components/results/HeroSection.tsx#L117) and destructured at [line 309](../src/components/results/HeroSection.tsx#L309). It overrides `m1Headline` at [lines 373-377](../src/components/results/HeroSection.tsx#L373-L377) when `recommendationStability == null || recommendationStability >= 0.70`.

Grep for production callers: only [HeroSection.spec.tsx:126, 138](../src/components/results/__tests__/HeroSection.spec.tsx) pass it. `ResultsBody.tsx` does not. In production, the prop is always undefined and the `m2Headline` branch never fires. The `m1Headline` memo is likewise in the legacy V9.2 path which is not reached in production.

**Implication:** the Task 1 over-confident hero copy does not come from `m1Headline` / `m2Headline`. It comes from PLoT-sourced coaching text rendered alongside the hardcoded `"{winnerLabel} performs best"` title. The fix surface is the **coaching-copy suppressor + the fallback title**, not the dormant `m1`/`m2` memos.

### Over-confident copy sources (live in production)

1. **`coachingHeadline`** — sourced at [useResultsSectionData.ts:1229](../src/components/results/useResultsSectionData.ts#L1229) from `m1Coaching.executive_summary.headline` (PLoT). Rendered in the legacy V9.2 path at [HeroSection.tsx:984-989](../src/components/results/HeroSection.tsx#L984-L989). Sanitised via `sanitizeCoachingText`, then filtered through `shouldSuppressContradictoryExecutiveCopy`.
2. **`coachingKeyQualifier`** — rendered as bullet 1 in the V16 path at [HeroSection.tsx:551-553](../src/components/results/HeroSection.tsx#L551-L553), filtered through the same suppressor.
3. **`coachingParagraph`** — rendered in the "More" expand at [HeroSection.tsx:691](../src/components/results/HeroSection.tsx#L691), also filtered.

### The suppressor is too narrow

[`shouldSuppressContradictoryExecutiveCopy`](../src/components/results/HeroSection.tsx#L243-L249) (UI-SEM-021):

```ts
function shouldSuppressContradictoryExecutiveCopy(
  text: string | null | undefined,
  robustnessLevel?: RobustnessLevel,
): boolean {
  if (!text || (robustnessLevel !== 'low' && robustnessLevel !== 'very_low')) return false
  return /\brobust\b|ready to proceed/i.test(text)
}
```

Two gaps:
- Only fires when `robustnessLevel` is `low`/`very_low`. Ignores `confidenceTier === 'needs_work'` and weak `coachingReadiness`.
- Pattern catches only `robust` / `ready to proceed`. Over-confident copy like "clear leader", "strong advantage", "confident in" slips through.

### `buildCertaintyCopy` is authoritative but only consumed by DecisionConfidencePanel

[certaintyCopy.ts](../src/components/results/utils/certaintyCopy.ts) already encodes the tier-aware decision table (Rule 4 emits `"{winner} currently leads"` + caveat when `confidenceTier === 'needs_work'` OR readiness weak). The sole caller is [DecisionConfidencePanel.tsx:467](../src/components/results/DecisionConfidencePanel.tsx#L467). HeroSection's hardcoded `"{winnerLabel} performs best"` fallback duplicates (and contradicts) this logic.

### Recommended Phase 1 fix shape

1. Widen `shouldSuppressContradictoryExecutiveCopy` to accept `confidenceTier?: ConfidenceTier` and `coachingReadiness?: M1CoachingReadiness`. Suppress when:
   - `(robustnessLevel === 'low' || robustnessLevel === 'very_low')` AND existing pattern hits, **OR**
   - tier/readiness is weak (mirror `buildCertaintyCopy` Rule 4 detector) AND pattern is widened to `/\b(clear|leader|strong advantage|confident)\b/i`.
   - Apply at all three call sites — [lines 551, 691, 984](../src/components/results/HeroSection.tsx) — passing `confidenceTier` + `coachingReadiness` from new props.
2. Replace the `"{winnerLabel} performs best"` standard-winner fallback ([line 754](../src/components/results/HeroSection.tsx#L754) and [line 939](../src/components/results/HeroSection.tsx#L939)) with a call to `buildCertaintyCopy(...)`. For the weak-tier branch, append the win-probability-gap suffix "by N points" where `N = Math.round((winnerWinProbability - runnerUpWinProbability) * 100)`. Do not collapse a 97% winner to "no clear leading option" — keep the soft lede with the numeric gap.
3. Footer: build new [`getStabilityDisplayLabel({classification, confidenceTier})`](../src/components/results/utils/) adapter local to the Analysis tab. When `confidenceTier === 'needs_work'` OR weak readiness → return `{ heroLabel: 'Stability sensitive', … }`. Else pass-through the numeric classification. `src/lib/stability.ts` signature unchanged.
4. VM wiring: `useResultsSectionData.ts` already exposes `coachingReadiness` ([line 1236](../src/components/results/useResultsSectionData.ts#L1236)). `confidenceTier` is surfaced via the confidence section ([ConfidenceSection.tsx:94](../src/components/results/ConfidenceSection.tsx#L94) and the `data.confidence.tier.tier` path used at [DecisionConfidencePanel.tsx:469](../src/components/results/DecisionConfidencePanel.tsx#L469)). Thread both into HeroSection + ResultsFooter props.

### Gate outcome

**Go.** All inputs are available. No shared-utility broadening required (`certaintyCopy.ts` is Analysis-tab-local; adding an optional `winProbabilityGap?: number` param is backward-compatible).

---

## 2. `decision_brief.headline` consumer audit

`rg -n "decision_brief\.headline|decisionBrief\.headline" src/` results:

| Path | Purpose |
|---|---|
| [src/components/debug/utils/exportBundle.ts:208-209](../src/components/debug/utils/exportBundle.ts#L208-L209) | Debug bundle export — not rendered in UI. |
| [src/components/debug/__tests__/goldenFixture.spec.ts:416, 437](../src/components/debug/__tests__/goldenFixture.spec.ts) | Test fixture. |

**Result: no Analysis-tab UI surface consumes `decision_brief.headline` directly.** The PLoT field is exported for debug bundles only. The over-confident copy in the bundle-609164c7 screenshot comes from `m1Coaching.executive_summary.headline` (via `coachingHeadline`), not `decision_brief.headline`. These are separate PLoT fields.

**Gate outcome: Go.** No escalation required.

---

## 3. Task 2 — hash render sites + scoping

### Single Analysis-tab render site

[AdvancedSection.tsx:335](../src/components/results/AdvancedSection.tsx#L335) wraps the entire "Analysis details" block in `{expertMode && (<ExpertBlock>…</ExpertBlock>)}`. The hash row is inside this block at [lines 387-408](../src/components/results/AdvancedSection.tsx#L387-L408). It displays `responseHash.slice(0, 12) + '…'` — a truncated 12-char hex token with ellipsis — not the 7-char `9b1634d` shown in the QA screenshot.

### Other hash render sites (dev/debug only)

- [DebugTray.tsx:157-178](../src/components/DebugTray.tsx) — dev tray, only in dev/debug builds.
- [PayloadLabTab.tsx:2300](../src/components/debug/PayloadLabTab.tsx#L2300) — payload lab debug tab.
- [PipelineTab.tsx:204-207, 1448](../src/components/debug/tabs/PipelineTab.tsx) — debug tabs.
- [SummaryTab.tsx:848, 960](../src/components/debug/tabs/SummaryTab.tsx) — debug tabs.
- [DataFlowTab.tsx:823](../src/components/debug/tabs/DataFlowTab.tsx) — debug tab.

None of these render in the production Analysis surface. DebugTray is the only one that could conceivably be open when the user screenshots, and it displays `"Response Hash (Determinism): {hash.substring(0, 16)}…"` — again not the bare 7-char SHA.

### Assessment

The current code is already correctly gated. Screenshot "9b1634d" is either (a) taken with expert mode on, (b) the user mistook a different hex-like token in the UI, or (c) matches the Brief 5.1 merge commit SHA `9b1634d2` which is unrelated to any UI render and may have been sourced from browser DevTools or a build artefact.

### Recommended Phase 2 action

- Add `data-testid="advanced-hash-row"` around the `<dt>Hash</dt><dd>…</dd>` pair at [AdvancedSection.tsx:387-408](../src/components/results/AdvancedSection.tsx). No gate change.
- Extend [AdvancedSection.spec.tsx](../src/components/results/__tests__/AdvancedSection.spec.tsx) with an explicit assertion: when `expertMode=false` AND `hasInferenceWarnings=true` (auto-expanded accordion), the testid is not in the DOM.
- Add a page-level backstop regression: render full results with `expertMode={false}`; assert `container.textContent` does not match `/\b[0-9a-f]{7}\b/`.

### Gate outcome

**Verification-only.** No gate change needed. Ship testid + stronger tests.

---

## 4. Task 3 — Missing-data inline editor state model

### Current behaviour

[MissingData.tsx:104-148](../src/canvas/components/pre-analysis/expertise/MissingData.tsx#L104-L148) gates the `ScientificEditor` behind `isEditing && nodeId`, where `isEditing = inlineEditorAvailable && activeEditorKey === item.key`. On initial render `activeEditorKey` is `null`, so every Missing-data row defaults to the closed two-row state: label + Not set + Pencil button + technique hint. The editor only appears after a Pencil click toggles `activeEditorKey` to that row's key.

### Simplified state model (locked)

Missing-data rows default **open**:

- `inlineEditorAvailable && activeEditorKey == null` → render `<ScientificEditor>` for every row.
- `activeEditorKey != null` (some AiEstimated row is editing, or the deep-link `onRequestEdit(item.key)` was called from outside) → collapse all Missing-data rows to a no-editor layout.

`activeEditorKey` keeps its simple "no active editor" meaning — no overloaded null-state semantics. When the user closes the AiEstimated editor (`onCancelEdit` → `setActiveEditorKey(null)` per [YourExpertise.tsx:86-91](../src/canvas/components/pre-analysis/expertise/YourExpertise.tsx#L86-L91)), Missing-data rows re-open automatically.

### Pencil removal (locked)

Delete the Pencil button from Missing-data rows entirely (per user correction #6). Closed-state layout becomes: label + Not set + technique hint + sparkle. The editor re-opens automatically when `activeEditorKey` returns to null; no explicit "open editor" affordance needed.

### Brief-only deep-link path unchanged

Tests at [YourExpertise.parity.spec.tsx](../src/canvas/components/pre-analysis/expertise/__tests__/YourExpertise.parity.spec.tsx) cover the deep-link path via `onRequestEdit(item.key)`. That callback continues to set `activeEditorKey`, and the new Missing-data render branches correctly:
- If the deep-link target is an AiEstimated row → Missing-data rows collapse.
- If the deep-link target is a Missing-data row — the row is already in its default-open editor state, so the callback is effectively a no-op for the current render; keep it for API compatibility.

### Gate outcome

**Go.** Simple state model, no new plumbing.

---

## 5. Task 4 + Task 5 — verification-first

### Task 4: "Your options" coaching

[OptionPreview.tsx:406-408](../src/canvas/components/pre-analysis/OptionPreview.tsx#L406-L408) (collapsed branch) and [:452-456](../src/canvas/components/pre-analysis/OptionPreview.tsx#L452-L456) (expanded branch) both render `<SameLeversCoaching onSendMessage={onSendMessage} />` when `hasSameLeversCheck`. The component body is declared once at [line 214](../src/canvas/components/pre-analysis/OptionPreview.tsx#L214) and renders identical markup in both call sites.

Parent: [PreAnalysisPanel.tsx:1585](../src/canvas/components/pre-analysis/PreAnalysisPanel.tsx#L1585) passes `hasSameLeversCheck={data.qualityChecks.some(c => c.id === 'same_levers')}`. The flag is a single value shared across both states.

Existing tests at [OptionPreview.spec.tsx:36, 55, 74, 275, 279](../src/canvas/components/pre-analysis/__tests__/OptionPreview.spec.tsx) already verify that collapsed renders the coaching, and [:81, 287](../src/canvas/components/pre-analysis/__tests__/OptionPreview.spec.tsx) verify that `hasSameLeversCheck=false` suppresses it in both states.

**Verdict from code inspection: already parity-correct.** The reported regression does not reproduce in the static code.

### Task 5: compact subtitle truncation

[TriageCard.tsx:337-345](../src/components/shared/TriageCard.tsx#L337-L345) wires `ExpandableCoachingText` on the compact subtitle path. No `truncate` class is applied to the subtitle in the compact variant. A regex grep for `truncate|line-clamp-1|text-ellipsis` in TriageCard.tsx returned zero hits.

**Verdict from code inspection: already correctly wrapped.**

### Decision

Both Task 4 and Task 5 are **verification-first**. Phase 4 and Phase 5 are regression-test-only unless the manual 1280×900 repro against current staging shows otherwise. Record the repro result in the final-review doc.

---

## 6. Task 6 — fragility structure evidence

Inspection of [ChallengeSection.tsx:196-325](../src/components/results/ChallengeSection.tsx#L196-L325):

| Finding | Location | Current state |
|---|---|---|
| Double arrow | [:255](../src/components/results/ChallengeSection.tsx#L255) and [:259](../src/components/results/ChallengeSection.tsx#L259) | Visible `&rarr;` at 255; `aria-hidden="true"` `→` at 259 (hidden from SRs, **visible to sighted users**). Both render visually. |
| "could win" | [:261](../src/components/results/ChallengeSection.tsx#L261) | Plan replaces with "could overtake". |
| Group Stability pill inline | [:229-231](../src/components/results/ChallengeSection.tsx#L229-L231) | Inline with headline text; needs anchoring top-right. |
| Per-row chip gated | [:275-285](../src/components/results/ChallengeSection.tsx#L275-L285) | Rendered only when `!consolidated`. Consolidated groups fall back to icon-only inspector button at [:292-305](../src/components/results/ChallengeSection.tsx#L292-L305). |
| "(Status Quo)" not stripped | [:245-249](../src/components/results/ChallengeSection.tsx#L245-L249) | `stripEncodingNotation` only; no suffix stripping. `formatOptionLabelForCard` at [cleanFactorLabel.ts:101-126](../src/components/results/utils/cleanFactorLabel.ts#L101-L126) has the correct behaviour but only called from baseline cards. |

### Plan valid

Phase 6 plan is valid as written:

1. Single arrow per row (drop line 259's second arrow, restructure clause).
2. Extract [`stripStatusQuoSuffixForDisplay(label)`](../src/components/results/utils/cleanFactorLabel.ts) shared helper; refactor `formatOptionLabelForCard` to delegate; call from fragility alt-winner render.
3. "could win" → "could overtake".
4. Move Stability pill to card top-right positioning.
5. Chip for all groups (consolidated + non-consolidated).

### Gate outcome

**Go.** Plan is structurally valid.

---

## 7. Task 7 — sparkle variant

Confirmed: [AiEstimated.tsx:201](../src/canvas/components/pre-analysis/expertise/AiEstimated.tsx#L201) and [MissingData.tsx:151](../src/canvas/components/pre-analysis/expertise/MissingData.tsx#L151) both render `<DiscussWithAiButton element={…} />` without a `variant` prop. Default is `primary` at [DiscussWithAiButton.tsx:42-48](../src/canvas/components/pre-analysis/DiscussWithAiButton.tsx#L42-L48); `secondary` variant opacity-50 hover-to-100 classes at [lines 82-84](../src/canvas/components/pre-analysis/DiscussWithAiButton.tsx#L82-L84).

Two one-line fixes in Phase 7.

---

## 8. Task 8 — verification + cleanup locks

### 8a — Improve confidence count

Current formula at [PreAnalysisPanel.tsx:1129-1131](../src/canvas/components/pre-analysis/PreAnalysisPanel.tsx#L1129-L1131):

```ts
const improveConfidenceCount = includeGoalAsImprovement
  + improveConfidenceCards.length
  + (expertiseHasItems ? 1 : 0)
```

The `+ (expertiseHasItems ? 1 : 0)` term adds 1 when Your expertise has any items, but the expertise section is a **sibling** of Improve confidence, not a child. The QA finding (header says 5, visible within Improve confidence = goal (1) + 3 cards = 4) matches: expertise is being over-counted.

**Locked rule (user correction #10):** count visible goal row + visible cards WITHIN the Improve confidence section boundary. Drop the expertise term.

Fix in Phase 8a: remove `+ (expertiseHasItems ? 1 : 0)` from the `improveConfidenceCount` formula. `improveActionable` at [line 1222](../src/canvas/components/pre-analysis/PreAnalysisPanel.tsx#L1222) is a separate derivation for the dynamic-headline copy and is out of scope for this fix. Add a one-line code comment at the header-count site documenting the rule.

### 8b — Confirm icon on `—` values

[AiEstimated.tsx:118-126](../src/canvas/components/pre-analysis/expertise/AiEstimated.tsx#L118-L126) renders the `—` placeholder when `display` (from `formatFactorDisplayValue`) is null. [Lines 167-198](../src/canvas/components/pre-analysis/expertise/AiEstimated.tsx#L167-L198) render the Confirm + Edit action pair unconditionally whenever `!isEditing`.

**Locked rule (user correction):** hide the Confirm icon when `display` is null.

Fix in Phase 8b: gate the Confirm `<Tooltip>/<button>` on `display != null` (not disabled — hidden). Edit affordance stays.

### 8c — Gauge icon at Risk profile

Confirmed present at [AdvancedSection.tsx:164](../src/components/results/AdvancedSection.tsx#L164): `<Gauge size={14} className="text-text-light" aria-hidden="true" />`. No change. Visual confirmation in the Phase 9 walkthrough.

### 8d — Technique chip decision

Current behaviour at [MissingData.tsx:142-146](../src/canvas/components/pre-analysis/expertise/MissingData.tsx#L142-L146):

```tsx
<Tooltip delay={300} content={technique.tooltip}>
  <span className={`${typography.panelMeta} text-text-light cursor-help`}>
    {technique.text}
  </span>
</Tooltip>
```

`onSendMessage` is NOT currently threaded into `MissingData` (grep in expertise/ returned zero hits). Wiring it would require threading through `YourExpertise` → `MissingData` (two levels). The parent `PreAnalysisPanel` has `onSendMessage` available but doesn't currently pass it to `YourExpertise`.

### Locked decision: (b) hint-only by deliberate design

**Rationale:**
- **Surgical-edits-only principle** — threading `onSendMessage` through two component levels is plumbing, not the smallest possible fix.
- **Tooltip already provides context** — the existing `Tooltip` with `content={technique.tooltip}` delivers actionable guidance ("Step back from the specifics and consider base rates from comparable cases.") on hover.
- **Non-misleading** — `cursor-help` (not `cursor-pointer`), `<span>` (not `<button>`), no click affordance implied.
- **Click-to-chat is feature work**, not a bug fix, and belongs in a separate brief if/when desired.

### Fix in Phase 8d

Lock the hint as non-interactive. Regression test:
- Assert rendered element is `<span>`, not `<button>`.
- Assert no `onClick` handler, no `role="button"`.
- Assert `cursor-help` class present.

---

## Risk + open items

- `shouldSuppressContradictoryExecutiveCopy` is tagged as UI-SEM-021 with the comment *"Remove when PLoT/CEE provides robustness-conditioned coaching copy directly"*. Widening its signature and pattern does not change its UI-SEM status; it remains a display-side defence and is still scheduled for removal when upstream stops emitting contradictory copy. No new UI-SEM entry is created.
- Extending `certaintyCopy.ts` with an optional `winProbabilityGap?: number` is backward-compatible. Existing spec at [certaintyCopy.spec.ts](../src/components/results/utils/__tests__/certaintyCopy.spec.ts) does not exercise the new param, so no tests regress. New tests cover the suffix behaviour.
- `getStabilityDisplayLabel` adapter is Analysis-tab-local. `src/lib/stability.ts` signature is unchanged — no shared-utility broadening. The `getStabilityBorderClass` caller set at [HeroSection.tsx:38](../src/components/results/HeroSection.tsx#L38) is untouched.

## Phases 1–9 — ready to proceed

Plan corrections 1-12 are reflected in the updated plan at `~/.claude/plans/brief-5-2-bright-donut.md`. All Phase 0 gates are resolved. Phase 1 begins with HeroSection + ResultsFooter thread-through.

---

*End of Phase 0 findings.*
