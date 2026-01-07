/**
 * graphPayload Utility Tests
 *
 * P0 Fix: Tests for intervention extraction from various data shapes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getRecommendedOptionInterventions } from '../graphPayload'

describe('getRecommendedOptionInterventions', () => {
  beforeEach(() => {
    // Silence console logs in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('data shape handling', () => {
    it('handles interventions as flat numbers', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_a: 1,
              factor_b: 0.5,
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_a: 1,
        factor_b: 0.5,
      })
    })

    it('handles interventions as nested { value } objects', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_a: { value: 1 },
              factor_b: { value: 0.75 },
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_a: 1,
        factor_b: 0.75,
      })
    })

    it('handles interventions as booleans (coerced to 1/0)', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_hired: true,
              factor_fired: false,
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_hired: 1,
        factor_fired: 0,
      })
    })

    it('handles nested { value: boolean } (coerced to 1/0)', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_enabled: { value: true },
              factor_disabled: { value: false },
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_enabled: 1,
        factor_disabled: 0,
      })
    })

    it('handles option.data.interventions shape', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            data: {
              interventions: {
                factor_a: 1,
                factor_b: 0,
              },
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_a: 1,
        factor_b: 0,
      })
    })

    it('prioritizes option.data.interventions over option.interventions', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            data: {
              interventions: {
                factor_data: 1,
              },
            },
            interventions: {
              factor_flat: 0,
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      // data.interventions takes priority
      expect(result).toEqual({
        factor_data: 1,
      })
    })
  })

  describe('winner option detection', () => {
    const options = [
      {
        id: 'opt_a',
        label: 'Option A',
        interventions: { factor_a: 1 },
      },
      {
        id: 'opt_b',
        label: 'Option B',
        interventions: { factor_b: 1 },
      },
    ]

    it('uses ranking.winner to find option by label', () => {
      const report = {
        ranking: { winner: 'Option B' },
      }

      const result = getRecommendedOptionInterventions({ options }, report)

      expect(result).toEqual({ factor_b: 1 })
    })

    it('uses highest win_probability when ranking.winner not found', () => {
      const report = {
        option_probabilities: {
          opt_a: { win_probability: 0.3 },
          opt_b: { win_probability: 0.7 },
        },
      }

      const result = getRecommendedOptionInterventions({ options }, report)

      expect(result).toEqual({ factor_b: 1 })
    })

    it('falls back to first option when no winner info', () => {
      const result = getRecommendedOptionInterventions({ options }, null)

      expect(result).toEqual({ factor_a: 1 })
    })
  })

  describe('guardrails', () => {
    it('returns null when options array is empty', () => {
      const result = getRecommendedOptionInterventions({ options: [] }, null)
      expect(result).toBeNull()
    })

    it('returns null when ceeAnalysisReady is null', () => {
      const result = getRecommendedOptionInterventions(null, null)
      expect(result).toBeNull()
    })

    it('returns null when interventions are empty (skips conformal)', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {},
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)
      expect(result).toBeNull()
    })

    it('drops invalid intervention values and returns null if all invalid', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_invalid: 'not_a_number' as unknown,
              factor_null: null as unknown,
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)
      expect(result).toBeNull()
    })

    it('skips invalid values but keeps valid ones', () => {
      const ceeAnalysisReady = {
        options: [
          {
            id: 'opt_1',
            label: 'Option A',
            interventions: {
              factor_valid: 1,
              factor_invalid: 'bad' as unknown,
              factor_also_valid: 0.5,
            },
          },
        ],
      }

      const result = getRecommendedOptionInterventions(ceeAnalysisReady, null)

      expect(result).toEqual({
        factor_valid: 1,
        factor_also_valid: 0.5,
      })
    })
  })
})
