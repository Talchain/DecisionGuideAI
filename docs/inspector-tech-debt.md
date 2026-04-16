# Inspector tech debt — test failures

## Resolved (Brief 1.5, 2026-04-16)

All six pre-existing test failure clusters have been resolved:

| # | Item | Root cause | Fix |
|---|---|---|---|
| 1 | GuidanceStrip `dismissItem` | `dismissItem` was added to store; test asserted `onSendMessage(prompt)` but component calls `onSendMessage(prompt, opts)` | Updated assertion to include `{ hidden: true, debugSource }` |
| 2 | coachingConfig count | 11th key (`goalEvidence`) added; test hardcoded count of 10 | Replaced count with structural assertion: every required key exists + no orphan keys |
| 3 | OptionPreview 18 failures | Component refactored to default collapsed; tests didn't expand first | Adopted pre-existing fix: added `expandOptionPreview()` calls before querying content |
| 4 | DecisionQualityChecks 6 failures | `same_levers` and `zero_external_factors` added to `STRUCTURAL_CHECK_IDS`; test fixtures only contained structural IDs → component returned null | Updated filter test to include non-structural check; removed direct-add tests (all DIRECT_ACTIONS IDs are now structural — feature unreachable in this component) |
| 5 | ChallengeSection `.message` | `InferenceWarningCard` renders `warning.message` in JSX; static scan flagged it | Added `ChallengeSection.tsx` to `DEFENCE_IN_DEPTH_FILES` with guard requiring fallback pattern. ISL warning messages are a different type from PLoT critique data. |
| 6 | ConfidenceSection VOI | Component renders "Could change the result"; test expected "Could change the recommendation" | Updated test assertions to match current component copy; removed KNOWN-BROKEN comment |

## Previously documented (from memory)

- `DecisionQualityChecks.spec.tsx` — 6 failures (2026-04-08) → **resolved** above (item 4)
- `no-message-render.spec.ts` — 1 failure (2026-04-08) → **resolved** above (item 5)
- `ConfidenceSection.voi.spec.tsx` — 1 failure (2026-04-08) → **resolved** above (item 6)
- 29 test files excluded in `vitest.config.ts` (known-broken, tracked separately)
