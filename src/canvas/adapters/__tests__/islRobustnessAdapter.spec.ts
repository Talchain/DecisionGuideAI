/**
 * ISL Robustness Adapter Tests
 *
 * Brief 12.3: Tests for ISL response transformation
 */

import { describe, it, expect } from 'vitest'
import {
  adaptISLRobustnessResponse,
  generateFallbackRobustness,
  deriveConfidenceFromSpread,
  inferRobustnessLabel,
} from '../islRobustnessAdapter'
import type { ISLRobustnessResponse } from '../islRobustnessAdapter'

describe('islRobustnessAdapter', () => {
  describe('adaptISLRobustnessResponse', () => {
    it('transforms complete ISL response to UI format', () => {
      const rawResponse: ISLRobustnessResponse = {
        option_rankings: [
          {
            option_id: 'opt-1',
            option_label: 'Option A',
            rank: 1,
            expected_value: 0.75,
            confidence: 'high',
            robust_winner: true,
          },
          {
            option_id: 'opt-2',
            label: 'Option B', // Alternative field name
            rank: 2,
            ev: 0.6, // Alternative field name
            is_robust: false, // Alternative field name
          },
        ],
        recommendation: {
          option_id: 'opt-1',
          confidence: 'high',
          recommendation_status: 'clear',
        },
        sensitivity: [
          {
            node_id: 'node-1',
            label: 'Price Sensitivity',
            current_value: 0.7,
            flip_threshold: 0.4,
            direction: 'decrease',
            sensitivity: 0.8,
            explanation: 'High impact on outcome',
          },
        ],
        robustness_label: 'robust',
        robustness_bounds: [
          {
            scenario: 'Pessimistic',
            lower: 0.5,
            upper: 0.9,
            varied_parameters: ['node-1'],
          },
        ],
        value_of_information: [
          {
            node_id: 'node-2',
            label: 'Market Size',
            evpi: 0.12,
            worth_investigating: true,
            suggested_action: 'Conduct market research',
          },
        ],
        narrative: 'The recommendation is robust to parameter variations.',
        pareto: {
          frontier: ['opt-1', 'opt-3'],
          dominated: ['opt-2'],
          tradeoff_narrative: 'Option 1 maximizes profit, Option 3 minimizes risk',
          criteria: ['profit', 'risk'],
        },
      }

      const result = adaptISLRobustnessResponse(rawResponse)

      // Check option rankings
      expect(result.option_rankings).toHaveLength(2)
      expect(result.option_rankings[0]).toEqual({
        option_id: 'opt-1',
        option_label: 'Option A',
        rank: 1,
        expected_value: 0.75,
        confidence: 'high',
        robust_winner: true,
        loses_in_scenarios: undefined,
      })
      // Check alternative field name handling
      expect(result.option_rankings[1].option_label).toBe('Option B')
      expect(result.option_rankings[1].expected_value).toBe(0.6)
      expect(result.option_rankings[1].robust_winner).toBe(false)

      // Check recommendation
      expect(result.recommendation).toEqual({
        option_id: 'opt-1',
        confidence: 'high',
        recommendation_status: 'clear',
      })

      // Check sensitivity
      expect(result.sensitivity).toHaveLength(1)
      expect(result.sensitivity[0].node_id).toBe('node-1')
      expect(result.sensitivity[0].sensitivity).toBe(0.8)

      // Check robustness label
      expect(result.robustness_label).toBe('robust')

      // Check VoI
      expect(result.value_of_information).toHaveLength(1)
      expect(result.value_of_information[0].evpi).toBe(0.12)
      expect(result.value_of_information[0].worth_investigating).toBe(true)

      // Check narrative
      expect(result.narrative).toBe('The recommendation is robust to parameter variations.')

      // Check Pareto
      expect(result.pareto).toBeDefined()
      expect(result.pareto?.frontier).toEqual(['opt-1', 'opt-3'])
      expect(result.pareto?.criteria).toEqual(['profit', 'risk'])
    })

    it('handles alternative field names from ISL', () => {
      const rawResponse: ISLRobustnessResponse = {
        rankings: [{ option_id: 'opt-1', rank: 1 }], // Alternative to option_rankings
        sensitive_parameters: [{ parameter_id: 'p-1', name: 'Param', magnitude: 0.5 }], // Alternatives
        robustness: 'moderate', // Alternative to robustness_label
        bounds: [{ label: 'Scenario 1', lower_bound: 0.3, upper_bound: 0.7, parameters: ['p-1'] }], // Alternatives
        voi: [{ parameter_id: 'p-2', name: 'Param2', expected_value: 0.08 }], // Alternatives
        summary: 'Summary text', // Alternative to narrative
        pareto_analysis: { frontier_options: ['opt-1'], dominated_options: [], objectives: ['obj-1'] }, // Alternatives
      }

      const result = adaptISLRobustnessResponse(rawResponse)

      expect(result.option_rankings).toHaveLength(1)
      expect(result.sensitivity[0].node_id).toBe('p-1')
      expect(result.sensitivity[0].label).toBe('Param')
      expect(result.sensitivity[0].sensitivity).toBe(0.5)
      expect(result.robustness_label).toBe('moderate')
      expect(result.robustness_bounds[0].scenario).toBe('Scenario 1')
      expect(result.robustness_bounds[0].lower).toBe(0.3)
      expect(result.value_of_information[0].evpi).toBe(0.08)
      expect(result.narrative).toBe('Summary text')
      expect(result.pareto?.frontier).toEqual(['opt-1'])
      expect(result.pareto?.criteria).toEqual(['obj-1'])
    })

    it('provides defaults for missing fields', () => {
      const rawResponse: ISLRobustnessResponse = {}

      const result = adaptISLRobustnessResponse(rawResponse)

      expect(result.option_rankings).toEqual([])
      expect(result.sensitivity).toEqual([])
      expect(result.robustness_bounds).toEqual([])
      expect(result.value_of_information).toEqual([])
      expect(result.narrative).toBe('')
      expect(result.recommendation.option_id).toBe('')
      expect(result.recommendation.confidence).toBe('medium')
      expect(result.recommendation.recommendation_status).toBe('uncertain')
      expect(result.pareto).toBeUndefined()
    })

    it('infers robustness label from sensitivity when not provided', () => {
      const rawResponse: ISLRobustnessResponse = {
        sensitivity: [
          { node_id: 'n1', label: 'P1', current_value: 0.45, flip_threshold: 0.5, sensitivity: 0.9 },
        ],
      }

      const result = adaptISLRobustnessResponse(rawResponse)

      // High sensitivity near flip threshold → fragile
      expect(result.robustness_label).toBe('fragile')
    })
  })

  describe('generateFallbackRobustness', () => {
    it('returns valid fallback structure', () => {
      const fallback = generateFallbackRobustness()

      expect(fallback.option_rankings).toEqual([])
      expect(fallback.recommendation.option_id).toBe('')
      expect(fallback.recommendation.confidence).toBe('medium')
      expect(fallback.recommendation.recommendation_status).toBe('uncertain')
      expect(fallback.sensitivity).toEqual([])
      expect(fallback.robustness_label).toBe('moderate')
      expect(fallback.robustness_bounds).toEqual([])
      expect(fallback.value_of_information).toEqual([])
      expect(fallback.narrative).toContain('default assumptions')
    })
  })

  describe('deriveConfidenceFromSpread', () => {
    it('returns high confidence for narrow spread', () => {
      // spread = 15, normalizedSpread = 15/100 = 0.15 < 0.2 → high
      expect(deriveConfidenceFromSpread(92.5, 100, 107.5)).toBe('high')
    })

    it('returns medium confidence for moderate spread', () => {
      // spread = 30, normalizedSpread = 30/100 = 0.3 → 0.2 <= 0.3 < 0.5 → medium
      expect(deriveConfidenceFromSpread(85, 100, 115)).toBe('medium')
    })

    it('returns low confidence for wide spread', () => {
      // spread = 120, normalizedSpread = 120/100 = 1.2 > 0.5 → low
      expect(deriveConfidenceFromSpread(40, 100, 160)).toBe('low')
    })

    it('returns medium when values are missing', () => {
      expect(deriveConfidenceFromSpread(undefined, 100, 110)).toBe('medium')
      expect(deriveConfidenceFromSpread(90, undefined, 110)).toBe('medium')
      expect(deriveConfidenceFromSpread(90, 100, undefined)).toBe('medium')
    })
  })

  describe('inferRobustnessLabel', () => {
    it('returns robust for low sensitivity parameters', () => {
      const sensitivity = [
        { node_id: 'n1', label: 'P1', current_value: 0.5, flip_threshold: 0.9, direction: 'increase' as const, sensitivity: 0.2 },
      ]
      expect(inferRobustnessLabel(sensitivity)).toBe('robust')
    })

    it('returns moderate for medium sensitivity parameters', () => {
      const sensitivity = [
        { node_id: 'n1', label: 'P1', current_value: 0.5, flip_threshold: 0.8, direction: 'increase' as const, sensitivity: 0.5 },
      ]
      expect(inferRobustnessLabel(sensitivity)).toBe('moderate')
    })

    it('returns fragile when near flip threshold with high sensitivity', () => {
      const sensitivity = [
        { node_id: 'n1', label: 'P1', current_value: 0.45, flip_threshold: 0.5, direction: 'increase' as const, sensitivity: 0.7 },
      ]
      expect(inferRobustnessLabel(sensitivity)).toBe('fragile')
    })

    it('returns fragile for very high sensitivity', () => {
      const sensitivity = [
        { node_id: 'n1', label: 'P1', current_value: 0.3, flip_threshold: 0.9, direction: 'increase' as const, sensitivity: 0.85 },
      ]
      expect(inferRobustnessLabel(sensitivity)).toBe('fragile')
    })

    it('returns moderate for empty sensitivity array', () => {
      expect(inferRobustnessLabel([])).toBe('moderate')
    })
  })
})
