/**
 * useResultsSectionData Helper Function Tests
 *
 * Tests for critical helper functions in the Results Panel data transformation hook.
 * Covers dynamic normalisation, field fallback chains, rank computation, etc.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useResultsSectionData,
  normaliseLabel,
  getFactorKey,
  getRawElasticity,
  computeNormalisedInfluences,
  computeFactorRanks,
  selectDriverDisplayModel,
  normaliseDirection,
  getFactorDirection,
  getSemanticLabel,
  mapReadinessLevel,
  mapConfidenceLevel,
  getConfidenceTier,
  deriveConfidenceTierLegacy,
  classifySeverityLegacy,
  detectDominantFactorLegacy,
  normaliseImprovements,
  normalizeOutcomeValues,
  determineWinnerSelection,
  resolveBaselineId,
} from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { formatFlipRiskMessage } from '../utils/formatScenarioRatio'
import type { RawFactorSensitivity, EdgeForDirection } from '../types'

// =============================================================================
// 1. Dynamic Normalisation Tests
// =============================================================================

describe('computeNormalisedInfluences', () => {
  it('normalises to max = 100% ([0.8, 2.0, 8.0] -> [10%, 25%, 100%])', () => {
    const factors = [
      { key: 'a', rawElasticity: 0.8 },
      { key: 'b', rawElasticity: 2.0 },
      { key: 'c', rawElasticity: 8.0 },
    ]

    const result = computeNormalisedInfluences(factors)

    expect(result.get('a')).toBeCloseTo(0.1) // 0.8 / 8.0 = 0.1 (10%)
    expect(result.get('b')).toBeCloseTo(0.25) // 2.0 / 8.0 = 0.25 (25%)
    expect(result.get('c')).toBeCloseTo(1.0) // 8.0 / 8.0 = 1.0 (100%)
  })

  it('normalises [0.3, 0.5, 0.7] -> [43%, 71%, 100%]', () => {
    const factors = [
      { key: 'a', rawElasticity: 0.3 },
      { key: 'b', rawElasticity: 0.5 },
      { key: 'c', rawElasticity: 0.7 },
    ]

    const result = computeNormalisedInfluences(factors)

    expect(result.get('a')).toBeCloseTo(0.43, 1) // 0.3 / 0.7 ≈ 0.43 (43%)
    expect(result.get('b')).toBeCloseTo(0.71, 1) // 0.5 / 0.7 ≈ 0.71 (71%)
    expect(result.get('c')).toBeCloseTo(1.0) // 0.7 / 0.7 = 1.0 (100%)
  })

  it('uses absolute values for normalisation', () => {
    const factors = [
      { key: 'a', rawElasticity: -0.5 },
      { key: 'b', rawElasticity: 1.0 },
    ]

    const result = computeNormalisedInfluences(factors)

    expect(result.get('a')).toBeCloseTo(0.5) // |-0.5| / 1.0 = 0.5
    expect(result.get('b')).toBeCloseTo(1.0) // |1.0| / 1.0 = 1.0
  })

  it('handles all zeros (returns all 0 - UI shows direction-only view)', () => {
    // When no sensitivity data is available (all zeros), return 0 for all
    // The hasMagnitudeData flag will trigger direction-only display in UI
    // This avoids misleading 100% bars when we have no real data
    const factors = [
      { key: 'a', rawElasticity: 0 },
      { key: 'b', rawElasticity: 0 },
    ]

    const result = computeNormalisedInfluences(factors)

    // All factors get 0 - UI will show direction-only view
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
  })

  it('handles empty array', () => {
    const result = computeNormalisedInfluences([])
    expect(result.size).toBe(0)
  })

  it('handles single factor', () => {
    const factors = [{ key: 'a', rawElasticity: 5.0 }]

    const result = computeNormalisedInfluences(factors)

    expect(result.get('a')).toBeCloseTo(1.0) // Single factor = 100%
  })

  it('caps at 1.0 (never exceeds 100%)', () => {
    const factors = [
      { key: 'a', rawElasticity: 10.0 },
      { key: 'b', rawElasticity: 5.0 },
    ]

    const result = computeNormalisedInfluences(factors)

    expect(result.get('a')).toBeLessThanOrEqual(1.0)
    expect(result.get('b')).toBeLessThanOrEqual(1.0)
  })
})

// =============================================================================
// 10. Outcome Normalisation Tests
// =============================================================================

describe('normalizeOutcomeValues', () => {
  it('does not rescale large absolute values', () => {
    const result = normalizeOutcomeValues(100000, 150000, 120000, 180000)

    expect(result.p10).toBe(100000)
    expect(result.expected).toBe(150000)
    expect(result.p50).toBe(120000)
    expect(result.p90).toBe(180000)
  })

  it('keeps small values intact', () => {
    const result = normalizeOutcomeValues(0.1, 0.5, 0.4, 0.9)

    expect(result.p10).toBe(0.1)
    expect(result.expected).toBe(0.5)
    expect(result.p50).toBe(0.4)
    expect(result.p90).toBe(0.9)
  })
})

// =============================================================================
// 2. Field Fallback Chain Tests
// =============================================================================

describe('getRawElasticity', () => {
  it('prefers elasticity field', () => {
    const factor: RawFactorSensitivity = {
      elasticity: 1.5,
      sensitivity_score: 2.0,
      sensitivity: 3.0,
    }
    expect(getRawElasticity(factor)).toBe(1.5)
  })

  it('falls back to sensitivity_score when elasticity missing', () => {
    const factor: RawFactorSensitivity = {
      sensitivity_score: 2.0,
      sensitivity: 3.0,
    }
    expect(getRawElasticity(factor)).toBe(2.0)
  })

  it('falls back to sensitivity when others missing', () => {
    const factor: RawFactorSensitivity = {
      sensitivity: 3.0,
    }
    expect(getRawElasticity(factor)).toBe(3.0)
  })

  it('returns 0 when all fields missing', () => {
    const factor: RawFactorSensitivity = {}
    expect(getRawElasticity(factor)).toBe(0)
  })

  it('ignores NaN values', () => {
    const factor: RawFactorSensitivity = {
      elasticity: NaN,
      sensitivity_score: 2.0,
    }
    expect(getRawElasticity(factor)).toBe(2.0)
  })

  it('ignores Infinity values', () => {
    const factor: RawFactorSensitivity = {
      elasticity: Infinity,
      sensitivity_score: 2.0,
    }
    expect(getRawElasticity(factor)).toBe(2.0)
  })
})

// =============================================================================
// 3. Factor Key Derivation Tests
// =============================================================================

describe('getFactorKey', () => {
  it('prefers node_id (graph-canonical field)', () => {
    const factor: RawFactorSensitivity = {
      factor_id: 'factor_456',
      node_id: 'node_123',
      id: 'id_789',
      label: 'My Factor',
    }
    expect(getFactorKey(factor, 0)).toBe('node_123')
  })

  it('falls back to node_id when factor_id missing', () => {
    const factor: RawFactorSensitivity = {
      node_id: 'node_123',
      id: 'id_789',
      label: 'My Factor',
    }
    expect(getFactorKey(factor, 0)).toBe('node_123')
  })

  it('falls back to id', () => {
    const factor: RawFactorSensitivity = {
      id: 'id_789',
      label: 'My Factor',
    }
    expect(getFactorKey(factor, 0)).toBe('id_789')
  })

  it('normalises label when no IDs available', () => {
    const factor: RawFactorSensitivity = {
      label: 'My Factor Name',
    }
    expect(getFactorKey(factor, 0)).toBe('my_factor_name')
  })

  it('generates index-based key when all fields missing', () => {
    const factor: RawFactorSensitivity = {}
    expect(getFactorKey(factor, 5)).toBe('factor_5')
  })
})

describe('normaliseLabel', () => {
  it('converts to lowercase', () => {
    expect(normaliseLabel('My FACTOR')).toBe('my_factor')
  })

  it('replaces spaces with underscores', () => {
    expect(normaliseLabel('My Factor Name')).toBe('my_factor_name')
  })

  it('collapses multiple spaces into single underscore', () => {
    expect(normaliseLabel('My   Factor')).toBe('my_factor')
  })

  it('returns "unknown" for undefined', () => {
    expect(normaliseLabel(undefined)).toBe('unknown')
  })
})

// =============================================================================
// 4. Rank Computation Tests
// =============================================================================

describe('selectDriverDisplayModel (Codex R3-B1: complete-metric-set policy, shared by panel + graph)', () => {
  it('adopts producer influence only when EVERY factor carries one', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: 0.9, rawElasticity: 0.1 },
      { key: 'b', influenceScore: 0.2, rawElasticity: 2.0 },
    ])
    expect(model.get('a')).toEqual({ value: 0.9, provenance: 'influence_score' })
    expect(model.get('b')).toEqual({ value: 0.2, provenance: 'influence_score' })
  })

  it('partial coverage: EVERY factor falls back to normalised elasticity — a producer 0.9 must not outrank the elasticity-dominant factor it cannot be compared with', () => {
    // Codex R3-B1 scenario: A has influence_score 0.9, B has NO producer score
    // but dominant elasticity, C has influence_score 0.2. Mixing bases would
    // rank A #1 on a producer scale B never entered. Under the policy all
    // three resolve on the normalised-elasticity basis: B (1.0) > A > C.
    const model = selectDriverDisplayModel([
      { key: 'a', influenceScore: 0.9, rawElasticity: 0.4 },
      { key: 'b', rawElasticity: 1.0 },
      { key: 'c', influenceScore: 0.2, rawElasticity: 0.1 },
    ])
    expect(model.get('a')).toEqual({ value: 0.4, provenance: 'normalised_elasticity' })
    expect(model.get('b')).toEqual({ value: 1.0, provenance: 'normalised_elasticity' })
    expect(model.get('c')).toEqual({ value: 0.1, provenance: 'normalised_elasticity' })
    // And the rank the surfaces crown by follows the same single basis:
    const rankMap = computeFactorRanks([
      { key: 'a', rawElasticity: 0.4, displayValue: model.get('a')!.value },
      { key: 'b', rawElasticity: 1.0, displayValue: model.get('b')!.value },
      { key: 'c', rawElasticity: 0.1, displayValue: model.get('c')!.value },
    ])
    expect(rankMap.get('b')).toBe(1)
    expect(rankMap.get('a')).toBe(2)
    expect(rankMap.get('c')).toBe(3)
  })

  it('no producer coverage at all: normalised basis for everyone', () => {
    const model = selectDriverDisplayModel([
      { key: 'a', rawElasticity: 2.0 },
      { key: 'b', rawElasticity: 1.0 },
    ])
    expect(model.get('a')).toEqual({ value: 1.0, provenance: 'normalised_elasticity' })
    expect(model.get('b')).toEqual({ value: 0.5, provenance: 'normalised_elasticity' })
  })
})

describe('computeFactorRanks', () => {
  it('ranks by absolute elasticity descending', () => {
    const factors = [
      { key: 'a', rawElasticity: 0.5 },
      { key: 'b', rawElasticity: 2.0 },
      { key: 'c', rawElasticity: 1.0 },
    ]

    const result = computeFactorRanks(factors)

    expect(result.get('b')).toBe(1) // Highest elasticity
    expect(result.get('c')).toBe(2)
    expect(result.get('a')).toBe(3) // Lowest elasticity
  })

  it('uses absolute value for ranking (negative factors)', () => {
    const factors = [
      { key: 'a', rawElasticity: -3.0 },
      { key: 'b', rawElasticity: 2.0 },
      { key: 'c', rawElasticity: -1.0 },
    ]

    const result = computeFactorRanks(factors)

    expect(result.get('a')).toBe(1) // |-3.0| = 3.0 is highest
    expect(result.get('b')).toBe(2)
    expect(result.get('c')).toBe(3)
  })

  it('uses importance_rank as tie-breaker', () => {
    const factors = [
      { key: 'a', rawElasticity: 1.0, importanceRank: 2 },
      { key: 'b', rawElasticity: 1.0, importanceRank: 1 },
    ]

    const result = computeFactorRanks(factors)

    expect(result.get('b')).toBe(1) // Lower importance_rank wins
    expect(result.get('a')).toBe(2)
  })

  it('uses label alphabetical as second tie-breaker', () => {
    const factors = [
      { key: 'a', rawElasticity: 1.0, label: 'Zebra' },
      { key: 'b', rawElasticity: 1.0, label: 'Apple' },
    ]

    const result = computeFactorRanks(factors)

    expect(result.get('b')).toBe(1) // "Apple" < "Zebra"
    expect(result.get('a')).toBe(2)
  })

  it('produces 1-indexed ranks', () => {
    const factors = [{ key: 'a', rawElasticity: 1.0 }]

    const result = computeFactorRanks(factors)

    expect(result.get('a')).toBe(1)
  })
})

// =============================================================================
// 5. Semantic Label Tests
// =============================================================================

describe('getSemanticLabel', () => {
  it('always returns "biggest" for rank 1', () => {
    expect(getSemanticLabel(1, 1.0)).toBe('biggest')
    expect(getSemanticLabel(1, 0.5)).toBe('biggest')
    expect(getSemanticLabel(1, 0.1)).toBe('biggest')
  })

  it('returns "strong" for normalised >= 0.50 (rank > 1)', () => {
    expect(getSemanticLabel(2, 0.50)).toBe('strong')
    expect(getSemanticLabel(2, 0.75)).toBe('strong')
    expect(getSemanticLabel(3, 0.99)).toBe('strong')
  })

  it('returns "moderate" for normalised 0.20-0.49 (rank > 1)', () => {
    expect(getSemanticLabel(2, 0.20)).toBe('moderate')
    expect(getSemanticLabel(2, 0.35)).toBe('moderate')
    expect(getSemanticLabel(2, 0.49)).toBe('moderate')
  })

  it('returns "minor" for normalised < 0.20 (rank > 1)', () => {
    expect(getSemanticLabel(2, 0.19)).toBe('minor')
    expect(getSemanticLabel(2, 0.10)).toBe('minor')
    expect(getSemanticLabel(2, 0.01)).toBe('minor')
  })
})

// =============================================================================
// 6. Direction Mapping Tests
// =============================================================================

describe('normaliseDirection', () => {
  it('maps positive variants', () => {
    expect(normaliseDirection('positive')).toBe('positive')
    expect(normaliseDirection('increases')).toBe('positive')
    expect(normaliseDirection('+')).toBe('positive')
    expect(normaliseDirection('increase')).toBe('positive')
    expect(normaliseDirection('up')).toBe('positive')
  })

  it('maps negative variants', () => {
    expect(normaliseDirection('negative')).toBe('negative')
    expect(normaliseDirection('decreases')).toBe('negative')
    expect(normaliseDirection('-')).toBe('negative')
    expect(normaliseDirection('decrease')).toBe('negative')
    expect(normaliseDirection('down')).toBe('negative')
  })

  it('handles case insensitivity', () => {
    expect(normaliseDirection('POSITIVE')).toBe('positive')
    expect(normaliseDirection('Negative')).toBe('negative')
  })

  it('returns undefined for unknown variants', () => {
    expect(normaliseDirection('unknown')).toBeUndefined()
    expect(normaliseDirection('mixed')).toBeUndefined()
  })

  it('returns undefined for undefined/empty', () => {
    expect(normaliseDirection(undefined)).toBeUndefined()
    expect(normaliseDirection('')).toBeUndefined()
  })
})

describe('getFactorDirection', () => {
  it('prefers direct edge to goal', () => {
    const edges: EdgeForDirection[] = [
      { source: 'factor_a', target: 'goal_1', effect_direction: 'negative' },
      { source: 'factor_a', target: 'outcome_1', effect_direction: 'positive' },
    ]

    const result = getFactorDirection('factor_a', edges, 'goal_1', ['outcome_1'])

    expect(result).toBe('negative')
  })

  it('falls back to edge to outcome when no goal edge', () => {
    const edges: EdgeForDirection[] = [
      { source: 'factor_a', target: 'outcome_1', effect_direction: 'positive' },
    ]

    const result = getFactorDirection('factor_a', edges, 'goal_1', ['outcome_1'])

    expect(result).toBe('positive')
  })

  it('picks first outcome deterministically (sorted by ID)', () => {
    const edges: EdgeForDirection[] = [
      { source: 'factor_a', target: 'outcome_z', effect_direction: 'negative' },
      { source: 'factor_a', target: 'outcome_a', effect_direction: 'positive' },
    ]

    const result = getFactorDirection('factor_a', edges, undefined, [
      'outcome_z',
      'outcome_a',
    ])

    expect(result).toBe('positive') // outcome_a comes first alphabetically
  })

  it('uses factor-level direction as last resort', () => {
    const edges: EdgeForDirection[] = []

    const result = getFactorDirection('factor_a', edges, 'goal_1', [], 'negative')

    expect(result).toBe('negative')
  })

  it('returns undefined when no direction available', () => {
    const edges: EdgeForDirection[] = []

    const result = getFactorDirection('factor_a', edges, 'goal_1', [])

    expect(result).toBeUndefined()
  })

  it('handles "from/to" edge aliases', () => {
    const edges: EdgeForDirection[] = [
      { from: 'factor_a', to: 'goal_1', direction: 'positive' },
    ]

    const result = getFactorDirection('factor_a', edges, 'goal_1', [])

    expect(result).toBe('positive')
  })
})

// =============================================================================
// 7. Confidence Fallback Chain Tests
// =============================================================================

describe('mapReadinessLevel', () => {
  it('maps readiness levels to tiers', () => {
    expect(mapReadinessLevel('ready')).toBe('strong')
    expect(mapReadinessLevel('fair')).toBe('fair')
    expect(mapReadinessLevel('needs_work')).toBe('needs_work')
    expect(mapReadinessLevel('caution')).toBe('fair')
    expect(mapReadinessLevel('not_ready')).toBe('needs_work')
  })

  it('returns unknown for unmapped levels', () => {
    expect(mapReadinessLevel('invalid')).toBe('unknown')
  })
})

describe('mapConfidenceLevel', () => {
  it('maps confidence levels to tiers', () => {
    expect(mapConfidenceLevel('strong')).toBe('strong')
    expect(mapConfidenceLevel('high')).toBe('strong')
    expect(mapConfidenceLevel('fair')).toBe('fair')
    expect(mapConfidenceLevel('medium')).toBe('fair')
    expect(mapConfidenceLevel('needs_work')).toBe('needs_work')
    expect(mapConfidenceLevel('low')).toBe('needs_work')
  })

  it('handles case insensitivity', () => {
    expect(mapConfidenceLevel('STRONG')).toBe('strong')
  })

  it('returns unknown for unmapped levels', () => {
    expect(mapConfidenceLevel('invalid')).toBe('unknown')
  })
})

describe('getConfidenceTier', () => {
  it('prefers PLoT confidence_tier over all fallbacks', () => {
    const result = getConfidenceTier(
      'fair',
      { readiness_level: 'ready', readiness_score: 90 },
      { confidence: { level: 'high' } }
    )
    expect(result).toBe('fair')
  })

  it('ignores invalid PLoT confidence_tier values', () => {
    const result = getConfidenceTier(
      'excellent' as any,
      { readiness_level: 'ready' },
      undefined
    )
    expect(result).toBe('strong') // Falls through to graphReadiness
  })

  it('falls back to graphReadiness.readiness_level when plotTier absent', () => {
    const result = getConfidenceTier(
      undefined,
      { readiness_level: 'ready', readiness_score: 50 },
      { confidence: { level: 'low' } }
    )
    expect(result).toBe('strong')
  })

  it('falls back to graphReadiness.readiness_score', () => {
    const result = getConfidenceTier(
      undefined,
      { readiness_score: 75 },
      { confidence: { level: 'low' } }
    )
    expect(result).toBe('strong')
  })

  it('maps readiness_score thresholds correctly', () => {
    expect(getConfidenceTier(undefined, { readiness_score: 70 }, undefined)).toBe('strong')
    expect(getConfidenceTier(undefined, { readiness_score: 69 }, undefined)).toBe('fair')
    expect(getConfidenceTier(undefined, { readiness_score: 40 }, undefined)).toBe('fair')
    expect(getConfidenceTier(undefined, { readiness_score: 39 }, undefined)).toBe('needs_work')
    expect(getConfidenceTier(undefined, { readiness_score: 0 }, undefined)).toBe('needs_work')
  })

  it('falls back to report.confidence.level', () => {
    const result = getConfidenceTier(undefined, undefined, { confidence: { level: 'high' } })
    expect(result).toBe('strong')
  })

  it('falls back to report.graph_quality.score', () => {
    const result = getConfidenceTier(undefined, undefined, { graph_quality: { score: 80 } })
    expect(result).toBe('strong')
  })

  it('returns unknown when no data available', () => {
    expect(getConfidenceTier(undefined, undefined, undefined)).toBe('unknown')
    expect(getConfidenceTier(undefined, {}, {})).toBe('unknown')
  })
})

// =============================================================================
// B2: classifySeverityLegacy
// =============================================================================

describe('classifySeverityLegacy', () => {
  it('returns critical for switch_probability > 0.7', () => {
    expect(classifySeverityLegacy(0.71)).toBe('critical')
    expect(classifySeverityLegacy(0.9)).toBe('critical')
  })

  it('returns error for switch_probability > 0.5 and <= 0.7', () => {
    expect(classifySeverityLegacy(0.51)).toBe('error')
    expect(classifySeverityLegacy(0.7)).toBe('error')
  })

  it('returns warning for switch_probability <= 0.5', () => {
    expect(classifySeverityLegacy(0.5)).toBe('warning')
    expect(classifySeverityLegacy(0.3)).toBe('warning')
    expect(classifySeverityLegacy(0)).toBe('warning')
  })

  it('returns warning when flipProbability is undefined', () => {
    expect(classifySeverityLegacy(undefined)).toBe('warning')
  })

  it('returns warning when flipProbability is null', () => {
    expect(classifySeverityLegacy(null)).toBe('warning')
  })
})

// =============================================================================
// B2: deriveConfidenceTierLegacy
// =============================================================================

describe('deriveConfidenceTierLegacy', () => {
  it('preserves existing cascade: readiness_level > score > confidence > quality', () => {
    expect(deriveConfidenceTierLegacy({ readiness_level: 'ready' }, undefined)).toBe('strong')
    expect(deriveConfidenceTierLegacy({ readiness_score: 75 }, undefined)).toBe('strong')
    expect(deriveConfidenceTierLegacy(undefined, { confidence: { level: 'low' } })).toBe('needs_work')
    expect(deriveConfidenceTierLegacy(undefined, { graph_quality: { score: 50 } })).toBe('fair')
    expect(deriveConfidenceTierLegacy(undefined, undefined)).toBe('unknown')
  })
})

// =============================================================================
// B2: detectDominantFactorLegacy
// =============================================================================

describe('detectDominantFactorLegacy', () => {
  it('detects dominant factor when top driver > 0.5 influence and ratio > 2:1', () => {
    const drivers = [
      { factorKey: 'fac_1', factorLabel: 'Market size', influenceScore: 0.8 },
      { factorKey: 'fac_2', factorLabel: 'Regulation', influenceScore: 0.2 },
    ]
    const result = detectDominantFactorLegacy(drivers)
    expect(result).toEqual({ dominantFactorId: 'fac_1', dominantFactorLabel: 'Market size' })
  })

  it('returns undefined when no dominance (ratio < 2:1)', () => {
    const drivers = [
      { factorKey: 'fac_1', factorLabel: 'Market size', influenceScore: 0.6 },
      { factorKey: 'fac_2', factorLabel: 'Regulation', influenceScore: 0.4 },
    ]
    expect(detectDominantFactorLegacy(drivers)).toBeUndefined()
  })

  it('returns undefined with fewer than 2 drivers', () => {
    expect(detectDominantFactorLegacy([{ factorKey: 'a', factorLabel: 'A', influenceScore: 0.9 }])).toBeUndefined()
    expect(detectDominantFactorLegacy([])).toBeUndefined()
  })

  it('server wins: PLoT dominant_factor takes priority over local heuristic', () => {
    // This test validates the priority chain in the hook:
    // report.dominant_factor (fac_2) should win over what detectDominantFactorLegacy would return (fac_1).
    // The legacy function itself just does the heuristic, so here we verify it WOULD produce fac_1.
    const drivers = [
      { factorKey: 'fac_1', factorLabel: 'Market size', influenceScore: 0.8 },
      { factorKey: 'fac_2', factorLabel: 'Regulation', influenceScore: 0.2 },
    ]
    const legacyResult = detectDominantFactorLegacy(drivers)
    expect(legacyResult?.dominantFactorId).toBe('fac_1')
    // In the hook, report.dominant_factor = { factor_id: 'fac_2', factor_label: 'Regulation' }
    // would override this. See "server wins" integration test below.
  })
})

// =============================================================================
// 8. Improvements Deduplication Tests
// =============================================================================

describe('normaliseImprovements', () => {
  it('includes bias findings as highest priority', () => {
    const result = normaliseImprovements(
      [{ explanation: 'Fix bias', micro_intervention: { steps: ['Step 1'] } }],
      [],
      []
    )

    expect(result.length).toBe(1)
    expect(result[0].action).toBe('Step 1')
    expect(result[0].priority).toBe(1)
    expect(result[0].source).toBe('bias')
  })

  it('falls back to explanation when no micro_intervention', () => {
    const result = normaliseImprovements(
      [{ explanation: 'Fix bias' }],
      [],
      []
    )

    expect(result[0].action).toBe('Fix bias')
  })

  it('includes quality factors as medium priority', () => {
    const result = normaliseImprovements(
      [],
      [{ factor: 'Coverage', recommendation: 'Add more data' }],
      []
    )

    expect(result[0].priority).toBe(2)
    expect(result[0].source).toBe('quality_factor')
    expect(result[0].action).toBe('Add more data')
  })

  it('includes improvement_guidance with explicit priority', () => {
    const result = normaliseImprovements(
      [],
      [],
      [{ action: 'Do this first', priority: 1 }]
    )

    expect(result[0].priority).toBe(1)
    expect(result[0].source).toBe('improvement_guidance')
  })

  it('defaults improvement_guidance priority to 3', () => {
    const result = normaliseImprovements(
      [],
      [],
      [{ action: 'Do this' }]
    )

    expect(result[0].priority).toBe(3)
  })

  it('deduplicates by action (case-insensitive)', () => {
    const result = normaliseImprovements(
      [{ explanation: 'add more data' }],
      [{ recommendation: 'Add More Data' }],
      []
    )

    expect(result.length).toBe(1)
    expect(result[0].source).toBe('bias') // Keeps higher priority
  })

  it('keeps highest priority when deduplicating', () => {
    const result = normaliseImprovements(
      [],
      [{ recommendation: 'do thing' }], // priority 2
      [{ action: 'Do Thing', priority: 1 }] // priority 1
    )

    expect(result.length).toBe(1)
    expect(result[0].priority).toBe(1) // Keeps priority 1
  })

  it('sorts by priority ascending', () => {
    const result = normaliseImprovements(
      [],
      [{ recommendation: 'Medium' }],
      [{ action: 'Low', priority: 3 }, { action: 'High', priority: 1 }]
    )

    expect(result[0].priority).toBe(1)
    expect(result[1].priority).toBe(2)
    expect(result[2].priority).toBe(3)
  })

  it('includes effortMinutes from bias findings', () => {
    const result = normaliseImprovements(
      [{ explanation: 'Fix', estimated_minutes: 15 }],
      [],
      []
    )

    expect(result[0].effortMinutes).toBe(15)
  })

  it('includes potentialImprovement from quality factors', () => {
    const result = normaliseImprovements(
      [],
      [{ recommendation: 'Add data', potential_improvement: '+20% accuracy' }],
      []
    )

    expect(result[0].potentialImprovement).toBe('+20% accuracy')
  })

  it('handles undefined/empty arrays', () => {
    expect(normaliseImprovements(undefined, undefined, undefined)).toEqual([])
    expect(normaliseImprovements([], [], [])).toEqual([])
  })

  it('skips items without actionable content', () => {
    const result = normaliseImprovements(
      [{ explanation: undefined }],
      [{ factor: 'X' }], // No recommendation
      [{}] // No action
    )

    expect(result.length).toBe(0)
  })
})

// =============================================================================
// 9. Fragile Edge Filtering Tests
// =============================================================================

describe('fragile edge filtering', () => {
  // Note: These test the filtering logic described in useResultsSectionData
  // Actual filtering happens in the useMemo for confidence section

  it('filters fragile edges by switch_probability > 0.3', () => {
    // High-risk edges (switch_probability > 0.3) should be shown
    // ISL switch_probability = P(alternative wins | edge weak) — higher = more likely to flip
    const highRiskEdge = { source: 'a', target: 'b', switch_probability: 0.5 }
    // Low-risk edges (switch_probability <= 0.3) should be filtered
    const lowRiskEdge = { source: 'c', target: 'd', switch_probability: 0.1 }

    const edges = [highRiskEdge, lowRiskEdge]
    const filtered = edges.filter((fe) =>
      typeof fe.switch_probability !== 'number' || fe.switch_probability > 0.3
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toBe(highRiskEdge)
  })

  it('includes edges without switch_probability (legacy data)', () => {
    const legacyEdge = { source: 'a', target: 'b' } // No switch_probability
    const highRiskEdge = { source: 'c', target: 'd', switch_probability: 0.5 }

    const edges = [legacyEdge, highRiskEdge]
    const filtered = edges.filter((fe: any) =>
      typeof fe.switch_probability !== 'number' || fe.switch_probability > 0.3
    )

    expect(filtered).toHaveLength(2)
  })

  it('boundary: switch_probability exactly 0.3 is not shown (needs > 0.3)', () => {
    const boundaryEdge = { source: 'a', target: 'b', switch_probability: 0.3 }

    const edges = [boundaryEdge]
    const filtered = edges.filter((fe: any) =>
      typeof fe.switch_probability !== 'number' || fe.switch_probability > 0.3
    )

    expect(filtered).toHaveLength(0)
  })
})

// =============================================================================
// 10. Switch Probability Filtering Tests (Bug Fix: switch_probability primary)
// =============================================================================

describe('switch_probability filtering (primary over marginal)', () => {
  // Helper that mirrors the actual filtering logic in useResultsSectionData
  // Bug fix: switch_probability is primary, marginal_switch_probability is fallback
  const getFlipProb = (fe: any) => fe.switch_probability ?? fe.marginal_switch_probability

  const filterEdges = (edges: any[]) =>
    edges.filter((fe) => {
      const flipProb = getFlipProb(fe)
      if (typeof flipProb === 'number') {
        return flipProb > 0.3
      }
      return true // Include if no probability data (legacy)
    })

  const sortEdges = (edges: any[]) =>
    [...edges].sort((a, b) => {
      const bProb = getFlipProb(b) ?? -Infinity
      const aProb = getFlipProb(a) ?? -Infinity
      return bProb - aProb
    })

  it('uses switch_probability as primary for filtering', () => {
    // Edge with low switch_probability - should be EXCLUDED (switch <= 0.3)
    const lowSwitchEdge = {
      source: 'a',
      target: 'b',
      switch_probability: 0.1,
      marginal_switch_probability: 0.5,
    }
    // Edge with high switch_probability - should be INCLUDED (switch > 0.3)
    const highSwitchEdge = {
      source: 'c',
      target: 'd',
      switch_probability: 0.8,
      marginal_switch_probability: 0.2,
    }

    const filtered = filterEdges([lowSwitchEdge, highSwitchEdge])

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toBe(highSwitchEdge)
  })

  it('falls back to marginal_switch_probability when switch_probability is undefined', () => {
    // Edge with only marginal_switch_probability (no switch)
    const marginalOnlyEdge = { source: 'a', target: 'b', marginal_switch_probability: 0.5 }
    // Edge with switch_probability present
    const switchEdge = {
      source: 'c',
      target: 'd',
      switch_probability: 0.4,
      marginal_switch_probability: 0.1,
    }

    const filtered = filterEdges([marginalOnlyEdge, switchEdge])

    expect(filtered).toHaveLength(2) // Both > 0.3
  })

  it('uses switch_probability for sorting when present', () => {
    const edges = [
      { source: 'a', target: 'b', switch_probability: 0.9, marginal_switch_probability: 0.3 },
      { source: 'c', target: 'd', switch_probability: 0.1, marginal_switch_probability: 0.7 },
      { source: 'e', target: 'f', marginal_switch_probability: 0.5 }, // No switch, uses marginal
    ]

    const sorted = sortEdges(edges)

    // Should be sorted by effective probability: 0.9 (switch), 0.5 (marginal fallback), 0.1 (switch)
    expect(sorted[0].switch_probability).toBe(0.9)
    expect(sorted[1].marginal_switch_probability).toBe(0.5)
    expect(sorted[2].switch_probability).toBe(0.1)
  })

  it('handles edge with switch_probability of 0 correctly', () => {
    // switch = 0 is a valid value (means no flip risk), not a fallback trigger
    const zeroSwitchEdge = {
      source: 'a',
      target: 'b',
      switch_probability: 0,
      marginal_switch_probability: 0.8,
    }

    const filtered = filterEdges([zeroSwitchEdge])

    // Should be filtered out because switch (0) <= 0.3, NOT use marginal (0.8)
    expect(filtered).toHaveLength(0)
  })

  it('severity derivation uses switch_probability via classifySeverityLegacy', () => {
    // B2: Tests the actual exported legacy function (replaces stale blocker-taxonomy mirror)
    // switch_probability is the primary field; classifySeverityLegacy receives the resolved value
    expect(classifySeverityLegacy(0.8)).toBe('critical')  // >0.7
    expect(classifySeverityLegacy(0.6)).toBe('error')     // >0.5
    expect(classifySeverityLegacy(0.75)).toBe('critical')  // marginal fallback resolved by caller
    expect(classifySeverityLegacy(0.3)).toBe('warning')   // <=0.5
  })
})

// =============================================================================
// 11. Value of Information (VOI) Warning Tests
// =============================================================================

describe('value_of_information warning trigger', () => {
  // Helper that mirrors the showQualityHint logic in DriversSection.tsx
  // Warning shows when VOI > 0.05 (investigation could change decision)
  const shouldShowWarning = (driver: { valueOfInformation?: number }) =>
    typeof driver.valueOfInformation === 'number' && driver.valueOfInformation > 0.05

  it('shows warning when VOI > 0.05 (investigation could change decision)', () => {
    const driver = { valueOfInformation: 0.72 }
    expect(shouldShowWarning(driver)).toBe(true)
  })

  it('shows warning at boundary VOI = 0.06', () => {
    const driver = { valueOfInformation: 0.06 }
    expect(shouldShowWarning(driver)).toBe(true)
  })

  it('does NOT show warning when VOI = 0 (decision won\'t change)', () => {
    // VOI = 0 means "even if you gather more data, the decision won't change"
    const driver = { valueOfInformation: 0 }
    expect(shouldShowWarning(driver)).toBe(false)
  })

  it('does NOT show warning at boundary VOI = 0.05 (needs > 0.05)', () => {
    const driver = { valueOfInformation: 0.05 }
    expect(shouldShowWarning(driver)).toBe(false)
  })

  it('does NOT show warning when VOI is undefined', () => {
    const driver = { valueOfInformation: undefined }
    expect(shouldShowWarning(driver)).toBe(false)
  })

  it('does NOT show warning when VOI field is missing', () => {
    const driver = {} as { valueOfInformation?: number }
    expect(shouldShowWarning(driver)).toBe(false)
  })

  it('warning is independent of confidence value', () => {
    // Low confidence but VOI = 0 → no warning (decision won't change)
    const lowConfidenceNoVoi = { confidence: 0.1, valueOfInformation: 0 }
    expect(shouldShowWarning(lowConfidenceNoVoi)).toBe(false)

    // High confidence but VOI > 0.05 → show warning (investigation worthwhile)
    const highConfidenceHighVoi = { confidence: 0.95, valueOfInformation: 0.3 }
    expect(shouldShowWarning(highConfidenceHighVoi)).toBe(true)
  })
})

// =============================================================================
// 12. Flip Risk Category Display Tests
// =============================================================================

describe('flip_risk_category display logic', () => {
  // Helper that mirrors the flip risk display logic in DriversSection.tsx
  const getFlipRiskMessage = (driver: {
    flipRiskCategory?: 'isolated' | 'correlated' | 'negligible'
    fragileEdgeInfo?: {
      switchProbability?: number
      alternativeWinnerLabel?: string
    }
  }): string | null => {
    const alternativeWinnerLabel = driver.fragileEdgeInfo?.alternativeWinnerLabel
    const hasSpecificAlternative = typeof alternativeWinnerLabel === 'string'
      && alternativeWinnerLabel.trim().length > 0
      && alternativeWinnerLabel !== 'another option'

    if (driver.flipRiskCategory === 'isolated') {
      // Show percentage for isolated factors (can flip decision alone)
      if (driver.fragileEdgeInfo?.switchProbability !== undefined && hasSpecificAlternative) {
        return formatFlipRiskMessage(driver.fragileEdgeInfo.switchProbability, alternativeWinnerLabel)
      }
      return null
    } else if (driver.flipRiskCategory === 'correlated') {
      // Show qualitative message for correlated factors (contribute to joint risk)
      return 'In some simulations, this factor can change which option is best'
    } else if (driver.flipRiskCategory === 'negligible') {
      // No flip text for negligible factors
      return null
    } else {
      // Fallback: use existing behavior when flip_risk_category is undefined (old PLoT)
      if (driver.fragileEdgeInfo?.switchProbability !== undefined && hasSpecificAlternative) {
        return formatFlipRiskMessage(driver.fragileEdgeInfo.switchProbability, alternativeWinnerLabel)
      }
      return null
    }
  }

  it('isolated category shows ratio format when probability < 0.5', () => {
    const driver = {
      flipRiskCategory: 'isolated' as const,
      fragileEdgeInfo: {
        switchProbability: 0.22,
        alternativeWinnerLabel: 'Keep Pro at £49',
      },
    }
    // Task 1.2: 0.22 < 0.5 → ratio format "~1 in 5"
    expect(getFlipRiskMessage(driver)).toBe(
      'In ~1 in 5 simulations, "Keep Pro at £49" becomes the better choice'
    )
  })

  it('isolated category shows null when no fragile edge info', () => {
    const driver = {
      flipRiskCategory: 'isolated' as const,
      fragileEdgeInfo: undefined,
    }
    expect(getFlipRiskMessage(driver)).toBeNull()
  })

  it('correlated category shows qualitative message (NOT percentage)', () => {
    // This is the key fix: correlated factors should NOT show "0% chance..."
    const driver = {
      flipRiskCategory: 'correlated' as const,
      fragileEdgeInfo: {
        switchProbability: 0, // Would show "0% chance..." without the fix
        alternativeWinnerLabel: 'Option B',
      },
    }
    expect(getFlipRiskMessage(driver)).toBe('In some simulations, this factor can change which option is best')
    expect(getFlipRiskMessage(driver)).not.toContain('0%')
  })

  it('correlated category shows qualitative message even without fragile edge info', () => {
    const driver = {
      flipRiskCategory: 'correlated' as const,
      fragileEdgeInfo: undefined,
    }
    expect(getFlipRiskMessage(driver)).toBe('In some simulations, this factor can change which option is best')
  })

  it('negligible category shows no flip text', () => {
    const driver = {
      flipRiskCategory: 'negligible' as const,
      fragileEdgeInfo: {
        switchProbability: 0.05,
        alternativeWinnerLabel: 'Option C',
      },
    }
    expect(getFlipRiskMessage(driver)).toBeNull()
  })

  it('undefined category (old PLoT) falls back to scenario-tested display', () => {
    // When flip_risk_category is missing (old PLoT version), use formatFlipRiskMessage
    const driver = {
      flipRiskCategory: undefined,
      fragileEdgeInfo: {
        switchProbability: 0.35,
        alternativeWinnerLabel: 'Alternative Option',
      },
    }
    // Task 1.2: 0.35 < 0.5 → ratio format "~1 in 3"
    expect(getFlipRiskMessage(driver)).toBe(
      'In ~1 in 3 simulations, "Alternative Option" becomes the better choice'
    )
  })

  it('undefined category with no fragile edge shows null', () => {
    const driver = {
      fragileEdgeInfo: undefined,
    }
    expect(getFlipRiskMessage(driver)).toBeNull()
  })

  it('ignores "another option" as alternative winner label', () => {
    // Generic "another option" shouldn't trigger the flip risk message
    const driver = {
      flipRiskCategory: 'isolated' as const,
      fragileEdgeInfo: {
        switchProbability: 0.5,
        alternativeWinnerLabel: 'another option',
      },
    }
    expect(getFlipRiskMessage(driver)).toBeNull()
  })
})

// =============================================================================
// Winner Selection Tests
// =============================================================================

describe('determineWinnerSelection', () => {
  it('falls back to expected_outcome when win_probability coverage is partial', () => {
    const options = [
      { id: 'a', expected: 0.4, winProbability: 0.3 },
      { id: 'b', expected: 0.6 },
    ] as any

    const result = determineWinnerSelection(options, null)

    expect(result.determinedBy).toBe('expected_outcome')
    expect(result.recommendedId).toBe('b')
  })

  it('selects by win_probability when coverage is complete', () => {
    const options = [
      { id: 'a', expected: 0.4, winProbability: 0.3 },
      { id: 'b', expected: 0.6, winProbability: 0.8 },
    ] as any

    const result = determineWinnerSelection(options, null)

    expect(result.determinedBy).toBe('win_probability')
    expect(result.recommendedId).toBe('b')
  })

  it('R13: uses expected_outcome path when win_probability is absent (no false coverage)', () => {
    // winProbability is undefined — should NOT be treated as complete coverage
    const options = [
      { id: 'a', expected: 0.9, goalProbability: 0.9 },
      { id: 'b', expected: 0.4, goalProbability: 0.4 },
    ] as any

    const result = determineWinnerSelection(options, null)

    // No win_probability → determinedBy must be expected_outcome, not win_probability
    expect(result.determinedBy).toBe('expected_outcome')
    expect(result.recommendedId).toBe('a') // highest expected wins
  })
})

// =============================================================================
// Hook Runtime Regression Tests (V12)
// =============================================================================

describe('useResultsSectionData runtime safety', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: {
        status: 'idle',
        progress: 0,
      } as any,
      runMeta: {},
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      currentScenarioFraming: null,
      ceeAnalysisReady: undefined,
    })
  })

  it('does not throw when reviewStatus and m1ReviewAssumptions are absent', () => {
    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.isError).toBe(false)
    expect(result.current.confidence.reviewStatus).toBeUndefined()
    expect(result.current.confidence.m2NarrativeSummary).toBeUndefined()
  })

  it('gates m2NarrativeSummary when reviewStatus is not complete', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { fragile_edges: [] },
          option_comparison: [],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {
        reviewStatus: 'in_progress',
        m1ReviewAssumptions: {
          key_assumptions: [],
          narrative_summary: 'Should be hidden',
        },
      } as any,
    })

    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.confidence.reviewStatus).toBe('in_progress')
    expect(result.current.confidence.m2NarrativeSummary).toBeUndefined()
    expect(result.current.recommendation.m2NarrativeSummary).toBeUndefined()
  })

  it('exposes m2NarrativeSummary when reviewStatus is complete', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { fragile_edges: [] },
          option_comparison: [],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {
        reviewStatus: 'complete',
        m1ReviewAssumptions: {
          key_assumptions: [],
          narrative_summary: 'Visible summary',
        },
      } as any,
    })

    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.confidence.m2NarrativeSummary).toBe('Visible summary')
    expect(result.current.recommendation.m2NarrativeSummary).toBe('Visible summary')
  })
})

// =============================================================================
// Track S — factor value provenance survives into data.drivers
// =============================================================================

describe('useResultsSectionData — Track S value provenance into data.drivers', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as any,
      runMeta: {},
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      currentScenarioFraming: null,
      ceeAnalysisReady: undefined,
    })
  })

  const setReportWithFactor = (factor: Record<string, unknown>) => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { fragile_edges: [] },
          option_comparison: [],
          factor_sensitivity: [factor],
        },
      } as any,
      hasCompletedFirstRun: true,
      nodes: [],
      edges: [],
    })
  }

  it('carries value_source / value_extraction_type / value_defaulted=true onto the driver', () => {
    setReportWithFactor({
      factor_id: 'fac_a',
      label: 'Factor A',
      sensitivity_score: 0.5,
      value_source: 'brief_extraction',
      value_extraction_type: 'inferred',
      value_defaulted: true,
    })

    const { result } = renderHook(() => useResultsSectionData())
    const driver = result.current.drivers.drivers[0]

    expect(driver).toBeDefined()
    expect(driver?.valueSource).toBe('brief_extraction')
    expect(driver?.valueExtractionType).toBe('inferred')
    expect(driver?.valueDefaulted).toBe(true)
  })

  it('preserves explicit value_defaulted=false and leaves absent fields absent', () => {
    setReportWithFactor({
      factor_id: 'fac_a',
      label: 'Factor A',
      sensitivity_score: 0.5,
      value_defaulted: false,
      // value_source / value_extraction_type intentionally omitted
    })

    const { result } = renderHook(() => useResultsSectionData())
    const driver = result.current.drivers.drivers[0]

    expect(driver?.valueDefaulted).toBe(false)
    expect(driver?.valueSource).toBeUndefined()
    expect(driver?.valueExtractionType).toBeUndefined()
  })
})

// =============================================================================
// Robustness glyph provenance — PLoT level must NOT drive the display-safe verdict
// =============================================================================

describe('robustness verdict provenance (glyph is not PLoT-driven)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as any,
      runMeta: {},
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      currentScenarioFraming: null,
      ceeAnalysisReady: undefined,
    })
  })

  it('a PLoT robustness.level=high alone does NOT render Robust (robustnessVerdict stays undefined)', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { level: 'high', recommendation_stability: 0.99, fragile_edges: [] },
          option_comparison: [],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [],
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())

    // The structured PLoT level is preserved for qualified/detailed display...
    expect(result.current.recommendation.robustnessLevel).toBe('high')
    // ...but the display-safe verdict that drives the Robust/Sensitive glyph is
    // NOT populated from it — so the glyph renders "Robustness unknown".
    expect(result.current.recommendation.robustnessVerdict).toBeUndefined()
  })

  it('even a UI-SEM-005 fallback (no level, high stability) does NOT populate the verdict', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { recommendation_stability: 0.99, fragile_edges: [] }, // no level → fallback derives one
          option_comparison: [],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [],
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.recommendation.robustnessVerdict).toBeUndefined()
  })
})

// =============================================================================
// Baseline Resolution Tests (Task 2.1)
// =============================================================================

describe('resolveBaselineId', () => {
  const makeOptions = (labels: string[]) =>
    labels.map((label, i) => ({ id: `opt-${i}`, label }))

  const makeNodes = (
    ids: string[],
    baselineIndex?: number
  ) =>
    ids.map((id, i) => ({
      id,
      data: {
        label: `Option ${i}`,
        is_baseline: baselineIndex === i ? true : undefined,
      },
    }))

  it('returns PLoT baseline when is_baseline: true', () => {
    const options = makeOptions(['Option A', 'Option B', 'Status Quo'])
    const nodes = makeNodes(['opt-0', 'opt-1', 'opt-2'], 1) // opt-1 is baseline

    const result = resolveBaselineId(options, nodes as any, undefined)

    expect(result).toBe('opt-1')
  })

  it('returns user-selected baseline when no PLoT baseline', () => {
    const options = makeOptions(['Option A', 'Option B'])
    const nodes = makeNodes(['opt-0', 'opt-1']) // No is_baseline

    const result = resolveBaselineId(options, nodes as any, 'opt-0')

    expect(result).toBe('opt-0')
  })

  it('returns null for invalid user selection', () => {
    const options = makeOptions(['Option A', 'Option B'])
    const nodes = makeNodes(['opt-0', 'opt-1'])

    const result = resolveBaselineId(options, nodes as any, 'invalid-id')

    expect(result).toBeNull()
  })

  it('returns null when label contains Status Quo but no explicit baseline (v7.5)', () => {
    const options = makeOptions(['Option A', 'Status Quo', 'Option C'])
    const nodes = makeNodes(['opt-0', 'opt-1', 'opt-2'])

    const result = resolveBaselineId(options, nodes as any, undefined)

    expect(result).toBeNull() // v7.5: label heuristic removed — only explicit flags
  })

  it('PLoT baseline takes precedence over user selection', () => {
    const options = makeOptions(['Option A', 'Option B'])
    const nodes = makeNodes(['opt-0', 'opt-1'], 0) // opt-0 is PLoT baseline

    const result = resolveBaselineId(options, nodes as any, 'opt-1') // User selected opt-1

    expect(result).toBe('opt-0') // PLoT wins
  })

  it('returns null when no baseline can be resolved', () => {
    const options = makeOptions(['Option A', 'Option B'])
    const nodes = makeNodes(['opt-0', 'opt-1'])

    const result = resolveBaselineId(options, nodes as any, undefined)

    expect(result).toBeNull()
  })
})

// =============================================================================
// B2: "Server wins" integration tests — PLoT classified fields override local computation
// =============================================================================

describe('B2: dominant factor server wins', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { fragile_edges: [] },
          option_comparison: [],
          // B2: PLoT says fac_2 is dominant
          dominant_factor: { factor_id: 'fac_2', factor_label: 'Regulation' },
          factor_sensitivity: [
            // Local heuristic would pick fac_1 (0.8 influence, ratio > 2:1 vs fac_2's 0.2)
            { factor_id: 'fac_1', sensitivity_score: 0.8, importance_rank: 1 },
            { factor_id: 'fac_2', sensitivity_score: 0.2, importance_rank: 2 },
          ],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [
        { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'fac_1', type: 'factor', data: { label: 'Market size', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'fac_2', type: 'factor', data: { label: 'Regulation', kind: 'factor' }, position: { x: 0, y: 0 } },
      ] as any,
      edges: [],
    })
  })

  it('uses PLoT dominant_factor over local heuristic', () => {
    const { result } = renderHook(() => useResultsSectionData())
    // Server says fac_2 (Regulation); local heuristic would say fac_1 (Market size)
    expect(result.current.drivers.dominantFactorId).toBe('fac_2')
    expect(result.current.drivers.dominantFactorLabel).toBe('Regulation')
  })

  it('falls back to legacy when dominant_factor has empty fields', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          robustness: { fragile_edges: [] },
          option_comparison: [],
          // Malformed: empty factor_label
          dominant_factor: { factor_id: 'fac_x', factor_label: '' },
          factor_sensitivity: [
            { factor_id: 'fac_1', sensitivity_score: 0.8, importance_rank: 1 },
            { factor_id: 'fac_2', sensitivity_score: 0.2, importance_rank: 2 },
          ],
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [
        { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'fac_1', type: 'factor', data: { label: 'Market size', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'fac_2', type: 'factor', data: { label: 'Regulation', kind: 'factor' }, position: { x: 0, y: 0 } },
      ] as any,
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())
    // Server dominant_factor is malformed (empty label) — should NOT use it
    expect(result.current.drivers.dominantFactorId).not.toBe('fac_x')
  })
})

// =============================================================================
// B2: Hook-level severity — server severity wins
// =============================================================================

describe('B2: hook-level fragile edge severity', () => {
  it('uses PLoT severity when present on fragile edge', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          option_comparison: [],
          robustness: {
            fragile_edges: [
              {
                edge_id: 'fac_a::goal_1',
                from_id: 'fac_a', to_id: 'goal_1',
                from_label: 'Factor A', to_label: 'Goal',
                switch_probability: 0.3,  // Local heuristic would produce 'warning'
                severity: 'critical',      // Server says critical
              },
            ],
          },
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [
        { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'fac_a', type: 'factor', data: { label: 'Factor A', kind: 'factor' }, position: { x: 0, y: 0 } },
      ] as any,
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())
    const uncertainties = result.current.confidence.uncertainties
    const saEdge = uncertainties.find((u: any) => u.code === 'SENSITIVE_ASSUMPTION')
    // Server severity wins over what local heuristic (0.3 → 'warning') would produce
    expect(saEdge?.severity).toBe('critical')
  })

  it('falls back to legacy severity when PLoT severity absent', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          option_comparison: [],
          robustness: {
            fragile_edges: [
              {
                edge_id: 'fac_b::goal_1',
                from_id: 'fac_b', to_id: 'goal_1',
                from_label: 'Factor B', to_label: 'Goal',
                switch_probability: 0.71,
                // No severity field — pre-B1 cached result
              },
            ],
          },
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [
        { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'fac_b', type: 'factor', data: { label: 'Factor B', kind: 'factor' }, position: { x: 0, y: 0 } },
      ] as any,
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())
    const uncertainties = result.current.confidence.uncertainties
    const saEdge = uncertainties.find((u: any) => u.code === 'SENSITIVE_ASSUMPTION')
    // 0.71 > 0.7 → legacy classifies as 'critical'
    expect(saEdge?.severity).toBe('critical')
  })

  it('challengeFragileEdges carries from_id AND to_id through (analysis-graph projection endpoint resolution)', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        report: {
          run: { critique: [] },
          option_comparison: [],
          robustness: {
            fragile_edges: [
              {
                edge_id: 'fac_c::goal_1',
                from_id: 'fac_c', to_id: 'goal_1',
                from_label: 'Factor C', to_label: 'Goal',
                switch_probability: 0.4,
                alternative_winner_label: 'Alt option',
              },
            ],
          },
        },
      } as any,
      hasCompletedFirstRun: true,
      runMeta: {},
      nodes: [
        { id: 'goal_1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
        { id: 'fac_c', type: 'factor', data: { label: 'Factor C', kind: 'factor' }, position: { x: 0, y: 0 } },
      ] as any,
      edges: [],
    })

    const { result } = renderHook(() => useResultsSectionData())
    const fe = result.current.confidence.challengeFragileEdges?.[0]
    // Both endpoints must survive: the projection resolves a flip risk to its
    // canvas edge via the from→to pair, so a dropped to_id silently disables it.
    expect(fe?.from_id).toBe('fac_c')
    expect(fe?.to_id).toBe('goal_1')
  })
})

describe('Codex B2 — ranking doctrine: order and crown follow the DISPLAYED influence metric', () => {
  it('a high-elasticity/low-influence factor no longer outranks a low-elasticity/high-influence one', () => {
    // Codex review scenario: Investor elasticity 0.9 / influence 19%;
    // Revenue elasticity 0.1 / influence 100%. The bar shows influence, so
    // the order and the rank-1 crown must follow influence.
    const rankMap = computeFactorRanks([
      { key: 'investor', rawElasticity: 0.9, displayValue: 0.19, importanceRank: 1, label: 'Investor Confidence' },
      { key: 'revenue', rawElasticity: 0.1, displayValue: 1.0, importanceRank: 2, label: 'Revenue' },
    ])
    expect(rankMap.get('revenue')).toBe(1)
    expect(rankMap.get('investor')).toBe(2)
  })

  it('without a displayValue the elasticity fallback preserves the historical order (bar falls back too)', () => {
    const rankMap = computeFactorRanks([
      { key: 'a', rawElasticity: 0.9, label: 'A' },
      { key: 'b', rawElasticity: 0.1, label: 'B' },
    ])
    expect(rankMap.get('a')).toBe(1)
    expect(rankMap.get('b')).toBe(2)
  })
})
