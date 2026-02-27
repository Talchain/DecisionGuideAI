# UI Semantic Transforms Audit

**Date:** 2026-01-25
**Status:** Complete
**Auditor:** Claude Code

---

## Summary

**13 semantic transforms found** across the data pipeline. 5 high-severity transforms affect user guidance logic.

### Transform Classification

| Severity | Count | Description |
|----------|-------|-------------|
| High | 5 | Semantic transforms affecting user guidance logic |
| Medium | 5 | Semantic transforms with cosmetic impact |
| Low | 3 | Presentation-only formatting |

---

## High Severity Findings (Affects User Guidance Logic)

### Finding 1: Fragile Edge Severity Derivation

- **File:** [useResultsSectionData.ts:1286-1294](src/components/results/useResultsSectionData.ts#L1286-L1294)
- **Code:**
  ```typescript
  let severity: 'blocker' | 'error' | 'warning' = 'warning'
  const flipProbability = fe.marginal_switch_probability ?? fe.switch_probability
  if (typeof flipProbability === 'number') {
    if (flipProbability > 0.7) {
      severity = 'blocker'
    } else if (flipProbability > 0.5) {
      severity = 'error'
    }
  }
  ```
- **Type:** Semantic
- **Impact:** High
- **Affects user guidance logic?** Yes - determines how urgently users should investigate fragile edges
- **Recommendation:** Move to PLoT. ISL/PLoT should provide `severity` or `urgency` directly based on model confidence, not UI-defined thresholds.

---

### Finding 2: Fragile Edge Filter Threshold

- **File:** [useResultsSectionData.ts:1154-1163](src/components/results/useResultsSectionData.ts#L1154-L1163)
- **Code:**
  ```typescript
  .filter((fe: any) => {
    const flipProb = fe.marginal_switch_probability ?? fe.switch_probability
    if (typeof flipProb === 'number') {
      return flipProb > 0.3
    }
    return true
  })
  ```
- **Type:** Semantic
- **Impact:** High
- **Affects user guidance logic?** Yes - determines which fragile edges are shown/hidden from users
- **Recommendation:** Move to PLoT. API should return only edges that need attention, or include `should_display: boolean`.

---

### Finding 3: VOI-Based Evidence Warning Threshold

- **File:** [DriversSection.tsx:142](src/components/results/DriversSection.tsx#L142)
- **Code:**
  ```typescript
  const showQualityHint = typeof driver.valueOfInformation === 'number'
    && driver.valueOfInformation > 0.05
  ```
- **Type:** Semantic
- **Impact:** High
- **Affects user guidance logic?** Yes - "Could benefit from more evidence" guidance shown/hidden based on UI threshold
- **Recommendation:** Move to PLoT. API should provide `needs_more_evidence: boolean` or guidance text.

---

### Finding 4: Confidence Tier Mapping

- **File:** [useResultsSectionData.ts:423-483](src/components/results/useResultsSectionData.ts#L423-L483)
- **Code:**
  ```typescript
  function mapReadinessLevel(level: string): ConfidenceTier {
    const mapping: Record<string, ConfidenceTier> = {
      ready: 'strong',
      fair: 'fair',
      needs_work: 'needs_work',
      caution: 'fair',  // SEMANTIC: 'caution' → 'fair'
      not_ready: 'needs_work',
    }
    return mapping[level.toLowerCase()] ?? 'unknown'
  }

  // Also: score-based tier derivation (lines 464-480)
  if (graphReadiness.readiness_score >= 70) return 'strong'
  if (graphReadiness.readiness_score >= 40) return 'fair'
  return 'needs_work'
  ```
- **Type:** Semantic
- **Impact:** High
- **Affects user guidance logic?** Yes - determines confidence tier messaging ("Good foundation" vs "Early sketch")
- **Recommendation:** Move to PLoT. API should provide canonical `confidence_tier` with thresholds determined by model.

---

### Finding 5: Quality Score Default Injection

- **File:** [useResultsSectionData.ts:1082-1088](src/components/results/useResultsSectionData.ts#L1082-L1088)
- **Code:**
  ```typescript
  } else if (tier === 'strong') {
    qualityScore = 80  // FABRICATED
  } else if (tier === 'fair') {
    qualityScore = 50  // FABRICATED
  } else if (tier === 'needs_work') {
    qualityScore = 20  // FABRICATED
  }
  ```
- **Type:** Semantic
- **Impact:** High
- **Affects user guidance logic?** Yes - fabricates numeric scores that may appear authoritative
- **Recommendation:** Remove. If tier is known but score is missing, display tier only without numeric score.

---

## Medium Severity Findings (Semantic, Cosmetic Impact)

### Finding 6: Direction Normalization

- **File:** [useResultsSectionData.ts:317-333](src/components/results/useResultsSectionData.ts#L317-L333), [mappers/utils.ts:157-187](src/lib/mappers/utils.ts#L157-L187)
- **Code:**
  ```typescript
  function normaliseDirection(direction: string | undefined): 'positive' | 'negative' | undefined {
    const normalised = String(direction).toLowerCase().trim()
    if (['positive', 'increases', '+', 'increase', 'up'].includes(normalised)) {
      return 'positive'
    }
    if (['negative', 'decreases', '-', 'decrease', 'down'].includes(normalised)) {
      return 'negative'
    }
    return undefined
  }
  ```
- **Type:** Semantic
- **Impact:** Medium
- **Affects user guidance logic?** No - presentation only (arrow direction)
- **Recommendation:** Keep (with documentation). PLoT should standardize on `positive`/`negative` but UI normalization handles legacy data.

---

### Finding 7: Robustness Level Normalization

- **File:** [mappers/utils.ts:197-210](src/lib/mappers/utils.ts#L197-L210)
- **Code:**
  ```typescript
  function normaliseRobustnessLevel(level: string | undefined):
    'high' | 'moderate' | 'low' | 'very_low' | undefined {
    if (lower === 'moderate' || lower === 'medium') return 'moderate'
    if (lower === 'very_low' || lower === 'verylow') return 'very_low'
    // ...
  }
  ```
- **Type:** Semantic
- **Impact:** Medium
- **Affects user guidance logic?** No - presentation only
- **Recommendation:** Keep. Documents API format variations.

---

### Finding 8: Confidence Clamping

- **File:** [useResultsSectionData.ts:1003-1007](src/components/results/useResultsSectionData.ts#L1003-L1007), [DriversSection.tsx:207-209](src/components/results/DriversSection.tsx#L207-L209)
- **Code:**
  ```typescript
  // Hook level
  const confidence = typeof rawConfidence === 'number'
    ? Math.max(0, Math.min(1, rawConfidence))
    : undefined

  // Component level (REDUNDANT)
  const confidenceValue = typeof driver.confidence === 'number'
    ? Math.max(0, Math.min(1, driver.confidence))
    : null
  ```
- **Type:** Semantic
- **Impact:** Medium
- **Affects user guidance logic?** Could hide API bugs (confidence > 1.0)
- **Recommendation:** Add telemetry when clamping occurs, fix upstream bug, then remove clamping.

---

### Finding 9: Severity Normalization

- **File:** [useResultsSectionData.ts:55-61](src/components/results/useResultsSectionData.ts#L55-L61)
- **Code:**
  ```typescript
  function normaliseSeverity(severity: string | undefined): CritiqueSeverity {
    const normalised = severity?.toLowerCase()
    if (normalised === 'blocker') return 'blocker'
    if (normalised === 'error') return 'error'
    if (normalised === 'info') return 'info'
    return 'warning' // DEFAULT INJECTION
  }
  ```
- **Type:** Semantic
- **Impact:** Medium
- **Affects user guidance logic?** Default to `warning` could mis-classify unknown severities
- **Recommendation:** Log unknown severities, return `undefined` for truly unknown.

---

### Finding 10: Direction Derivation from Elasticity Sign

- **File:** [useResultsSectionData.ts:157-158](src/components/results/useResultsSectionData.ts#L157-L158)
- **Code:**
  ```typescript
  const direction = typed.direction
    ? (String(typed.direction).toLowerCase() === 'negative' ? 'negative' : 'positive')
    : elasticity >= 0 ? 'positive' : 'negative'  // DERIVED
  ```
- **Type:** Semantic
- **Impact:** Medium
- **Affects user guidance logic?** Fabricates direction from sign when missing
- **Recommendation:** Move to PLoT. If direction missing, API should provide it.

---

## Low Severity Findings (Presentation Only)

### Finding 11: VOI → Confidence Percentage Scaling

- **File:** [mapFactorSensitivity.ts:119-140](src/lib/mappers/mapFactorSensitivity.ts#L119-L140)
- **Code:**
  ```typescript
  function getConfidence(factor: RawFactor): number | undefined {
    const voi = asOptionalNumber(factor.value_of_information)
    if (voi !== undefined) {
      return Math.round(voi * 100)  // 0-1 → 0-100
    }
    const confidence = asOptionalNumber(factor.confidence)
    if (confidence !== undefined) {
      if (confidence <= 1) {
        return Math.round(confidence * 100)  // 0-1 → 0-100
      }
      return Math.round(confidence)  // Already 0-100
    }
    return undefined
  }
  ```
- **Type:** Presentation
- **Impact:** Low
- **Affects user guidance logic?** No - display formatting only
- **Recommendation:** Keep. Documents scale conversion.

---

### Finding 12: Dynamic Influence Normalization

- **File:** [useResultsSectionData.ts:208-235](src/components/results/useResultsSectionData.ts#L208-L235)
- **Code:**
  ```typescript
  function computeNormalisedInfluences(factors): Map<string, number> {
    const actualMax = Math.max(...absoluteValues)
    if (actualMax < 0.001) {
      factors.forEach(f => result.set(f.key, 0))
      return result
    }
    factors.forEach(f => {
      const normalised = Math.min(1, Math.abs(f.rawElasticity) / actualMax)
      result.set(f.key, normalised)
    })
    return result
  }
  ```
- **Type:** Presentation
- **Impact:** Low
- **Affects user guidance logic?** No - relative display scaling (top = 100%)
- **Recommendation:** Keep. Raw values preserved in `rawElasticity`, normalized is for display only.

---

### Finding 13: Semantic Label Derivation

- **File:** [useResultsSectionData.ts:406-414](src/components/results/useResultsSectionData.ts#L406-L414)
- **Code:**
  ```typescript
  function getSemanticLabel(rank: number, normalisedValue: number): DriverSemanticLabel {
    if (rank === 1) return 'biggest'
    if (normalisedValue >= 0.50) return 'strong'
    if (normalisedValue >= 0.20) return 'moderate'
    return 'minor'
  }
  ```
- **Type:** Presentation
- **Impact:** Low
- **Affects user guidance logic?** No - descriptive labels for accessibility
- **Recommendation:** Keep. Labels derived from normalized display values.

---

## Fields Verified as Passthrough (No Semantic Transform)

| Field | Location | Status |
|-------|----------|--------|
| `switch_probability` | mapRobustness.ts:78-81 | **PASSTHROUGH** - Direct value, no inversion |
| `flip_risk_category` | useResultsSectionData.ts:176-180 | **PASSTHROUGH** - Validated enum, no remapping |
| `win_probability` | useResultsSectionData.ts:745 | **PASSTHROUGH** - Direct assignment |
| `ranking_stability` | useResultsSectionData.ts:1347 | **PASSTHROUGH** - Direct assignment |
| `recommendation_stability` | useResultsSectionData.ts:772-776 | **PASSTHROUGH** - Alias resolution only |
| `alternative_winner_label` | mapRobustness.ts:89-95 | **PASSTHROUGH** - Alias resolution only |

---

## Action Items

### Pre-Pilot (High Severity)

1. [ ] **Add telemetry** for Finding 1-4 to track threshold usage
2. [ ] **Document thresholds** in API contract as "UI-side, pending PLoT migration"
3. [ ] **Remove Finding 5** (quality score fabrication) - display tier text only

### Post-PoC (Move to PLoT)

1. [ ] Migrate severity derivation thresholds to PLoT (Finding 1)
2. [ ] Migrate fragile edge filter threshold to PLoT (Finding 2)
3. [ ] Migrate VOI evidence warning to PLoT (Finding 3)
4. [ ] Migrate confidence tier derivation to PLoT (Finding 4)

### Documentation

1. [ ] Add inline comments to all semantic transforms: `// SEMANTIC: [description]`
2. [ ] Create fixture-driven contract test to prevent regressions

---

## Registered Transforms Summary (UI-SEM-001 through UI-SEM-011)

| ID | Location | Transform | Classification |
|----|----------|-----------|----------------|
| UI-SEM-001 | `adapters/plot/v2/adapter.ts:549` | Canvas weight+direction → signed mean | Format conversion (legitimate) |
| UI-SEM-002 | `adapters/plot/v2/adapter.ts` | Observed state default injection | Adapter concern (legitimate) |
| UI-SEM-003 | `adapters/plot/v2/adapter.ts` | STD floor enforcement | Adapter concern (legitimate) |
| UI-SEM-004 | `canvas/adapters/islRequestAdapter.ts:645` | Risk→goal sign heuristic | Adapter concern (legitimate) |
| UI-SEM-005 | `components/results/useResultsSectionData.ts:1002` | Robustness level derivation from stability | Redundant backstop (remove when PLoT guarantees level) |
| UI-SEM-006 | `components/results/buildResultsVM.ts:77` | DecisionState thresholds (GAP/ROBUST/SENSITIVE) | VM-layer display derivation (legitimate) |
| UI-SEM-007 | `components/results/buildResultsVM.ts:40` | Stability fabrication from categorical level | **F.6 concern** (remove when PLoT guarantees numeric stability) |
| UI-SEM-008 | `lib/format.ts:60,72,118` | Probability cap at 99% | Display formatting (legitimate) |
| UI-SEM-009 | `canvas/components/DecisionSummary.tsx:238` | p15/p85 confidence band fabrication | **F.6 VIOLATION** (request from PLoT or remove) |
| UI-SEM-010 | `types/constraints.ts:37` | Constraint confidence colour thresholds | Display formatting (legitimate) |
| UI-SEM-011 | `canvas/hooks/useGraphReadiness.ts:322` | Default belief: 0.7 injection | Pre-analysis default (low risk, coaching only) |

**F.6 violations:** UI-SEM-007, UI-SEM-009 — these transforms create semantic meaning the backend never provided.

---

## Verification

Run the contract test to verify passthrough fields:

```bash
npm test -- src/test/__tests__/plot-semantic-contract.test.ts
```
