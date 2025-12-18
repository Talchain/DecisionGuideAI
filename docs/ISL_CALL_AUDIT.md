# ISL Direct Call Audit

**Date:** 2025-12-18
**Purpose:** Inventory of all direct ISL calls for routing consolidation (Phase 1A/1B)

## Phase 1B Status: PARTIAL (Robustness/Validation Only)

Phase 1B routing consolidation has been implemented for core analysis hooks:

- **Flag:** `VITE_USE_PLOT_ENRICHMENT` controls routing behavior
- **When enabled:** Robustness/validation read from PLoT enrichment
- **When disabled:** Legacy ISL calls continue (backward compatible)
- **Graceful degradation:** Falls back to stub/fallback data if enrichment unavailable

### Gated Hooks (use enrichment when flag enabled)

| Hook | Status | Notes |
|------|--------|-------|
| `useRobustness` | ✅ Gated | Reads from `store.results.enrichment.sensitivity_analysis` |
| `useISLValidation` | ✅ Gated | Reads from `store.results.enrichment.causal_validation` |

### Ungated Hooks (always call ISL directly - by design)

These hooks are intentionally NOT gated. They represent separate features that don't have
corresponding PLoT enrichment support yet:

| Hook | Status | Notes |
|------|--------|-------|
| `useISLConformal` | Direct ISL | Conformal prediction - separate feature |
| `useISLComparison` | Direct ISL | Scenario comparison - separate feature |
| `useContrastiveExplanation` | Direct ISL | Explanation generation - Phase 2 feature |
| `useTransportability` | Direct ISL | Transportability checks - Phase 2 feature |

**Note:** When `VITE_USE_PLOT_ENRICHMENT=1`, only robustness and validation consume from
enrichment. Other hooks continue to call ISL directly (this is intentional).

---

## Overview

The UI currently calls ISL directly for robustness/sensitivity analysis, creating a parallel pipeline alongside PLoT. This audit documents all ISL call sites for consolidation.

## Direct ISL Call Inventory

### User-Visible Results (Must Consolidate)

These calls render data directly to users and must be consolidated to consume from PLoT enrichment.

#### 1. useRobustness

| Property | Value |
|----------|-------|
| **File** | [src/canvas/hooks/useRobustness.ts](../src/canvas/hooks/useRobustness.ts) |
| **Endpoint (v1)** | `POST /bff/isl/api/v1/analysis/robustness` |
| **Endpoint (v2)** | `POST /bff/isl/api/v1/robustness/analyze/v2` |
| **Request Schema** | `ISLRobustnessRequest` (graph, options, utility, parameter_uncertainties) |
| **Response Schema** | `ISLRobustnessResponse` → adapted to `RobustnessResult` |
| **Category** | **USER-VISIBLE** |

**Data Returned:**
- Robustness classification (robust/moderate/fragile)
- Sensitive parameters with flip thresholds
- Value of Information suggestions
- Pareto analysis for multi-goal decisions

**UI Components Consuming This Data:**
- `RecommendationCard/index.tsx:147` - Main recommendation display
- `OutputsDock.tsx:158` - Side panel robustness section
- `KeyDriversPanel.tsx` - Sensitivity and VOI lists
- `SensitivityList.tsx` - Sensitive parameter display
- `ValueOfInformationList.tsx` - VOI suggestions
- `TippingPointsList.tsx` - Tipping points display
- `RobustnessIndicator.tsx` - Visual robustness badge

---

#### 2. useISLConformal

| Property | Value |
|----------|-------|
| **File** | [src/hooks/useISLConformal.ts](../src/hooks/useISLConformal.ts) |
| **Endpoint** | `POST /bff/isl/api/v1/causal/counterfactual/conformal` |
| **Request Schema** | `ISLConformalRequest` (model, intervention, calibration_data, confidence_level) |
| **Response Schema** | `ISLConformalResponse` |
| **Category** | **USER-VISIBLE** |

**Data Returned:**
- Conformal predictions with confidence intervals
- Prediction bounds

**UI Components Consuming This Data:**
- `ConformalPrediction.tsx:3` - Conformal interval display
- `DecisionSummary.tsx:26` - Summary with confidence
- `ThresholdDisplay.tsx:30` - Threshold visualization
- `DriversSignal.tsx:38` - Key drivers with confidence

---

#### 3. useISLValidation

| Property | Value |
|----------|-------|
| **File** | [src/hooks/useISLValidation.ts](../src/hooks/useISLValidation.ts) |
| **Endpoint** | `POST /bff/isl/validate` |
| **Request Schema** | `ISLRunRequest` |
| **Response Schema** | `ISLValidationResponse` |
| **Category** | **USER-VISIBLE** |

**Data Returned:**
- Validation suggestions for graph structure
- Weight recommendations

**UI Components Consuming This Data:**
- `ValidationSuggestions.tsx:3` - Validation suggestion cards
- `BaseNode.tsx:20` - Node-level validation indicators

---

#### 4. useISLComparison

| Property | Value |
|----------|-------|
| **File** | [src/hooks/useISLComparison.ts](../src/hooks/useISLComparison.ts) |
| **Endpoint** | `POST /bff/isl/compare` |
| **Request Schema** | `ISLRunRequest` |
| **Response Schema** | `ISLComparisonResponse` |
| **Category** | **USER-VISIBLE** |

**Data Returned:**
- Scenario comparison results
- Ranking differences

**UI Components Consuming This Data:**
- `ComparisonTable.tsx:3` - Side-by-side scenario comparison
- `useScenarioComparison.ts:13` - Scenario comparison hook

---

### Background/Diagnostic (May Remain Direct)

These are Phase 2 features or internal diagnostics that may not need consolidation.

#### 5. useContrastiveExplanation

| Property | Value |
|----------|-------|
| **File** | [src/hooks/useContrastiveExplanation.ts](../src/hooks/useContrastiveExplanation.ts) |
| **Endpoint** | `POST /bff/isl/explain/contrastive` |
| **Category** | **BACKGROUND** - Phase 2 Goal Mode feature |

---

#### 6. useTransportability

| Property | Value |
|----------|-------|
| **File** | [src/hooks/useTransportability.ts](../src/hooks/useTransportability.ts) |
| **Endpoint** | `POST /bff/isl/transport` |
| **Category** | **BACKGROUND** - Phase 2 feature |

---

### Not ISL (Out of Scope)

These hooks were audited but do NOT call ISL directly:

| Hook | Actual Endpoint | Notes |
|------|-----------------|-------|
| `useISLSynthesis` | `/bff/cee/isl-synthesis` | Calls CEE, not ISL |
| `useConditionalRecommendations` | `/bff/engine/v1/analysis/conditional-recommend` | Calls PLoT |
| `useSequentialAnalysis` | `/bff/engine/v1/analysis/sequential` | Calls PLoT |

---

## ISLClient Methods

The `ISLClient` class in [src/adapters/isl/client.ts](../src/adapters/isl/client.ts) provides these methods:

| Method | Endpoint | Used By |
|--------|----------|---------|
| `validate()` | `/validate` | useISLValidation |
| `robustnessAnalyze()` | `/api/v1/robustness/analyze` | useRobustness (via direct fetch) |
| `conformalPredict()` | `/api/v1/causal/counterfactual/conformal` | useISLConformal |
| `conformal()` | `/conformal` | (deprecated) |
| `compare()` | `/compare` | useISLComparison |
| `contrastiveExplanation()` | `/explain/contrastive` | useContrastiveExplanation |
| `checkTransportability()` | `/transport` | useTransportability |

---

## BFF/Proxy Routes

### Netlify (Production)

```toml
# netlify.toml
[[redirects]]
from = "/bff/isl/*"
to = "https://isl-staging.onrender.com/:splat"
status = 200
```

### Vite Dev Proxy

```typescript
// vite.config.ts
'/bff/isl': {
  target: env.ISL_SERVICE_URL || 'https://isl-staging.onrender.com',
  // ...
}
```

---

## Consolidation Summary

### Must Consolidate (4 hooks)

| Priority | Hook | Primary UI Impact |
|----------|------|-------------------|
| **P0** | useRobustness | RecommendationCard, KeyDriversPanel |
| **P1** | useISLConformal | ConformalPrediction, DriversSignal |
| **P2** | useISLValidation | ValidationSuggestions |
| **P2** | useISLComparison | ComparisonTable |

### May Remain Direct (2 hooks)

| Hook | Reason |
|------|--------|
| useContrastiveExplanation | Phase 2 feature, not yet in use |
| useTransportability | Phase 2 feature, not yet in use |

---

## Implementation Summary (Phase 1B)

### Completed Steps

1. ✅ Created feature flag `VITE_USE_PLOT_ENRICHMENT` in [src/flags.ts](../src/flags.ts)
2. ✅ Defined `PLoTEnrichment` types in [src/adapters/plot/enrichment.ts](../src/adapters/plot/enrichment.ts)
3. ✅ Updated `useRobustness` and `useISLValidation` to consume from PLoT enrichment
4. ✅ Implemented graceful degradation with fallback data
5. ✅ When flag enabled, NO direct ISL calls for robustness/validation
6. ✅ Added integration tests for flag-enabled behavior
7. ✅ Added flag to `netlify.toml` (disabled by default for safe rollout)
8. ✅ Wired enrichment from PLoT response into store (`resultsComplete` action)
9. ✅ Added `PLoTDoneData` type to PLoT types for enrichment field

### Rollout Instructions

1. Deploy to staging with flag disabled (current state)
2. Enable flag via Netlify dashboard: `VITE_USE_PLOT_ENRICHMENT=1`
3. Monitor PostHog/Sentry for errors
4. Verify `results.enrichment` is populated in React DevTools
5. Verify robustness/validation panels show enrichment data, not fallback
6. If issues, disable flag immediately (instant rollback)
7. Once stable, enable in production

### Files Changed

- `src/flags.ts` - Added `plotEnrichment` flag
- `src/adapters/plot/types.ts` - Added `PLoTDoneData` interface with enrichment field
- `src/adapters/plot/enrichment.ts` - PLoT enrichment types, adapters, strengthened guards
- `src/canvas/hooks/useRobustness.ts` - Enrichment routing
- `src/canvas/hooks/useResultsRun.ts` - Extract and pass enrichment to store
- `src/hooks/useISLValidation.ts` - Enrichment routing, fixed fallback type
- `src/canvas/store.ts` - Added `enrichment` to `ResultsState` and `resultsComplete`
- `netlify.toml` - Added flag configuration
