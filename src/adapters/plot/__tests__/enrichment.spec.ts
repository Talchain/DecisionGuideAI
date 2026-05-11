/**
 * Tests for PLoT Enrichment Adapters
 *
 * Phase 1B: Routing Consolidation Implementation
 *
 * These tests verify:
 * 1. Type guards correctly identify enrichment presence
 * 2. Adapters correctly transform PLoT enrichment to UI data structures
 * 3. Feature flag controls enrichment consumption
 * 4. Graceful degradation when enrichment is missing/malformed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hasEnrichment,
  hasSensitivityAnalysis,
  hasFactorSensitivity,
  hasCausalValidation,
  hasRobustnessAnalysis,
  hasValidation,
  hasConformal,
  isEnrichmentDegraded,
  supportsSensitivityAnalysis,
  supportsValidation,
  extractRobustnessFromEnrichment,
  extractValidationFromEnrichment,
  getRobustnessData,
  getValidationData,
  getEnrichmentAvailability,
  adaptFactorToSensitiveParam,
  type PLoTResponseWithEnrichment,
  type PLoTEnrichment,
  type PLoTFactorSensitivity,
} from '../enrichment'

// Mock the feature flag module
vi.mock('../../../flags', () => ({
  isPlotEnrichmentEnabled: vi.fn(() => false),
}))

import { isPlotEnrichmentEnabled } from '../../../flags'

// =============================================================================
// Test Fixtures
// =============================================================================

function createMinimalResponse(): PLoTResponseWithEnrichment {
  return {
    result: {
      answer: 'test',
      confidence: 0.8,
      explanation: 'test explanation',
    },
    execution_ms: 100,
  }
}

function createResponseWithEnrichment(
  enrichment: Partial<PLoTEnrichment> = {}
): PLoTResponseWithEnrichment {
  return {
    result: {
      answer: 'test',
      confidence: 0.8,
      explanation: 'test explanation',
    },
    execution_ms: 100,
    enrichment: {
      metadata: {
        isl_enabled: true,
        detail_level: 'deep',
      },
      ...enrichment,
    },
  }
}

function createFullEnrichment(): PLoTEnrichment {
  return {
    causal_validation: {
      identifiable: true,
      confidence: 0.9,
      adjustment_sets: [['X', 'Y']],
      confounders: ['Z'],
      instruments: [],
      warnings: ['Consider adding more variables'],
    },
    sensitivity_analysis: {
      overall_robustness: 0.75,
      edges: [
        {
          edge_id: 'e1',
          from: 'factor1',
          to: 'goal',
          sensitivity_score: 0.8,
          existence_sensitivity: 0.3,
          magnitude_sensitivity: 0.5,
        },
        {
          edge_id: 'e2',
          from: 'factor2',
          to: 'goal',
          sensitivity_score: 0.4,
        },
      ],
      factors: [
        {
          factor_id: 'price',
          sensitivity_score: 0.85,
          direction: 'negative',
        },
        {
          factor_id: 'demand',
          sensitivity_score: 0.6,
          direction: 'positive',
        },
        {
          factor_id: 'complexity',
          sensitivity_score: 0.45,
          direction: 'mixed',
        },
      ],
      top_drivers: ['factor1', 'factor2'],
      fragile_edges: ['e1'],
    },
    metadata: {
      isl_enabled: true,
      detail_level: 'deep',
      isl_latency_ms: 150,
      isl_degraded: false,
      factor_sensitivity_status: 'available',
      factor_sensitivity_count: 3,
      isl_endpoints_called: ['/causal/sensitivity/detailed', '/robustness/analyze/v2'],
    },
  }
}

// =============================================================================
// Type Guards Tests
// =============================================================================

describe('PLoT Enrichment Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Type Guards', () => {
    describe('hasEnrichment', () => {
      it('returns false for null response', () => {
        expect(hasEnrichment(null)).toBe(false)
      })

      it('returns false for undefined response', () => {
        expect(hasEnrichment(undefined)).toBe(false)
      })

      it('returns false for response without enrichment', () => {
        expect(hasEnrichment(createMinimalResponse())).toBe(false)
      })

      it('returns false for response with null enrichment', () => {
        const response = { ...createMinimalResponse(), enrichment: null } as any
        expect(hasEnrichment(response)).toBe(false)
      })

      it('returns false for enrichment without metadata', () => {
        const response = { ...createMinimalResponse(), enrichment: {} } as any
        expect(hasEnrichment(response)).toBe(false)
      })

      it('returns true for response with valid enrichment', () => {
        const response = createResponseWithEnrichment()
        expect(hasEnrichment(response)).toBe(true)
      })

      it('returns true for response with full enrichment', () => {
        const response = createResponseWithEnrichment(createFullEnrichment())
        expect(hasEnrichment(response)).toBe(true)
      })
    })

    describe('hasSensitivityAnalysis', () => {
      it('returns false for null enrichment', () => {
        expect(hasSensitivityAnalysis(null)).toBe(false)
      })

      it('returns false for undefined enrichment', () => {
        expect(hasSensitivityAnalysis(undefined)).toBe(false)
      })

      it('returns false for enrichment without sensitivity_analysis', () => {
        const enrichment: PLoTEnrichment = {
          metadata: { isl_enabled: true, detail_level: 'standard' },
        }
        expect(hasSensitivityAnalysis(enrichment)).toBe(false)
      })

      it('returns false for sensitivity_analysis without edges array', () => {
        const enrichment = {
          metadata: { isl_enabled: true, detail_level: 'deep' },
          sensitivity_analysis: { overall_robustness: 0.5 },
        } as any
        expect(hasSensitivityAnalysis(enrichment)).toBe(false)
      })

      it('returns true for valid sensitivity_analysis', () => {
        const enrichment = createFullEnrichment()
        expect(hasSensitivityAnalysis(enrichment)).toBe(true)
      })
    })

    describe('hasFactorSensitivity', () => {
      it('returns false for null enrichment', () => {
        expect(hasFactorSensitivity(null)).toBe(false)
      })

      it('returns false for undefined enrichment', () => {
        expect(hasFactorSensitivity(undefined)).toBe(false)
      })

      it('returns false for enrichment without sensitivity_analysis', () => {
        const enrichment: PLoTEnrichment = {
          metadata: { isl_enabled: true, detail_level: 'standard' },
        }
        expect(hasFactorSensitivity(enrichment)).toBe(false)
      })

      it('returns false for sensitivity_analysis without factors', () => {
        const enrichment = {
          metadata: { isl_enabled: true, detail_level: 'deep' },
          sensitivity_analysis: {
            overall_robustness: 0.5,
            edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.5 }],
          },
        } as PLoTEnrichment
        expect(hasFactorSensitivity(enrichment)).toBe(false)
      })

      it('returns false for empty factors array', () => {
        const enrichment = {
          metadata: { isl_enabled: true, detail_level: 'deep' },
          sensitivity_analysis: {
            overall_robustness: 0.5,
            edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.5 }],
            factors: [],
          },
        } as PLoTEnrichment
        expect(hasFactorSensitivity(enrichment)).toBe(false)
      })

      it('returns true for valid factors array', () => {
        const enrichment = createFullEnrichment()
        expect(hasFactorSensitivity(enrichment)).toBe(true)
      })
    })

    describe('hasCausalValidation', () => {
      it('returns false for null enrichment', () => {
        expect(hasCausalValidation(null)).toBe(false)
      })

      it('returns false for enrichment without causal_validation', () => {
        const enrichment: PLoTEnrichment = {
          metadata: { isl_enabled: true, detail_level: 'quick' },
        }
        expect(hasCausalValidation(enrichment)).toBe(false)
      })

      it('returns false for causal_validation without identifiable', () => {
        const enrichment = {
          metadata: { isl_enabled: true, detail_level: 'standard' },
          causal_validation: { confidence: 0.8 },
        } as any
        expect(hasCausalValidation(enrichment)).toBe(false)
      })

      it('returns true for valid causal_validation', () => {
        const enrichment = createFullEnrichment()
        expect(hasCausalValidation(enrichment)).toBe(true)
      })
    })

    describe('isEnrichmentDegraded', () => {
      it('returns false for null enrichment', () => {
        expect(isEnrichmentDegraded(null)).toBe(false)
      })

      it('returns false when isl_degraded is false', () => {
        const enrichment = createFullEnrichment()
        expect(isEnrichmentDegraded(enrichment)).toBe(false)
      })

      it('returns false when isl_degraded is undefined', () => {
        const enrichment: PLoTEnrichment = {
          metadata: { isl_enabled: true, detail_level: 'deep' },
        }
        expect(isEnrichmentDegraded(enrichment)).toBe(false)
      })

      it('returns true when isl_degraded is true', () => {
        const enrichment: PLoTEnrichment = {
          metadata: { isl_enabled: true, detail_level: 'deep', isl_degraded: true },
        }
        expect(isEnrichmentDegraded(enrichment)).toBe(true)
      })
    })

    describe('supportsSensitivityAnalysis', () => {
      it('returns true only for deep detail_level', () => {
        expect(
          supportsSensitivityAnalysis({
            metadata: { isl_enabled: true, detail_level: 'deep' },
          })
        ).toBe(true)
        expect(
          supportsSensitivityAnalysis({
            metadata: { isl_enabled: true, detail_level: 'standard' },
          })
        ).toBe(false)
        expect(
          supportsSensitivityAnalysis({
            metadata: { isl_enabled: true, detail_level: 'quick' },
          })
        ).toBe(false)
      })
    })

    describe('supportsValidation', () => {
      it('returns true for standard and deep detail_level', () => {
        expect(
          supportsValidation({
            metadata: { isl_enabled: true, detail_level: 'deep' },
          })
        ).toBe(true)
        expect(
          supportsValidation({
            metadata: { isl_enabled: true, detail_level: 'standard' },
          })
        ).toBe(true)
        expect(
          supportsValidation({
            metadata: { isl_enabled: true, detail_level: 'quick' },
          })
        ).toBe(false)
      })
    })

    // Legacy compatibility tests
    describe('Legacy type guards', () => {
      it('hasRobustnessAnalysis is alias for hasSensitivityAnalysis', () => {
        const enrichment = createFullEnrichment()
        expect(hasRobustnessAnalysis(enrichment)).toBe(hasSensitivityAnalysis(enrichment))
      })

      it('hasValidation is alias for hasCausalValidation', () => {
        const enrichment = createFullEnrichment()
        expect(hasValidation(enrichment)).toBe(hasCausalValidation(enrichment))
      })

      it('hasConformal always returns false (not in PLoT enrichment)', () => {
        const enrichment = createFullEnrichment()
        expect(hasConformal(enrichment)).toBe(false)
      })
    })
  })

  // =============================================================================
  // Adapter Tests
  // =============================================================================

  describe('extractRobustnessFromEnrichment', () => {
    it('returns null when feature flag is disabled', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(false)
      const response = createResponseWithEnrichment(createFullEnrichment())
      expect(extractRobustnessFromEnrichment(response)).toBe(null)
    })

    it('returns null when response is null', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      expect(extractRobustnessFromEnrichment(null)).toBe(null)
    })

    it('returns null when response has no enrichment', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      expect(extractRobustnessFromEnrichment(createMinimalResponse())).toBe(null)
    })

    it('returns null when enrichment is degraded', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment({
        ...createFullEnrichment(),
        metadata: { isl_enabled: true, detail_level: 'deep', isl_degraded: true },
      })
      expect(extractRobustnessFromEnrichment(response)).toBe(null)
    })

    it('returns null when sensitivity_analysis is missing', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment({
        metadata: { isl_enabled: true, detail_level: 'standard' },
        causal_validation: { identifiable: true },
      })
      expect(extractRobustnessFromEnrichment(response)).toBe(null)
    })

    it('extracts robustness data from valid enrichment', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment(createFullEnrichment())

      const result = extractRobustnessFromEnrichment(response)

      expect(result).not.toBe(null)
      expect(result!.robustness_label).toBe('moderate') // 0.75 overall_robustness (< 0.85 threshold)
      // 3 factors + 2 edges = 5 total sensitivity items (factors sorted first, then edges)
      expect(result!.sensitivity).toHaveLength(5)
      // Factors come first (sorted by sensitivity score), then edges
      expect(result!.sensitivity[0].node_id).toBe('price') // factor: 0.85
      expect(result!.sensitivity[0].sensitivity).toBe(0.85)
      expect(result!.sensitivity[1].node_id).toBe('demand') // factor: 0.6
      expect(result!.sensitivity[2].node_id).toBe('complexity') // factor: 0.45
      expect(result!.sensitivity[3].sensitivity).toBe(0.8) // edge: highest
      expect(result!.sensitivity[4].sensitivity).toBe(0.4) // edge: second
      expect(result!.narrative).toContain('moderate sensitivity')
      expect(result!.narrative).toContain('3 factors') // narrative includes factor count
    })

    it('derives correct robustness labels from scores', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      // High robustness (>= 0.85)
      const highResponse = createResponseWithEnrichment({
        sensitivity_analysis: {
          overall_robustness: 0.9,
          edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.2 }],
        },
        metadata: { isl_enabled: true, detail_level: 'deep' },
      })
      expect(extractRobustnessFromEnrichment(highResponse)!.robustness_label).toBe('robust')

      // Medium robustness (0.70 - 0.84)
      const medResponse = createResponseWithEnrichment({
        sensitivity_analysis: {
          overall_robustness: 0.75,
          edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.5 }],
        },
        metadata: { isl_enabled: true, detail_level: 'deep' },
      })
      expect(extractRobustnessFromEnrichment(medResponse)!.robustness_label).toBe('moderate')

      // Low robustness (< 0.4)
      const lowResponse = createResponseWithEnrichment({
        sensitivity_analysis: {
          overall_robustness: 0.2,
          edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.9 }],
        },
        metadata: { isl_enabled: true, detail_level: 'deep' },
      })
      expect(extractRobustnessFromEnrichment(lowResponse)!.robustness_label).toBe('fragile')
    })

    // Bug 4 regression: when overall_robustness is the string 'unknown',
    // generateNarrativeFromSensitivity used to fall through the switch and
    // return undefined, causing the narrative section to silently not render.
    // The 'unknown' case now returns a non-empty fallback narrative.
    it('returns a non-empty narrative when robustness label is unknown', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment({
        sensitivity_analysis: {
          overall_robustness: 'unknown',
          edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.5 }],
          top_drivers: ['price', 'demand'],
        },
        metadata: { isl_enabled: true, detail_level: 'deep' },
      })

      const result = extractRobustnessFromEnrichment(response)
      expect(result).not.toBe(null)
      expect(result!.robustness_label).toBe('unknown')
      expect(typeof result!.narrative).toBe('string')
      expect(result!.narrative.length).toBeGreaterThan(0)
      expect(result!.narrative).toContain('could not be assessed')
    })
  })

  describe('extractValidationFromEnrichment', () => {
    it('returns null when feature flag is disabled', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(false)
      const response = createResponseWithEnrichment(createFullEnrichment())
      expect(extractValidationFromEnrichment(response)).toBe(null)
    })

    it('returns null when causal_validation is missing', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment({
        metadata: { isl_enabled: true, detail_level: 'quick' },
      })
      expect(extractValidationFromEnrichment(response)).toBe(null)
    })

    it('extracts validation data from valid enrichment', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment(createFullEnrichment())

      const result = extractValidationFromEnrichment(response)

      expect(result).not.toBe(null)
      expect(result!.valid).toBe(true)
      expect(result!.suggestions).toHaveLength(1) // 1 warning
      expect(result!.graph_health.logical_consistency).toBe(0.9)
    })

    it('adds identifiability error when not identifiable', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)
      const response = createResponseWithEnrichment({
        causal_validation: {
          identifiable: false,
          confounders: ['Z'],
          warnings: ['Some warning'],
        },
        metadata: { isl_enabled: true, detail_level: 'standard' },
      })

      const result = extractValidationFromEnrichment(response)

      expect(result).not.toBe(null)
      expect(result!.valid).toBe(false)
      expect(result!.suggestions[0].severity).toBe('error')
      expect(result!.suggestions[0].message).toContain('not identifiable')
    })
  })

  // =============================================================================
  // Strategy Pattern Tests
  // =============================================================================

  describe('getRobustnessData', () => {
    it('uses ISL fallback when flag is disabled', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(false)

      const mockRobustnessResult = {
        option_rankings: [],
        recommendation: { option_id: 'opt1', confidence: 'high' as const, recommendation_status: 'clear' as const },
        sensitivity: [],
        robustness_label: 'robust' as const,
        robustness_bounds: [],
        value_of_information: [],
        narrative: 'Test narrative',
      }

      const fetchFromISL = vi.fn().mockResolvedValue(mockRobustnessResult)

      const result = await getRobustnessData({
        plotResponse: createResponseWithEnrichment(createFullEnrichment()),
        fetchFromISL,
      })

      expect(fetchFromISL).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRobustnessResult)
    })

    it('uses enrichment when flag is enabled and enrichment available', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const fetchFromISL = vi.fn()

      const result = await getRobustnessData({
        plotResponse: createResponseWithEnrichment(createFullEnrichment()),
        fetchFromISL,
      })

      expect(fetchFromISL).not.toHaveBeenCalled()
      expect(result).not.toBe(null)
      expect(result!.robustness_label).toBe('moderate') // 0.75 >= 0.70 but < 0.85
    })

    it('falls back to ISL when enrichment is not available', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const mockRobustnessResult = {
        option_rankings: [],
        recommendation: { option_id: '', confidence: 'medium' as const, recommendation_status: 'uncertain' as const },
        sensitivity: [],
        robustness_label: 'moderate' as const,
        robustness_bounds: [],
        value_of_information: [],
        narrative: 'Fallback',
      }

      const fetchFromISL = vi.fn().mockResolvedValue(mockRobustnessResult)

      const result = await getRobustnessData({
        plotResponse: createMinimalResponse(),
        fetchFromISL,
      })

      expect(fetchFromISL).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockRobustnessResult)
    })

    it('falls back to ISL when plotResponse is null', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const mockResult = {
        option_rankings: [],
        recommendation: { option_id: '', confidence: 'low' as const, recommendation_status: 'uncertain' as const },
        sensitivity: [],
        robustness_label: 'fragile' as const,
        robustness_bounds: [],
        value_of_information: [],
        narrative: 'From ISL',
      }

      const fetchFromISL = vi.fn().mockResolvedValue(mockResult)

      const result = await getRobustnessData({
        plotResponse: null,
        fetchFromISL,
      })

      expect(fetchFromISL).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockResult)
    })

    it('handles ISL fetch failure', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const fetchFromISL = vi.fn().mockRejectedValue(new Error('ISL unavailable'))

      await expect(
        getRobustnessData({
          plotResponse: null,
          fetchFromISL,
        })
      ).rejects.toThrow('ISL unavailable')
    })
  })

  describe('getValidationData', () => {
    it('uses ISL fallback when flag is disabled', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(false)

      const mockValidationResult = {
        valid: true,
        suggestions: [],
        graph_health: { completeness: 1, connectivity: 1, logical_consistency: 1 },
      }

      const fetchFromISL = vi.fn().mockResolvedValue(mockValidationResult)

      const result = await getValidationData({
        plotResponse: createResponseWithEnrichment(createFullEnrichment()),
        fetchFromISL,
      })

      expect(fetchFromISL).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockValidationResult)
    })

    it('uses enrichment when flag is enabled and enrichment available', async () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const fetchFromISL = vi.fn()

      const result = await getValidationData({
        plotResponse: createResponseWithEnrichment(createFullEnrichment()),
        fetchFromISL,
      })

      expect(fetchFromISL).not.toHaveBeenCalled()
      expect(result).not.toBe(null)
      expect(result!.valid).toBe(true)
    })
  })

  // =============================================================================
  // Utility Function Tests
  // =============================================================================

  describe('getEnrichmentAvailability', () => {
    it('returns unavailable for null response', () => {
      const availability = getEnrichmentAvailability(null)
      expect(availability).toEqual({
        available: false,
        degraded: false,
        detailLevel: null,
        hasSensitivity: false,
        hasFactorSensitivity: false,
        hasValidation: false,
        factorSensitivityStatus: null,
        factorSensitivityCount: 0,
        islEndpointsCalled: [],
      })
    })

    it('returns unavailable for response without enrichment', () => {
      const availability = getEnrichmentAvailability(createMinimalResponse())
      expect(availability.available).toBe(false)
      expect(availability.hasFactorSensitivity).toBe(false)
      expect(availability.factorSensitivityCount).toBe(0)
    })

    it('returns full availability info for complete enrichment', () => {
      const response = createResponseWithEnrichment(createFullEnrichment())
      const availability = getEnrichmentAvailability(response)

      expect(availability).toEqual({
        available: true,
        degraded: false,
        detailLevel: 'deep',
        hasSensitivity: true,
        hasFactorSensitivity: true,
        hasValidation: true,
        factorSensitivityStatus: 'available',
        factorSensitivityCount: 3,
        islEndpointsCalled: ['/causal/sensitivity/detailed', '/robustness/analyze/v2'],
      })
    })

    it('shows degraded state correctly', () => {
      const response = createResponseWithEnrichment({
        metadata: { isl_enabled: true, detail_level: 'deep', isl_degraded: true },
      })
      const availability = getEnrichmentAvailability(response)

      expect(availability.available).toBe(true)
      expect(availability.degraded).toBe(true)
      expect(availability.hasFactorSensitivity).toBe(false)
    })

    it('handles factor sensitivity without explicit status', () => {
      const response = createResponseWithEnrichment({
        sensitivity_analysis: {
          overall_robustness: 0.5,
          edges: [{ edge_id: 'e1', from: 'a', to: 'b', sensitivity_score: 0.5 }],
          factors: [{ factor_id: 'f1', sensitivity_score: 0.7, direction: 'positive' }],
        },
        metadata: { isl_enabled: true, detail_level: 'deep' },
      })
      const availability = getEnrichmentAvailability(response)

      expect(availability.hasFactorSensitivity).toBe(true)
      expect(availability.factorSensitivityStatus).toBe('available')
      expect(availability.factorSensitivityCount).toBe(1)
    })
  })

  // =============================================================================
  // Factor Sensitivity Adapter Tests
  // =============================================================================

  describe('adaptFactorToSensitiveParam', () => {
    it('adapts positive direction factor correctly', () => {
      const factor: PLoTFactorSensitivity = {
        factor_id: 'revenue',
        sensitivity_score: 0.8,
        direction: 'positive',
      }

      const result = adaptFactorToSensitiveParam(factor)

      expect(result.node_id).toBe('revenue')
      expect(result.label).toBe('revenue')
      expect(result.direction).toBe('increase')
      expect(result.sensitivity).toBe(0.8)
      expect(result.explanation).toBe('Impact direction: positive')
      // High sensitivity (> 0.7) should have lower flip threshold
      expect(result.flip_threshold).toBe(0.3)
    })

    it('adapts negative direction factor correctly', () => {
      const factor: PLoTFactorSensitivity = {
        factor_id: 'cost',
        sensitivity_score: 0.6,
        direction: 'negative',
      }

      const result = adaptFactorToSensitiveParam(factor)

      expect(result.node_id).toBe('cost')
      expect(result.direction).toBe('decrease')
      expect(result.sensitivity).toBe(0.6)
      expect(result.explanation).toBe('Impact direction: negative')
      // Medium sensitivity (<= 0.7) should have standard flip threshold
      expect(result.flip_threshold).toBe(0.5)
    })

    it('adapts mixed direction factor with explanatory note', () => {
      const factor: PLoTFactorSensitivity = {
        factor_id: 'complexity',
        sensitivity_score: 0.5,
        direction: 'mixed',
      }

      const result = adaptFactorToSensitiveParam(factor)

      expect(result.node_id).toBe('complexity')
      // Mixed defaults to 'increase'
      expect(result.direction).toBe('increase')
      expect(result.sensitivity).toBe(0.5)
      // Mixed direction should have special explanation
      expect(result.explanation).toBe('Non-monotonic impact: effect varies with value')
    })

    it('uses default current_value of 0.5', () => {
      const factor: PLoTFactorSensitivity = {
        factor_id: 'test',
        sensitivity_score: 0.3,
        direction: 'positive',
      }

      const result = adaptFactorToSensitiveParam(factor)

      expect(result.current_value).toBe(0.5)
    })
  })

  // =============================================================================
  // Graceful Degradation Tests
  // =============================================================================

  describe('Graceful Degradation Scenarios', () => {
    it('handles completely missing enrichment without crashing', () => {
      const response = createMinimalResponse()

      expect(() => hasEnrichment(response)).not.toThrow()
      expect(() => extractRobustnessFromEnrichment(response)).not.toThrow()
      expect(hasEnrichment(response)).toBe(false)
    })

    it('handles partially populated enrichment', () => {
      const response = createResponseWithEnrichment({
        causal_validation: { identifiable: true },
        metadata: { isl_enabled: true, detail_level: 'standard' },
      })

      expect(hasEnrichment(response)).toBe(true)
      expect(hasCausalValidation(response.enrichment)).toBe(true)
      expect(hasSensitivityAnalysis(response.enrichment)).toBe(false)
    })

    it('handles malformed enrichment data without crashing', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const response = {
        result: { answer: 'test', confidence: 0.8, explanation: 'test' },
        execution_ms: 100,
        enrichment: {
          metadata: { isl_enabled: true, detail_level: 'deep' },
          sensitivity_analysis: 'not an object' as any,
        },
      }

      expect(() => extractRobustnessFromEnrichment(response)).not.toThrow()
      expect(extractRobustnessFromEnrichment(response)).toBe(null)
    })

    it('handles degraded ISL gracefully', () => {
      vi.mocked(isPlotEnrichmentEnabled).mockReturnValue(true)

      const response = createResponseWithEnrichment({
        ...createFullEnrichment(),
        metadata: {
          isl_enabled: true,
          detail_level: 'deep',
          isl_degraded: true,
          isl_latency_ms: 5000,
        },
      })

      // Should not use degraded data
      expect(extractRobustnessFromEnrichment(response)).toBe(null)
      expect(extractValidationFromEnrichment(response)).toBe(null)
    })
  })
})
