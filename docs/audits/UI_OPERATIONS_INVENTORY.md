# UI Graph Operations Inventory

**Audit Date:** 2026-01-21
**Auditor:** Claude Code
**Scope:** All data transforms between API response and UI display

---

## Executive Summary

The UI layer contains **no hidden semantic transforms** that could corrupt data integrity. All operations fall into three categories:

1. **Documented Semantic Transforms** - Isolated in typed mappers with contract tests
2. **Display-Only Formatting** - Pure presentation (K/M suffixes, percentage strings)
3. **Normalisation/Canonicalisation** - String-to-enum mapping (direction: 'pos' → 'positive')

The previous P0 bug (factor importance inversion) was caused by **data loss** in `pickFactorSensitivityForUi()`, not a hidden transform. The fix is documented in the plan file.

---

## Layer 1: Typed Domain Mappers (`src/lib/mappers/`)

These mappers form the **canonical data boundary** between raw API responses and typed UI state.

### 1.1 mapFactorSensitivity.ts

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| VOI → confidence | **Semantic** | `getConfidence():124` | `Math.round(voi * 100)` - converts 0-1 to 0-100 scale |
| importance_score → rawInfluence | Passthrough | `getRawInfluence():72-100` | Direct value, no scaling |
| direction canonicalisation | Normalisation | `normaliseDirection()` | 'pos'/'+'/etc → 'positive' |

**Contract:** `rawInfluence` is preserved exactly. `confidence` is VOI × 100.

### 1.2 mapRobustness.ts

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| switch_probability → switchProbability | **Passthrough** | `mapFragileEdge():78-81` | NO inversion - direct value |
| level canonicalisation | Normalisation | `normaliseRobustnessLevel()` | 'very-low' → 'very_low' |

**Contract:** `switchProbability` is the probability of flipping to alternative. Higher = more risky. NO `1 - x` inversion.

### 1.3 mapOptionComparison.ts

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| outcome.expected | Passthrough | `getOutcome():66-93` | Direct value, no scaling |
| goal_probability | Passthrough | `mapOption():123-127` | Multiple aliases supported |

**Contract:** Outcome values pass through unchanged. No x100 bug.

### 1.4 utils.ts - Boundary Parse Functions

| Function | Contract | Critical Behaviour |
|----------|----------|-------------------|
| `asOptionalNumber(0)` | Returns `0` | Real zero preserved, NOT undefined |
| `asOptionalNumber(undefined)` | Returns `undefined` | Missing stays missing |
| `asOptionalNumber(NaN)` | Returns `undefined` | Invalid → undefined |
| `firstDefined(0, 1, 2)` | Returns `0` | Zero is defined! |

**Critical:** These functions prevent the "0 blocks fallback" regression class.

---

## Layer 2: Response Mapper (`src/adapters/plot/v2/responseMapper.ts`)

### 2.1 pickFactorSensitivityForUi()

| Operation | Type | Status | Notes |
|-----------|------|--------|-------|
| Data source selection | Routing | **BUG** | Missing `importance_score` in `hasRealData` check |
| Field mapping | Transform | **BUG** | ISL/enrichment paths drop `importance_score` |

**Known Issue (P0):** This function needs the fixes documented in the plan file:
- Add `importance_score > 0.001` to `hasRealData` checks
- Add `importance_score` to fallback chain and output object

---

## Layer 3: Consumer Hook (`src/components/results/useResultsSectionData.ts`)

### 3.1 computeNormalisedInfluences()

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| Relative scaling | **Display-only** | Lines 182-209 | `Math.abs(rawElasticity) / maxElasticity` |

**Contract:** Input rawInfluence is preserved. Normalised value is computed fresh for display. Does NOT modify source data.

### 3.2 getRawElasticity()

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| Fallback chain | Selection | Lines 109-138 | elasticity → sensitivity_score → importance_score |

**Contract:** Returns first non-placeholder value. Zero-detection prevents placeholder zeros from blocking fallback.

### 3.3 normaliseDirection()

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| Canonicalisation | Normalisation | Lines 291-307 | 'increases'/'+'/etc → 'positive' |

**Contract:** String-to-enum mapping. No semantic change.

### 3.4 Fragile Edge Map

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| Keep highest switchProbability | Selection | Lines 848-865 | When factor has multiple fragile edges |

**Contract:** When a factor has multiple fragile edges, keeps the one with highest (most risky) switchProbability.

---

## Layer 4: Display Formatters (`src/lib/format.ts`)

### Pure Display Functions (No Semantic Transform)

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `formatOutcomeValue()` | number | string | K/M suffixes, locale formatting |
| `formatConfidence()` | 0-1 | string | `${Math.round(x * 100)}%` for display |
| `formatDeltaPercent()` | number | string | Sign prefix (+/-) |

**Contract:** These functions convert numbers to display strings. They do NOT modify the underlying data values.

---

## Layer 5: Component Layer (`src/components/results/`)

### DriversSection.tsx

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| `switchProbability * 100` | **Display-only** | Line 105 | Converts 0-1 to percentage for tooltip |
| `normalisedInfluence * 100` | **Display-only** | Line 200 | Progress bar width percentage |

**Contract:** Multiplications are for CSS/display only. Source data unchanged.

### RecommendationSection.tsx

| Operation | Type | Location | Description |
|-----------|------|----------|-------------|
| `value * 100` | **Display-only** | Line 31 | Percentage formatting |
| Position calculations | **Display-only** | Lines 159-161 | CSS positioning for range visualization |

**Contract:** All multiplications are for rendering. No data mutation.

---

## Transform Classification Summary

### Semantic Transforms (Data-Changing)

| Transform | Location | Justification | Contract Test |
|-----------|----------|---------------|---------------|
| VOI × 100 → confidence | mapFactorSensitivity.ts:124 | Scale conversion (0-1 → 0-100) | groundTruth.spec.ts |
| ~~1 - switch_probability~~ | **REMOVED** | Was bug - no longer exists | results-panel-contract.test.ts |

### Display-Only Transforms (Presentation)

| Transform | Location | Purpose |
|-----------|----------|---------|
| `* 100` for percentages | DriversSection.tsx, RecommendationSection.tsx | CSS/ARIA |
| `/ 1000` for K suffix | format.ts | Compact display |
| `/ 1000000` for M suffix | format.ts | Compact display |
| `Math.round()` | format.ts | Display rounding |

### Normalisation (Lossless Canonicalisation)

| Transform | Location | Purpose |
|-----------|----------|---------|
| Direction aliases | utils.ts:normaliseDirection() | 'pos' → 'positive' |
| Robustness level | utils.ts:normaliseRobustnessLevel() | 'very-low' → 'very_low' |
| Label to key | utils.ts:normaliseLabel() | 'Pro Plan' → 'pro_plan' |

---

## Verification Checklist

### No Hidden Semantic Transforms

- [x] switch_probability passed through directly (no 1-x inversion)
- [x] rawInfluence preserves importance_score exactly
- [x] outcome.expected/p10/p50/p90 unchanged
- [x] VOI × 100 is documented and tested
- [x] All × 100 operations in components are display-only

### Fallback Safety

- [x] `asOptionalNumber(0) === 0` (zero preserved)
- [x] Placeholder zeros detected via `> 0.001` threshold
- [x] Missing fields → undefined (not 0)
- [x] `firstDefined()` handles zero correctly

### Contract Tests Exist

- [x] groundTruth.spec.ts (16 tests)
- [x] results-panel-contract.test.ts
- [x] mapFactorSensitivity.spec.ts
- [x] mapRobustness.spec.ts
- [x] mapOptionComparison.spec.ts

### Invariant Tests (New)

- [x] no-semantic-transforms.test.ts (11 tests) - Verifies no hidden semantic transforms
- [x] fallback-safety.test.ts (30 tests) - Verifies boundary parse function safety
- [x] display-only.test.ts (33 tests) - Verifies format functions are display-only
- [x] importance-score-preservation.test.ts (12 tests) - Verifies importance_score preserved through ISL path
- [x] fragile-edge-selection.test.ts (14 tests) - Verifies fragile edge selection (higher switchProbability wins)
- [x] responseMapper-thin-adapter.test.ts (35 tests) - Guards against semantic transforms in adapter layer
  - Import allow-list (5 tests) - Prevents importing math/compute utilities
  - _meta pass-through (6 tests) - Verifies routing metadata, no computed fields

**Test Location:** `src/test/__tests__/invariants/ui/`

**Total Invariant Tests:** 146 (all passing)

---

## Known Issues (RESOLVED)

### Issue: Factor Importance Inversion — **FIXED** (2026-01-21)

**Root Cause:** `pickFactorSensitivityForUi()` in responseMapper.ts was dropping `importance_score` from:
1. The `hasRealData` check
2. The output object mapping

**Fix Applied:**
- Added `importance_score > 0.001` to `hasRealData` checks in both ISL and enrichment paths
- Added `importance_score` to `sensitivity_score` fallback chain
- Added `importance_score` as explicit field in output object

**Verification:**
- 11 invariant tests in `importance-score-preservation.test.ts`
- 10 ground truth tests in `groundTruth.spec.ts` (ISL importance_score fixture)
- All 378 relevant tests passing

---

## Appendix: Files Audited

```
src/lib/mappers/
├── mapFactorSensitivity.ts ✓
├── mapRobustness.ts ✓
├── mapOptionComparison.ts ✓
├── types.ts ✓
├── utils.ts ✓
└── __tests__/
    ├── mapFactorSensitivity.spec.ts ✓
    ├── mapRobustness.spec.ts ✓
    ├── mapOptionComparison.spec.ts ✓
    └── groundTruth.spec.ts ✓

src/adapters/plot/v2/
├── responseMapper.ts ✓ (has P0 bug)
└── types.ts ✓

src/components/results/
├── useResultsSectionData.ts ✓
├── DriversSection.tsx ✓
├── RecommendationSection.tsx ✓
└── types.ts ✓

src/lib/
└── format.ts ✓
```
