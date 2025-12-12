/**
 * CEE Form Adapter Tests
 *
 * Brief 12.4: Tests for CEE form recommendation transformation
 */

import { describe, it, expect, vi } from 'vitest'
import {
  adaptCEEFormResponse,
  normalizeFormType,
  mapConfidenceLevel,
  filterChangedForms,
  partitionByConfidence,
  generateFallbackFormRecommendation,
  batchEdges,
  processBatchesWithRateLimit,
  RATE_LIMIT_CONFIG,
} from '../ceeFormAdapter'
import type { CEEFormRecommendationResponse } from '../ceeFormAdapter'
import type { EdgeFormRecommendation } from '../../components/FunctionalForm/types'

describe('ceeFormAdapter', () => {
  describe('normalizeFormType', () => {
    it('returns valid form types unchanged', () => {
      expect(normalizeFormType('linear')).toBe('linear')
      expect(normalizeFormType('diminishing_returns')).toBe('diminishing_returns')
      expect(normalizeFormType('threshold')).toBe('threshold')
      expect(normalizeFormType('s_curve')).toBe('s_curve')
      expect(normalizeFormType('noisy_or')).toBe('noisy_or')
      expect(normalizeFormType('logistic')).toBe('logistic')
    })

    it('handles common aliases', () => {
      expect(normalizeFormType('log')).toBe('diminishing_returns')
      expect(normalizeFormType('logarithmic')).toBe('diminishing_returns')
      expect(normalizeFormType('diminishing')).toBe('diminishing_returns')
      expect(normalizeFormType('step')).toBe('threshold')
      expect(normalizeFormType('binary')).toBe('threshold')
      expect(normalizeFormType('sigmoid')).toBe('s_curve')
      expect(normalizeFormType('scurve')).toBe('s_curve')
      expect(normalizeFormType('noisyor')).toBe('noisy_or')
      expect(normalizeFormType('or')).toBe('noisy_or')
      expect(normalizeFormType('proportional')).toBe('linear')
    })

    it('normalizes with different casing and separators', () => {
      expect(normalizeFormType('LINEAR')).toBe('linear')
      expect(normalizeFormType('Diminishing-Returns')).toBe('diminishing_returns')
      expect(normalizeFormType('S CURVE')).toBe('s_curve')
    })

    it('defaults to linear for unknown types', () => {
      expect(normalizeFormType('unknown')).toBe('linear')
      expect(normalizeFormType('')).toBe('linear')
      expect(normalizeFormType(undefined)).toBe('linear')
    })
  })

  describe('mapConfidenceLevel', () => {
    it('maps string confidence levels', () => {
      expect(mapConfidenceLevel('high')).toBe('high')
      expect(mapConfidenceLevel('HIGH')).toBe('high')
      expect(mapConfidenceLevel('confident')).toBe('high')
      expect(mapConfidenceLevel('medium')).toBe('medium')
      expect(mapConfidenceLevel('moderate')).toBe('medium')
      expect(mapConfidenceLevel('low')).toBe('low')
      expect(mapConfidenceLevel('uncertain')).toBe('low')
    })

    it('maps numeric confidence levels', () => {
      expect(mapConfidenceLevel(0.9)).toBe('high')
      expect(mapConfidenceLevel(0.7)).toBe('high')
      expect(mapConfidenceLevel(0.6)).toBe('medium')
      expect(mapConfidenceLevel(0.4)).toBe('medium')
      expect(mapConfidenceLevel(0.3)).toBe('low')
      expect(mapConfidenceLevel(0.0)).toBe('low')
    })

    it('defaults to low for missing values', () => {
      expect(mapConfidenceLevel(undefined)).toBe('low')
      expect(mapConfidenceLevel(null as any)).toBe('low')
    })
  })

  describe('adaptCEEFormResponse', () => {
    it('transforms complete CEE response to UI format', () => {
      const rawResponse: CEEFormRecommendationResponse = {
        recommendations: [
          {
            edge_id: 'edge-1',
            source_label: 'Cost',
            target_label: 'Revenue',
            current_form: 'linear',
            recommended_form: 'diminishing_returns',
            confidence: 0.85,
            rationale: 'Cost-revenue relationships typically show diminishing returns',
          },
          {
            edge_id: 'edge-2',
            source_name: 'Risk', // Alternative field name
            target_name: 'Outcome', // Alternative field name
            current_function: 'linear', // Alternative field name
            suggested_form: 'noisy_or', // Alternative field name
            confidence_level: 'medium', // Alternative field name
            explanation: 'Multiple risks combine independently', // Alternative field name
          },
        ],
      }

      const result = adaptCEEFormResponse(rawResponse)

      expect(result).toHaveLength(2)

      expect(result[0]).toEqual({
        edge_id: 'edge-1',
        source_label: 'Cost',
        target_label: 'Revenue',
        current_form: 'linear',
        recommended_form: 'diminishing_returns',
        form_confidence: 'high',
        rationale: 'Cost-revenue relationships typically show diminishing returns',
        auto_applied: false,
        provenance: 'cee',
      })

      expect(result[1].source_label).toBe('Risk')
      expect(result[1].target_label).toBe('Outcome')
      expect(result[1].current_form).toBe('linear')
      expect(result[1].recommended_form).toBe('noisy_or')
      expect(result[1].form_confidence).toBe('medium')
    })

    it('handles alternative response field names', () => {
      const rawResponse: CEEFormRecommendationResponse = {
        suggestions: [{ edge_id: 'e1', suggested_function: 'threshold', reason: 'Pass/fail logic' }],
      }

      const result = adaptCEEFormResponse(rawResponse)

      expect(result).toHaveLength(1)
      expect(result[0].recommended_form).toBe('threshold')
      expect(result[0].rationale).toBe('Pass/fail logic')
    })

    it('handles forms field name', () => {
      const rawResponse: CEEFormRecommendationResponse = {
        forms: [{ edge_id: 'e1', recommended_form: 's_curve' }],
      }

      const result = adaptCEEFormResponse(rawResponse)

      expect(result).toHaveLength(1)
      expect(result[0].recommended_form).toBe('s_curve')
    })

    it('returns empty array for empty response', () => {
      expect(adaptCEEFormResponse({})).toEqual([])
      expect(adaptCEEFormResponse({ recommendations: [] })).toEqual([])
    })

    it('provides default values for missing fields', () => {
      const rawResponse: CEEFormRecommendationResponse = {
        recommendations: [{ edge_id: 'e1' }],
      }

      const result = adaptCEEFormResponse(rawResponse)

      expect(result[0].source_label).toBe('Source')
      expect(result[0].target_label).toBe('Target')
      expect(result[0].current_form).toBe('linear')
      expect(result[0].recommended_form).toBe('linear')
      expect(result[0].form_confidence).toBe('low')
      expect(result[0].rationale).toContain('domain patterns')
    })
  })

  describe('filterChangedForms', () => {
    it('filters out recommendations where form is unchanged', () => {
      const recommendations: EdgeFormRecommendation[] = [
        { edge_id: 'e1', source_label: 'A', target_label: 'B', current_form: 'linear', recommended_form: 'threshold', form_confidence: 'high', rationale: '', auto_applied: false, provenance: 'cee' },
        { edge_id: 'e2', source_label: 'C', target_label: 'D', current_form: 'linear', recommended_form: 'linear', form_confidence: 'medium', rationale: '', auto_applied: false, provenance: 'cee' },
        { edge_id: 'e3', source_label: 'E', target_label: 'F', current_form: 'threshold', recommended_form: 's_curve', form_confidence: 'low', rationale: '', auto_applied: false, provenance: 'cee' },
      ]

      const result = filterChangedForms(recommendations)

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.edge_id)).toEqual(['e1', 'e3'])
    })
  })

  describe('partitionByConfidence', () => {
    it('partitions recommendations by confidence level', () => {
      const recommendations: EdgeFormRecommendation[] = [
        { edge_id: 'e1', source_label: 'A', target_label: 'B', current_form: 'linear', recommended_form: 'threshold', form_confidence: 'high', rationale: '', auto_applied: false, provenance: 'cee' },
        { edge_id: 'e2', source_label: 'C', target_label: 'D', current_form: 'linear', recommended_form: 's_curve', form_confidence: 'medium', rationale: '', auto_applied: false, provenance: 'cee' },
        { edge_id: 'e3', source_label: 'E', target_label: 'F', current_form: 'linear', recommended_form: 'noisy_or', form_confidence: 'low', rationale: '', auto_applied: false, provenance: 'cee' },
        { edge_id: 'e4', source_label: 'G', target_label: 'H', current_form: 'linear', recommended_form: 'threshold', form_confidence: 'high', rationale: '', auto_applied: false, provenance: 'cee' },
      ]

      const result = partitionByConfidence(recommendations)

      expect(result.high).toHaveLength(2)
      expect(result.medium).toHaveLength(1)
      expect(result.low).toHaveLength(1)
      expect(result.high.map((r) => r.edge_id)).toEqual(['e1', 'e4'])
    })
  })

  describe('generateFallbackFormRecommendation', () => {
    it('suggests noisy_or for risk to outcome edges', () => {
      const result = generateFallbackFormRecommendation(
        'e1',
        'Market Risk',
        'Project Success',
        'risk',
        'outcome',
        'linear'
      )

      expect(result).not.toBeNull()
      expect(result?.recommended_form).toBe('noisy_or')
      expect(result?.form_confidence).toBe('medium')
    })

    it('suggests diminishing_returns for investment edges', () => {
      const result = generateFallbackFormRecommendation(
        'e1',
        'Marketing Budget',
        'Sales',
        'factor',
        'outcome',
        'linear'
      )

      expect(result).not.toBeNull()
      expect(result?.recommended_form).toBe('diminishing_returns')
    })

    it('suggests s_curve for adoption patterns', () => {
      const result = generateFallbackFormRecommendation(
        'e1',
        'Product Quality', // Source that doesn't trigger other rules
        'Market Adoption',
        'factor',
        'outcome',
        'linear'
      )

      expect(result).not.toBeNull()
      expect(result?.recommended_form).toBe('s_curve')
    })

    it('suggests threshold for compliance edges', () => {
      const result = generateFallbackFormRecommendation(
        'e1',
        'Regulatory Compliance',
        'License Approval',
        'factor',
        'outcome',
        'linear'
      )

      expect(result).not.toBeNull()
      expect(result?.recommended_form).toBe('threshold')
    })

    it('returns null when form would not change', () => {
      const result = generateFallbackFormRecommendation(
        'e1',
        'Generic Factor',
        'Generic Outcome',
        'factor',
        'outcome',
        'linear' // Already linear, and no special pattern detected
      )

      expect(result).toBeNull()
    })
  })

  describe('batchEdges', () => {
    it('splits edges into batches of specified size', () => {
      const edges = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }))

      const batches = batchEdges(edges, 10)

      expect(batches).toHaveLength(3)
      expect(batches[0]).toHaveLength(10)
      expect(batches[1]).toHaveLength(10)
      expect(batches[2]).toHaveLength(5)
    })

    it('returns single batch for small arrays', () => {
      const edges = Array.from({ length: 5 }, (_, i) => ({ id: `e${i}` }))

      const batches = batchEdges(edges, 10)

      expect(batches).toHaveLength(1)
      expect(batches[0]).toHaveLength(5)
    })

    it('uses default batch size from config', () => {
      const edges = Array.from({ length: 15 }, (_, i) => ({ id: `e${i}` }))

      const batches = batchEdges(edges)

      expect(batches).toHaveLength(2) // 10 + 5 with default MAX_EDGES_PER_BATCH = 10
    })
  })

  describe('processBatchesWithRateLimit', () => {
    it('processes all batches and returns results', async () => {
      const batches = [[1, 2], [3, 4], [5, 6]]
      const processor = vi.fn(async (batch: number[]) => batch.map((n) => n * 2))

      const results = await processBatchesWithRateLimit(batches, processor, 2, 10)

      expect(processor).toHaveBeenCalledTimes(3)
      expect(results).toHaveLength(3)
      expect(results.flat()).toEqual([2, 4, 6, 8, 10, 12])
    })

    it('respects concurrency limit', async () => {
      const batches = [[1], [2], [3], [4], [5]]
      let concurrent = 0
      let maxConcurrent = 0

      const processor = vi.fn(async (batch: number[]) => {
        concurrent++
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((r) => setTimeout(r, 50))
        concurrent--
        return batch
      })

      await processBatchesWithRateLimit(batches, processor, 2, 0)

      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })
  })

  describe('RATE_LIMIT_CONFIG', () => {
    it('exports expected configuration values', () => {
      expect(RATE_LIMIT_CONFIG.MAX_CONCURRENT_REQUESTS).toBe(3)
      expect(RATE_LIMIT_CONFIG.BATCH_DELAY_MS).toBe(100)
      expect(RATE_LIMIT_CONFIG.MAX_EDGES_PER_BATCH).toBe(10)
    })
  })
})
