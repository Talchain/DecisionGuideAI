# Guide Variant E2E Test Suite

Comprehensive end-to-end tests for the Guide (Copilot) variant covering all Path B features.

## Test Files

### 01-critical-path.spec.ts
Tests the main user journey through Guide variant:
- Empty state → Building → Inspector → Pre-run → Running → Post-run
- Journey stage transitions and persistence
- Panel state changes

### 02-safety-guarantees.spec.ts
Tests safety mechanisms and guardrails:
- Cannot run empty graph
- Cannot run with < 2 nodes
- Pre-run checklist gating
- Post-run read-only state

### 03-trust-features.spec.ts — DELETED 27 Aug 2026, deliberately not replaced
It claimed to test bias mitigation, provenance with document citations,
severity-styled critiques, verification badges and confidence levels. **It
tested none of them, and it announced that it had.**

All five tests imported `expect`, never called it, and ended with an
unconditional `console.log('GATES: PASS — …')`. They passed whatever the
product did, and printed a verdict they had not computed into the CI log — so
the provenance step of the Core journey read as covered while nothing was ever
asserted.

Derived at `1091fd4d` before deleting, which is why they were not repaired in
place:

- Every `localStorage` key they set up to establish "post-run" state —
  `__MOCK_POST_RUN`, `__MOCK_CITATIONS`, `__MOCK_CRITIQUES`,
  `__MOCK_VERIFICATIONS`, `feature.copilotVariant` — has **zero readers in
  `src/`** (contrast in the same sweep: `sandbox.model` 10, `olumi.expertMode`
  15, `guestId` 12). The state they claimed to arrange never existed.
- The testids they hunted, `bias-mitigation` and `provenance-panel`, have
  **zero occurrences in `src/`**. The real surfaces exist under different names
  (`t1-bias-block`, `right-panel-provenance`, `model-detail-v2-provenance`) and
  on the canvas route, not on `/#/sandbox` where these tests navigated.
- The remaining three bound by loose predicates — `getByText(/confidence/i)`,
  `[data-severity]`, `[data-testid*="verification"]` — which any number of
  unrelated elements satisfy.

Making them assert would therefore have meant writing new tests against
different surfaces on a different route: inventing coverage, not repairing an
instrument. **A file that honestly covers nothing is safer than one that claims
to cover something.** If these features need e2e coverage, they need a spec
written against the canvas route and the testids that actually exist.

### 04-canvas-features.spec.ts
Tests Guide-specific canvas enhancements:
- Visual encoding (edge thickness, colors)
- Critical gap animations
- Driver badges with rank
- Post-run highlighting
- **Ghost edge suggestions (NEW)**

### 05-compare-mode.spec.ts
Tests scenario comparison:
- Run selector with baseline/current
- Delta calculation and display
- Top 3 change drivers from explain_delta
- Structural diff
- AI recommendations

### 06-keyboard-navigation.spec.ts
Tests keyboard shortcuts and accessibility:
- Tab/Esc for ghost suggestions
- Arrow keys for panel navigation
- Enter/Space for actions
- Focus indicators

### 07-performance.spec.ts
Tests performance characteristics:
- Initial load time < 3s
- Panel render time < 500ms
- Ghost suggestion delay ~300ms
- Post-run highlighting < 200ms
- Memory leak prevention

## Running Tests

```bash
# Run all Guide E2E tests
npm run test:e2e:guide

# Run specific test file
npx playwright test e2e/guide/01-critical-path.spec.ts

# Run with UI
npx playwright test e2e/guide --ui

# Run in headed mode for debugging
npx playwright test e2e/guide --headed
```

## Test Strategy

These tests use:
- **Feature flags**: `feature.copilotVariant` to enable Guide variant
- **Mocking**: `__MOCK_*` localStorage keys for state simulation
- **Helpers**: `gotoSandbox()`, `waitForPanel()` from `../_helpers`
- **Timeouts**: Generous timeouts to avoid flakes
- **GATES logging**: Console logs for CI visibility

## CI Integration

Tests run in Playwright CI config with:
- Chrome (desktop)
- 2 retries on failure
- Video capture on failure
- HTML report generation

## Coverage

- ✅ All 8 test files implement critical user journeys
- ✅ Ghost suggestions feature covered
- ✅ Compare mode integration tested
- ✅ Trust features validated
- ✅ Performance benchmarks established
