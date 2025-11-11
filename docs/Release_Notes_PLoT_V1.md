# PLoT V1: Streaming & Debug Features — Release Notes

## Overview

This release introduces **streaming PLoT runs** with real-time progress updates and **debug slices** for Compare and EdgeInspector views, enabling deeper insight into Monte Carlo simulation results.

**Branch**: `feat/plot-v1-phase2plus`
**Target**: Production (staged rollout: staging → canary → GA)
**Feature Flags**: `VITE_FEATURE_PLOT_STREAM`, `VITE_FEATURE_COMPARE_DEBUG`, `VITE_FEATURE_INSPECTOR_DEBUG`

---

## Features

### 1. Streaming PLoT Runs (SSE)

Replaces synchronous HTTP requests with Server-Sent Events (SSE) for long-running analyses:

- **Real-time progress**: Progress bar with percentage updates (0-100%)
- **Interim findings**: Cumulative micro-batched insights (250ms window, 50-item cap)
- **Cancellation**: ESC key or route change cancels active streams
- **Error handling**: User-friendly messages for rate limits (429) and network errors
- **Determinism preserved**: Same (graph, seed) → same `response_hash` in sync or streaming modes

**Flag**: `VITE_FEATURE_PLOT_STREAM=1`

### 2. Compare Debug Slices

Adds Monte Carlo p10/p50/p90 delta displays and top-3 edge chips to CompareView:

- **Statistical deltas**: Cross-run comparison shows median (p50) changes with confidence bands (p10/p90)
- **Top-3 edges**: Clickable chips highlight influential edges on canvas (2s auto-clear)
- **Beta badge**: Visual indicator for experimental feature with tooltip
- **Accessibility**: ARIA labels, keyboard navigation, screen reader announcements

**Flag**: `VITE_FEATURE_COMPARE_DEBUG=1`

### 3. EdgeInspector Debug Facts

Displays edge metadata in a facts table within the inspector panel:

- **Weight/Belief/Provenance**: Shows edge strength, confidence, and data source
- **Default values**: belief=1.0, provenance=template (when missing)
- **Edit probabilities CTA**: Selects source node for probability editing (with "Press P" hint)
- **Accessibility**: Semantic table structure, ARIA labels, keyboard support

**Flag**: `VITE_FEATURE_INSPECTOR_DEBUG=1`

---

## Rollout Plan

### Phase A: Merge to main + CI Enablement ✅

1. **CI Configuration**: Playwright E2E tests run with flags enabled across Chromium/Firefox/WebKit
2. **Test Sharding**: Tests tagged (@streaming, @debug-compare, @debug-inspector) run in parallel (3 workers)
3. **Bundle Check**: CI verifies feature flags in build artifacts (`scripts/check-bundle-flags.sh`)

### Phase B: Staging Validation

1. Deploy to staging with flags ON
2. Run Playwright against staging (no MSW, real backend)
3. Manual Safari sanity check for SSE compatibility

### Phase C: Canary (10%) + Observability

1. LocalStorage-based canary gating (10% users)
2. Sentry instrumentation (tags: `streaming.active`, counters: `plot.stream.started`, `plot.stream.complete`)
3. Dashboard + alerts for error rate, latency, cancellation rate

### Phase D: Resilience & Fallbacks

1. Exponential backoff reconnection logic (behind flag)
2. Safari/WebKit fallback to sync endpoint if SSE fails

### Phase E: CI/Runtime Polish

1. Centralize deterministic test constants (`DETERMINISTIC_HASH_42`)
2. Flag matrix checklist in CI docs
3. Performance budget checks (LCP ≤ 2.5s, INP ≤ 100ms, CLS ≤ 0.1)

### Phase F: Documentation & Runbook

1. Update integration guide with canary/metrics sections
2. Operational runbook (rollback, diagnosis, debugging recipes)
3. Keyboard shortcuts & A11y reference

---

## Feature Flags

All features are **gated** and support graceful degradation:

| Flag | Feature | Fallback |
|------|---------|----------|
| `VITE_FEATURE_PLOT_STREAM` | SSE streaming | Sync POST endpoint |
| `VITE_FEATURE_COMPARE_DEBUG` | p10/p50/p90 deltas + edge chips | Standard CompareView (summary only) |
| `VITE_FEATURE_INSPECTOR_DEBUG` | Edge facts table | Standard EdgeInspector (weight slider only) |

**Setting flags**:
```bash
# Development
export VITE_FEATURE_PLOT_STREAM=1
export VITE_FEATURE_COMPARE_DEBUG=1
export VITE_FEATURE_INSPECTOR_DEBUG=1

# Production (via .env or hosting platform)
VITE_FEATURE_PLOT_STREAM=1
VITE_FEATURE_COMPARE_DEBUG=1
VITE_FEATURE_INSPECTOR_DEBUG=1
```

---

## Security

- **Sanitization**: DOMPurify sanitizes all markdown/HTML in interim findings and explanations
- **Fail-closed**: Zod schema validation rejects malformed debug slices (no partial rendering)
- **No persistence**: Preview/debug data never saved to localStorage or Supabase
- **Hash exclusion**: Debug slices excluded from `response_hash` calculation (determinism preserved)

---

## Accessibility

All features tested against WCAG 2.1 AA with zero Axe violations:

- **Screen readers**: Live regions for progress updates, comparison changes, edge selections
- **Keyboard navigation**: Tab, Enter, ESC support for all interactive elements
- **ARIA labels**: Semantic landmarks, descriptive labels for metrics and controls
- **Focus management**: Visible focus indicators, logical tab order

**Keyboard shortcuts**:
- `ESC`: Cancel streaming run or close inspector
- `P`: Open probabilities panel after node selection (EdgeInspector hint)

---

## Performance

- **Micro-batching**: 10Hz (100ms) throttle on interim findings and edge highlights
- **Lazy loading**: ELK, DOMPurify, marked loaded on-demand
- **Budgets**: LCP ≤ 2.5s, INP ≤ 100ms, CLS ≤ 0.1 (enforced in CI)

---

## Testing

### Coverage Summary

- **Unit tests**: `src/adapters/plot/__tests__/determinism.test.ts` (sync/streaming parity)
- **Integration tests**: `src/lib/__tests__/compare.test.ts` (cross-run deltas)
- **E2E tests**: 22 tests across 3 suites
  - `e2e/plot.streaming.spec.ts` (7 tests): Happy path, cancellation, errors, progress
  - `e2e/plot.compare-debug.spec.ts` (7 tests): Deltas, edge chips, A11y
  - `e2e/plot.inspector-debug.spec.ts` (8 tests): Facts table, CTA, A11y

### Running Tests

```bash
# Unit + integration
npm test

# E2E (all)
npm run test:e2e

# E2E (specific tag)
npx playwright test --grep @streaming
npx playwright test --grep @debug-compare
npx playwright test --grep @debug-inspector
```

---

## Troubleshooting

Common issues and solutions documented in:

- **[PLOT_V1_Integration.md#Troubleshooting](./PLOT_V1_Integration.md#troubleshooting)** (lines 1233-1422)
  - Streaming issues (stuck progress, ESC cancel, reconnection)
  - Debug slices missing or malformed
  - Edge highlighting not working
  - Safari SSE compatibility

---

## Documentation

- **Integration Guide**: [docs/PLOT_V1_Integration.md](./PLOT_V1_Integration.md)
  - Streaming API (lines 471-644)
  - Debug Slices (lines 647-873)
  - Keyboard Shortcuts (lines 876-907)
  - Troubleshooting (lines 1233-1422)

- **This Document**: Release notes, rollout plan, flag reference

---

## Known Limitations

1. **Safari SSE**: WebKit may drop SSE connections on network switch. Fallback to sync endpoint planned (Phase D).
2. **Beta Features**: Debug slices marked as BETA with tooltips. UI may evolve based on user feedback.
3. **Backend Dependency**: Requires PLoT v1 API with `debug.compare` and `debug.inspector` fields (see [PLOT_V1_Integration.md#Backend-Contract](./PLOT_V1_Integration.md#backend-contract)).

---

## Contact

For questions, issues, or feedback:

- **GitHub Issues**: [DecisionGuideAI/issues](https://github.com/paulslee/DecisionGuideAI/issues)
- **Documentation**: [docs/PLOT_V1_Integration.md](./PLOT_V1_Integration.md)
- **Troubleshooting**: [PLOT_V1_Integration.md#Troubleshooting](./PLOT_V1_Integration.md#troubleshooting)

---

**Last Updated**: 2025-11-01
**Version**: 1.0.0 (feat/plot-v1-phase2plus)
