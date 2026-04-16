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

| Suite | Tests |
|---|---|
| `intervention display` | `interventions are always visible`, all 12 qualitative boundary tests (`0 → very low` through `1 → very high`), `shows qualitative level for cap=1 unit=""` (x2), `shows numeric for cap=1 unit="" with out-of-range value`, `shows qualitative for null cap and null unit`, `shows raw + unit when cap and unit are meaningful` |
| `click-to-inspector` | `calls onFocusNode with the factor node id when a factor label is clicked`, `calls onFocusNode with the option id when the option name is clicked` |

## coachingConfig count mismatch (1 failure)

| Test | Root cause |
|---|---|
| `coachingConfig (H-series) > H3: COACHING object has exactly 10 entries (9 panels + goalNoTarget)` | COACHING now has 11 entries (an 11th key was added); test hardcodes expected count of 10 |

**File:** `src/canvas/ui/inspector-v2/__tests__/coachingConfig.spec.ts`

## Previously documented (from memory)

- `DecisionQualityChecks.spec.tsx` — 6 failures (2026-04-08), references removed "Sharpen your thinking" header
- `no-message-render.spec.ts` — 1 failure (2026-04-08), ChallengeSection renders critique `.message` in JSX
- 29 test files excluded in `vitest.config.ts` (known-broken, tracked)
