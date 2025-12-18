# PLoT Enrichment Routing Migration Plan

**Phase 1A: Routing Consolidation**

This document describes the migration plan for consolidating ISL calls through PLoT's enrichment response.

## Background

### The Problem

Currently, the UI makes independent calls to:
1. **PLoT** (`/bff/plot/v1/run`) - Decision analysis engine
2. **ISL** (`/bff/isl/api/v1/*`) - Robustness, sensitivity, validation analysis

This dual-pipeline approach causes **inconsistent results** because:
- PLoT and ISL use different random number generators (RNGs)
- Monte Carlo simulations produce different samples on each service
- Results can diverge, confusing users

### The Solution

Have PLoT call ISL internally and return enrichment data in its response. The UI then extracts enrichment data from PLoT instead of calling ISL directly. This ensures:
- Single source of truth for decision analysis
- Deterministic results (same RNG seeds)
- Reduced network latency (fewer round trips)
- Simplified error handling

## Migration Inventory

### ISL Calls to Consolidate (Phase 1)

These hooks call ISL endpoints that will be consolidated into PLoT enrichment:

| Hook | ISL Endpoint | Target Enrichment Field | Priority |
|------|--------------|------------------------|----------|
| `useRobustness` | `/api/v1/analysis/robustness` | `enrichment.sensitivity_analysis` | P0 |
| `useISLConformal` | `/api/v1/robustness/conformal` | `enrichment.conformal` | P1 |
| `useISLValidation` | `/api/v1/graph/validate` | `enrichment.causal_validation` | P2 |
| `useISLComparison` | `/api/v1/scenarios/compare` | N/A (may remain direct) | P3 |

### ISL Calls to Keep Direct (Phase 2)

These hooks may remain as direct ISL calls (background/advanced features):

| Hook | ISL Endpoint | Reason |
|------|--------------|--------|
| `useContrastiveExplanation` | `/api/v1/causal/contrastive` | Phase 2 feature, low usage |
| `useTransportability` | `/api/v1/causal/transportability` | Phase 2 feature, low usage |

### Components That Consume ISL Data

| Component | Data Source Hook | Changes Required |
|-----------|------------------|------------------|
| `KeyDriversPanel` | `useRobustness` | Switch to `getRobustnessData()` |
| `RobustnessIndicator` | `useRobustness` | Switch to `getRobustnessData()` |
| `SensitivityList` | `useRobustness` | No change (receives data as prop) |
| `ValueOfInformationList` | `useRobustness` | No change (receives data as prop) |
| `RecommendationCard` | `useRobustness` | Switch to `getRobustnessData()` |

## Feature Flag Configuration

### Flag Definition

```typescript
// src/flags.ts
plotEnrichment: {
  envKey: 'VITE_USE_PLOT_ENRICHMENT',
  storageKey: 'feature.plotEnrichment',
}
```

### Environment Configuration

| Environment | Flag Value | Behavior |
|-------------|------------|----------|
| Local Dev | `0` (default) | Direct ISL calls |
| Staging | `0` → `1` (phased) | Test enrichment routing |
| Production | `0` (until verified) | Direct ISL calls |

### localStorage Override

Developers can override the flag per-browser:
```javascript
localStorage.setItem('feature.plotEnrichment', '1')  // Enable
localStorage.setItem('feature.plotEnrichment', '0')  // Disable
```

## Rollout Plan

### Phase 1A: Preparation (Current)

1. ✅ Audit all ISL calls (documented in `/docs/ISL_CALL_AUDIT.md`)
2. ✅ Create feature flag `VITE_USE_PLOT_ENRICHMENT`
3. ✅ Create enrichment types and adapters (`src/adapters/plot/enrichment.ts`)
4. ✅ Create graceful degradation tests
5. ✅ Document migration plan (this document)

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No runtime errors with flag disabled
- [ ] Enrichment adapters correctly fall back to ISL

### Phase 1B: Backend Integration

**Prerequisites:**
- PLoT backend must add `enrichment` field to `/v1/run` response
- Enrichment schema must be documented

**Tasks:**
1. Coordinate enrichment schema with backend team
2. Update `isValidRobustnessShape()` with actual schema
3. Implement `adaptRobustnessFromEnrichment()` with real transformation
4. Test with staging PLoT API

### Phase 1C: Hook Migration

**For each hook in consolidation list:**

1. Import `getRobustnessData` from `src/adapters/plot/enrichment`
2. Modify hook to check enrichment first
3. Fall back to direct ISL if enrichment missing
4. Add telemetry to track which path is used

**Example Migration (useRobustness):**

```typescript
// Before
const response = await fetch('/bff/isl/api/v1/analysis/robustness', ...)
const result = adaptISLRobustnessResponse(data)

// After
const result = await getRobustnessData({
  plotResponse,  // From parent context
  fetchFromISL: async () => {
    const response = await fetch('/bff/isl/api/v1/analysis/robustness', ...)
    return adaptISLRobustnessResponse(await response.json())
  }
})
```

### Phase 1D: Staging Verification

1. Enable flag on staging: `VITE_USE_PLOT_ENRICHMENT=1`
2. Run smoke tests
3. Compare results with direct ISL calls
4. Monitor for errors/anomalies
5. If issues: disable flag and investigate

### Phase 1E: Production Rollout

1. Enable for 10% of users (if supported)
2. Monitor error rates and user feedback
3. Gradually increase to 100%
4. After 2 weeks stable: remove direct ISL code paths

## Rollback Procedure

### Immediate Rollback (< 5 minutes)

If critical issues are discovered:

1. **Disable feature flag:**
   ```bash
   # Netlify/Vercel: Update environment variable
   VITE_USE_PLOT_ENRICHMENT=0
   ```

2. **Trigger redeploy** or users can self-rollback:
   ```javascript
   localStorage.setItem('feature.plotEnrichment', '0')
   location.reload()
   ```

### Code Rollback

If flag-based rollback isn't sufficient:

1. Revert commits that modified ISL hooks
2. Keep enrichment adapters (they're safe when flag disabled)
3. Investigate root cause before re-attempting

### Indicators to Roll Back

- **Error rate spike** (> 1% of requests failing)
- **Inconsistent results** (robustness differs significantly)
- **Performance degradation** (> 2x latency)
- **Missing data** (sensitivity/VOI not showing)

## Monitoring

### Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Enrichment extraction success rate | Console logs | < 99% |
| ISL fallback rate | Console logs | > 10% |
| API error rate | Sentry | > 1% |
| Latency (PLoT + enrichment) | PostHog | > 5s |

### Debug Logging

When `import.meta.env.DEV` is true, adapters log:
- `[PLoT Enrichment] Using robustness data from PLoT enrichment`
- `[PLoT Enrichment] Enrichment not available, falling back to ISL`

## Testing Strategy

### Unit Tests

Location: `src/adapters/plot/__tests__/enrichment.spec.ts`

- Type guard correctness
- Adapter graceful degradation
- Feature flag behavior
- Malformed data handling

### Integration Tests

1. **Flag disabled**: Verify ISL calls still work
2. **Flag enabled, no enrichment**: Verify ISL fallback
3. **Flag enabled, with enrichment**: Verify extraction works
4. **Malformed enrichment**: Verify fallback triggered

### E2E Tests

1. Run full analysis flow with flag disabled
2. Run full analysis flow with flag enabled (mock enrichment)
3. Verify KeyDriversPanel shows same data

## Dependencies

### Backend Requirements

- PLoT API must support `?include_enrichment=true` query param
- Enrichment response must include:
  - `sensitivity_analysis` (robustness label, edge sensitivities, VOI)
  - `causal_validation` (identifiability, suggestions)
  - `metadata` (ISL enabled flag, detail level, latency)
  - Optional: `conformal` (Phase 2)

### Schema Documentation

When PLoT enrichment schema is finalized, update:
1. `PLoTEnrichmentRaw` interface in `enrichment.ts`
2. `isValidRobustnessShape()` validation logic
3. `adaptRobustnessFromEnrichment()` transformation logic

## Timeline

| Phase | Status | Dependencies |
|-------|--------|--------------|
| Phase 1A: Preparation | ✅ Complete | None |
| Phase 1B: Hook Migration | ✅ Partial (robustness/validation) | None |
| Phase 1C: Backend Wiring | ✅ Complete | PLoT API enrichment |
| Phase 1D: Staging Verification | Pending | Phase 1C |
| Phase 1E: Production Rollout | Pending | Phase 1D |

**Note:** Phase 1B is partial - only `useRobustness` and `useISLValidation` are gated.
Other hooks (`useISLConformal`, `useISLComparison`, etc.) remain direct ISL calls by design.

---

**Last Updated:** Phase 1B partial completion (robustness/validation only)
**Author:** Claude Code
**Related Docs:**
- [ISL Call Audit](./ISL_CALL_AUDIT.md)
- [Backend Integration Requirements](./PENG_INTEGRATION_REQUIREMENTS.md)
