import { describe, it, expect } from 'vitest'
import {
  getDiscriminationSignal,
  isLowDiscrimination,
  getDiscriminationMessage,
  getDiscriminationSeverity,
  formatDiscriminationValue,
  getSuggestedActionsForLowDiscrimination,
  hasEngineSignal,
  toReadinessReason,
  DISCRIMINATION_THRESHOLD,
  ENGINE_METRIC,
  FALLBACK_METRIC,
  type DiscriminationPayload,
} from '../discrimination'

describe('discrimination', () => {
  describe('getDiscriminationSignal', () => {
    it('prefers engine signal when available', () => {
      const report = {
        discrimination: {
          status: 'ok' as const,
          metric: 'quantile_spread',
          value: 0.1,
          threshold: 0.05,
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.source).toBe('engine')
      expect(result.status).toBe('ok')
      expect(result.metric).toBe('quantile_spread')
      expect(result.value).toBe(0.1)
      expect(result.threshold).toBe(0.05)
    })

    it('includes affected_option_ids from engine', () => {
      const report = {
        discrimination: {
          status: 'low_discrimination' as const,
          metric: 'quantile_spread',
          value: 0.02,
          threshold: 0.05,
          affected_option_ids: ['opt_1', 'opt_2'],
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.affectedOptionIds).toEqual(['opt_1', 'opt_2'])
    })

    it('includes remediation_actions from engine', () => {
      const report = {
        discrimination: {
          status: 'low_discrimination' as const,
          metric: 'quantile_spread',
          value: 0.02,
          threshold: 0.05,
          remediation_actions: [
            { code: 'add_factor', label: 'Add distinguishing factor', target_ids: ['n1'] },
          ],
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.remediationActions).toHaveLength(1)
      expect(result.remediationActions![0].code).toBe('add_factor')
      expect(result.remediationActions![0].targetIds).toEqual(['n1'])
    })

    it('falls back to client-side calculation when engine signal missing', () => {
      const report = {
        result: {
          summary: { p10: 40, p50: 50, p90: 60 },
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.source).toBe('fallback')
      expect(result.metric).toBe(FALLBACK_METRIC)
      expect(result.threshold).toBe(DISCRIMINATION_THRESHOLD)
    })

    it('fallback computes normalized spread correctly', () => {
      // Spread = |60 - 40| = 20, Baseline = 50, Normalized = 20/50 = 0.4
      const report = {
        result: {
          summary: { p10: 40, p50: 50, p90: 60 },
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.value).toBeCloseTo(0.4, 2)
      expect(result.status).toBe('ok') // 0.4 > 0.05
    })

    it('fallback detects low discrimination', () => {
      // Spread = |51 - 49| = 2, Baseline = 50, Normalized = 2/50 = 0.04
      const report = {
        result: {
          summary: { p10: 49, p50: 50, p90: 51 },
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.value).toBeCloseTo(0.04, 2)
      expect(result.status).toBe('low_discrimination') // 0.04 < 0.05
    })

    it('fallback handles missing summary', () => {
      const result = getDiscriminationSignal({})

      expect(result.source).toBe('fallback')
      expect(result.status).toBe('low_discrimination')
      expect(result.value).toBe(0)
    })

    it('fallback avoids division by zero', () => {
      const report = {
        result: {
          summary: { p10: 0, p50: 0, p90: 0 },
        },
      }

      const result = getDiscriminationSignal(report)

      expect(result.value).toBe(0)
      expect(result.status).toBe('low_discrimination')
    })
  })

  describe('isLowDiscrimination', () => {
    it('returns true for low_discrimination status', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.02,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(isLowDiscrimination(state)).toBe(true)
    })

    it('returns false for ok status', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(isLowDiscrimination(state)).toBe(false)
    })
  })

  describe('getDiscriminationMessage', () => {
    it('returns positive message for ok status', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      const message = getDiscriminationMessage(state)
      expect(message).toContain('clearly distinguishes')
    })

    it('returns warning message with spread % for low discrimination', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.03,
        threshold: 0.05,
        source: 'engine' as const,
      }

      const message = getDiscriminationMessage(state)
      expect(message).toContain('3%')
      expect(message).toContain('5%')
      expect(message).toContain('close')
    })
  })

  describe('getDiscriminationSeverity', () => {
    it('returns none for ok status', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(getDiscriminationSeverity(state)).toBe('none')
    })

    it('returns warning for low discrimination above half threshold', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.03, // > 0.05/2 = 0.025
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(getDiscriminationSeverity(state)).toBe('warning')
    })

    it('returns error for very low discrimination', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.01, // < 0.05/2 = 0.025
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(getDiscriminationSeverity(state)).toBe('error')
    })
  })

  describe('formatDiscriminationValue', () => {
    it('formats value as percentage', () => {
      expect(formatDiscriminationValue(0.1)).toBe('10%')
      expect(formatDiscriminationValue(0.05)).toBe('5%')
      expect(formatDiscriminationValue(0.033)).toBe('3%')
    })
  })

  describe('getSuggestedActionsForLowDiscrimination', () => {
    it('returns empty array for ok status', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(getSuggestedActionsForLowDiscrimination(state)).toHaveLength(0)
    })

    it('uses remediation actions from engine when available', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.02,
        threshold: 0.05,
        source: 'engine' as const,
        remediationActions: [
          { code: 'action1', label: 'Do this' },
          { code: 'action2', label: 'Do that' },
        ],
      }

      const actions = getSuggestedActionsForLowDiscrimination(state)

      expect(actions).toContain('Do this')
      expect(actions).toContain('Do that')
    })

    it('returns default suggestions when no remediation actions', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.02,
        threshold: 0.05,
        source: 'fallback' as const,
      }

      const actions = getSuggestedActionsForLowDiscrimination(state)

      expect(actions.length).toBeGreaterThan(0)
      expect(actions.some(a => a.includes('factor'))).toBe(true)
    })
  })

  describe('hasEngineSignal', () => {
    it('returns true for engine source', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(hasEngineSignal(state)).toBe(true)
    })

    it('returns false for fallback source', () => {
      const state = {
        status: 'ok' as const,
        metric: FALLBACK_METRIC,
        value: 0.1,
        threshold: 0.05,
        source: 'fallback' as const,
      }

      expect(hasEngineSignal(state)).toBe(false)
    })
  })

  describe('toReadinessReason', () => {
    it('returns null for ok status', () => {
      const state = {
        status: 'ok' as const,
        metric: 'quantile_spread',
        value: 0.1,
        threshold: 0.05,
        source: 'engine' as const,
      }

      expect(toReadinessReason(state)).toBeNull()
    })

    it('returns readiness reason for low discrimination', () => {
      const state = {
        status: 'low_discrimination' as const,
        metric: 'quantile_spread',
        value: 0.02,
        threshold: 0.05,
        source: 'engine' as const,
      }

      const reason = toReadinessReason(state)

      expect(reason).not.toBeNull()
      expect(reason!.code).toBe('low_discrimination')
      expect(reason!.severity).toBe('warning')
      expect(reason!.source).toBe('engine')
    })
  })

  describe('constants', () => {
    it('has correct threshold per PLoT contract', () => {
      expect(DISCRIMINATION_THRESHOLD).toBe(0.05)
    })

    it('has correct metric names', () => {
      expect(ENGINE_METRIC).toBe('quantile_spread')
      expect(FALLBACK_METRIC).toBe('quantile_spread_fallback')
    })
  })
})
