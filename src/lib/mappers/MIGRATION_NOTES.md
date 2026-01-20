# Results Pipeline Migration Notes

This document tracks transforms currently in the UI that should migrate to PLoT (the engine), and fallback logic that should become PLoT's responsibility.

## Migration Target

**Long-term architecture**: PLoT becomes the boundary authority for all semantic transforms. UI receives a canonical shape and does presentation only.

## Current Status

The `src/lib/mappers/` module provides typed domain mappers that:
- Select data source with deterministic precedence
- Map raw response fields to canonical types
- Track fallbacks applied for debugging

**These mappers are ready for integration with `responseMapper.ts`.**

---

## Transforms to Migrate to PLoT (Post-Pilot)

### 1. Factor Influence Calculation

**Location**: `mapFactorSensitivity.ts` → `getRawInfluence()`

**Current Logic**:
```typescript
// Fallback chain for influence value:
// elasticity → sensitivity_score → sensitivity → importance_score → 0
```

**Why Move to PLoT**:
- Engine should provide a single canonical `influence` field
- Eliminates need for UI fallback logic
- Prevents "0 blocks fallback" regression class at source

**Migration**:
- PLoT to compute and return `factor.influence` directly
- UI removes fallback chain, uses `factor.influence` only

---

### 2. Confidence Scaling (VOI → Percentage)

**Location**: `mapFactorSensitivity.ts` → `getConfidence()`

**Current Logic**:
```typescript
// value_of_information (0-1) → confidence (0-100)
const confidence = voi !== undefined ? Math.round(voi * 100) : undefined
```

**Why Move to PLoT**:
- Scaling is a presentation concern but applied universally
- Engine should return display-ready values
- Reduces risk of inconsistent scaling

**Migration**:
- PLoT to return `factor.confidence` as 0-100 percentage
- UI uses value directly without scaling

---

### 3. Direction Normalisation

**Location**: `utils.ts` → `normaliseDirection()`

**Current Logic**:
```typescript
// Handles: 'positive', 'POSITIVE', 'pos', '+', 'increase', 'up' → 'positive'
// Handles: 'negative', 'NEGATIVE', 'neg', '-', 'decrease', 'down' → 'negative'
```

**Why Move to PLoT**:
- Multiple direction representations exist due to legacy data
- Engine should emit canonical enum values only

**Migration**:
- PLoT to always return `'positive' | 'negative'`
- UI removes normalisation, uses value directly

---

### 4. Outcome Distribution Extraction

**Location**: `mapOptionComparison.ts` → `getOutcome()`

**Current Logic**:
```typescript
// Checks nested outcome object, then falls back to flat fields
// Handles both: { outcome: { expected, p10, p50, p90 } } and { expected, p10, p50, p90 }
```

**Why Move to PLoT**:
- Dual format exists due to API evolution
- Engine should emit single consistent format

**Migration**:
- PLoT to always return nested `option.outcome` object
- UI removes flat field fallback

---

## Fallback Logic to Migrate

### 1. Data Source Selection

**Location**: `selectDataSource.ts`

**Current Precedence**:
1. `downstream_calls.isl.response.factor_sensitivity`
2. `enrichment.sensitivity_analysis.factors`
3. `factor_sensitivity` (top-level)
4. `none` (empty result)

**Why Exists**:
- ISL deep mode returns data in different locations
- Top-level may contain placeholder data

**Migration**:
- PLoT to always return data in consistent location
- Source selection becomes unnecessary
- Track via `_meta.sourcePath` becomes `_meta.analysisMode`

---

### 2. Robustness Fallback

**Location**: `selectDataSource.ts`

**Current Logic**:
```typescript
// If ISL lacks robustness, fall back to top-level
if (!hasValidRobustness(downstreamRobustness)) {
  robustness = extractTopLevelRobustness(response)
  fallbacksApplied.push('ROBUSTNESS_FROM_TOP_LEVEL')
}
```

**Why Exists**:
- ISL may not always compute robustness
- Top-level may have legacy robustness data

**Migration**:
- PLoT to always include robustness in response
- Fallback logic becomes unnecessary

---

### 3. Field Alias Resolution

**Location**: All mappers

**Current Pattern**:
```typescript
// Handle both snake_case and camelCase
const fromId = firstDefined(
  edge.from_id,
  edge.fromId,
  edge.source
)
```

**Why Exists**:
- Historical API changes left multiple field names
- Different sources use different conventions

**Migration**:
- PLoT to emit consistent field names (prefer snake_case)
- UI removes alias resolution

---

## Semantic Repairs in Mappers

### 1. Empty String → Undefined

**Location**: `utils.ts` → `emptyToUndefined()`

Labels that are empty strings or whitespace-only are converted to `undefined` for consistent "missing" handling in UI components.

**Recommendation**: PLoT should never emit empty string labels.

---

### 2. Placeholder Zero Detection

**Location**: `mapFactorSensitivity.ts` → `getRawInfluence()`

When `sensitivity_score = 0` but `importance_score > 0`, the zero is treated as a placeholder and skipped.

**Recommendation**: PLoT should not emit placeholder zeros; use `null` or omit field.

---

### 3. Switch Probability Semantics

**Location**: `mapRobustness.ts`

`switch_probability` is passed through directly as flip probability. The UI previously inverted this value (showed `1 - switch_probability`), which was a bug.

**Current Contract**:
- `switch_probability = 0.25` → "25% chance this could flip"
- Higher value = higher flip risk

---

## Design Decisions (Backwards Compatibility)

These design choices match the existing `useResultsSectionData.ts` behavior to ensure backwards compatibility during the transition period.

### 1. Raw Influence Values (No Scaling)

**Decision**: `rawInfluence` returns the raw value from the fallback chain without normalisation.

**Why**: The existing code in `useResultsSectionData.ts` normalises influence values downstream via `computeNormalisedInfluences()`. Scaling at the mapper level would double-scale values.

**Contract**:
- `rawInfluence` = elasticity ?? sensitivity_score ?? sensitivity ?? importance_score ?? 0
- Normalisation happens in the UI layer, not the mapper

---

### 2. Robustness Is Optional

**Decision**: Mappers return empty/undefined robustness when source data is missing.

**Why**: The existing code handles missing robustness gracefully. Some analysis modes don't compute robustness at all.

**Contract**:
- `mapRobustness(undefined)` returns `{ fragileEdges: [], robustEdges: [], level: undefined, ... }`
- UI components conditionally render robustness sections

---

### 3. Zero Threshold for Placeholder Detection

**Decision**: `hasRealData` checks use `> 0.001` threshold to detect placeholder zeros.

**Why**: PLoT sometimes emits `sensitivity_score: 0` as a placeholder when `importance_score` has the real value. The threshold prevents these placeholders from blocking the fallback chain.

**Contract**:
- `sensitivity_score: 0` + `importance_score: 0.9` → uses `importance_score` (placeholder detected)
- `sensitivity_score: 0` + `importance_score: 0` → uses `0` (real zero preserved)

---

### 4. Confidence Scale (0-100)

**Decision**: `confidence` is scaled to 0-100 percentage from `value_of_information` (0-1).

**Why**: Matches the existing UI expectation. The scaling `Math.round(voi * 100)` is applied at the mapper level.

**Contract**:
- `value_of_information: 0.7` → `confidence: 70`
- `value_of_information: undefined` → `confidence: undefined` (NOT 0)

---

## Testing Contracts

All semantic contracts are tested in `src/lib/mappers/__tests__/`:

| Test File | Coverage |
|-----------|----------|
| `utils.spec.ts` | Boundary parse functions, zero preservation |
| `selectDataSource.spec.ts` | Source precedence, fallback tracking |
| `mapFactorSensitivity.spec.ts` | Influence extraction, VOI→confidence, direction |
| `mapRobustness.spec.ts` | Switch probability (no inversion), edge labels |

**Total: 95 tests** covering regression prevention and semantic contracts.

---

## Integration Status

| Phase | Status | Notes |
|-------|--------|-------|
| Types & Utils | ✅ Complete | `types.ts`, `utils.ts` |
| Data Source Selection | ✅ Complete | `selectDataSource.ts` |
| Factor Mapper | ✅ Complete | `mapFactorSensitivity.ts` |
| Robustness Mapper | ✅ Complete | `mapRobustness.ts` |
| Option Mapper | ✅ Complete | `mapOptionComparison.ts` |
| Orchestrator | ✅ Complete | `index.ts` |
| responseMapper Integration | 🔄 Pending | Keep as thin adapter during transition |
| Contract Tests | ✅ Complete | 95 tests |

---

## Next Steps

1. **Phase 5**: Integrate mappers into `responseMapper.ts`
   - Import `mapPloTResponse` from `@/lib/mappers`
   - Replace inline mapping logic with orchestrator calls
   - Verify all 252+ tests pass

2. **Post-Pilot**: Coordinate with PLoT team on:
   - Canonical field names (eliminate aliases)
   - Pre-computed display values (influence, confidence as percentages)
   - Single data source location (eliminate precedence logic)
   - Removal of placeholder zeros
