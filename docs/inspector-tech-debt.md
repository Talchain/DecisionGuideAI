# Inspector tech debt — pre-existing test failures

Captured 2026-04-16 on `staging` branch at `0db42c58`. These failures exist on baseline (no relation to inspector panel redesign work).

## GuidanceStrip (1 failure)

| Test | Root cause |
|---|---|
| `GuidanceStrip — action button behaviour > discuss action calls onSendMessage with prompt` | `useGuidanceStore.getState().dismissItem` is not a function — `dismissItem` was never added to the guidance store |

**File:** `src/canvas/conversation/__tests__/GuidanceStrip.spec.tsx`

## ConfidenceSection VOI (1 failure)

| Test | Root cause |
|---|---|
| `ConfidenceSection: V11 VOI promoted block > shows "Could change the recommendation" when topAction.couldFlip` | KNOWN-BROKEN (comment at top of file, 2026-04-08) |

**File:** `src/components/results/__tests__/ConfidenceSection.voi.spec.tsx`

## OptionPreview (18 failures)

All in `src/canvas/components/pre-analysis/__tests__/OptionPreview.spec.tsx`:

| # | Test name |
|---|---|
| 1 | `intervention display > interventions are always visible` |
| 2 | `intervention display > shows qualitative level for cap=1, unit="" intervention (0.8 → "to very high")` |
| 3 | `intervention display > shows qualitative level for cap=1, unit="" intervention (0.5 → "to moderate")` |
| 4 | `intervention display > shows numeric for cap=1, unit="" with out-of-range value (5000 → "to 5000")` |
| 5 | `intervention display > shows qualitative for null cap and null unit (existing behaviour)` |
| 6 | `intervention display > qualitative boundary: 0 → "to very low"` |
| 7 | `intervention display > qualitative boundary: 0.19 → "to very low"` |
| 8 | `intervention display > qualitative boundary: 0.2 → "to low"` |
| 9 | `intervention display > qualitative boundary: 0.39 → "to low"` |
| 10 | `intervention display > qualitative boundary: 0.4 → "to moderate"` |
| 11 | `intervention display > qualitative boundary: 0.59 → "to moderate"` |
| 12 | `intervention display > qualitative boundary: 0.6 → "to high"` |
| 13 | `intervention display > qualitative boundary: 0.79 → "to high"` |
| 14 | `intervention display > qualitative boundary: 0.8 → "to very high"` |
| 15 | `intervention display > qualitative boundary: 1 → "to very high"` |
| 16 | `intervention display > shows raw + unit when cap and unit are meaningful` |
| 17 | `click-to-inspector > calls onFocusNode with the factor node id when a factor label is clicked` |
| 18 | `click-to-inspector > calls onFocusNode with the option id when the option name is clicked` |

## coachingConfig count mismatch (1 failure)

| Test | Root cause |
|---|---|
| `coachingConfig (H-series) > H3: COACHING object has exactly 10 entries (9 panels + goalNoTarget)` | COACHING now has 11 entries (an 11th key was added); test hardcodes expected count of 10 |

**File:** `src/canvas/ui/inspector-v2/__tests__/coachingConfig.spec.ts`

## Previously documented (from memory)

- `DecisionQualityChecks.spec.tsx` — 6 failures (2026-04-08), references removed "Sharpen your thinking" header
- `no-message-render.spec.ts` — 1 failure (2026-04-08), ChallengeSection renders critique `.message` in JSX
- 29 test files excluded in `vitest.config.ts` (known-broken, tracked)
