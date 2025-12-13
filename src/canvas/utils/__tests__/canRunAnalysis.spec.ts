/**
 * canRunAnalysis Utility Tests
 */

import { describe, it, expect } from 'vitest'
import {
  canRunAnalysis,
  getRunButtonTooltip,
  getRunButtonAriaLabel,
  type CanRunAnalysisParams,
} from '../canRunAnalysis'

describe('canRunAnalysis', () => {
  const defaultParams: CanRunAnalysisParams = {
    graphHealth: null,
    readiness: null,
    hasBlockers: false,
    nodeCount: 3,
    isRunning: false,
  }

  describe('when analysis can run', () => {
    it('returns allowed=true with valid graph', () => {
      const result = canRunAnalysis(defaultParams)

      expect(result.allowed).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('returns allowed=true with readiness can_run_analysis=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 70,
          readiness_level: 'strong',
          can_run_analysis: true,
          confidence_explanation: 'Model looks good',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(true)
    })

    it('includes warning for fair readiness level', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 50,
          readiness_level: 'fair',
          can_run_analysis: true,
          confidence_explanation: 'Analysis available',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('consider improvements')
    })

    it('includes warning for validation warnings', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'warning', code: 'MISSING_LABEL', message: 'Node missing label' },
          ],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('1 optional improvement')
    })

    it('includes plural warning for multiple validation warnings', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'warning', code: 'WARN1', message: 'Warning 1' },
            { severity: 'warning', code: 'WARN2', message: 'Warning 2' },
          ],
        },
      })

      expect(result.allowed).toBe(true)
      expect(result.warning).toContain('2 optional improvements')
    })
  })

  describe('when analysis is blocked', () => {
    it('blocks when isRunning=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        isRunning: true,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Analysis is currently running')
    })

    it('blocks when nodeCount=0', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        nodeCount: 0,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Add some nodes to get started')
    })

    it('blocks when graphHealth has error issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ORPHAN_NODE', message: 'Disconnected node found' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Disconnected node found')
      expect(result.blockingReasons).toContain('Disconnected node found')
    })

    it('blocks when graphHealth has blocker issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'blocker', code: 'CYCLE_DETECTED', message: 'Circular dependency' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Circular dependency')
    })

    it('blocks when hasBlockers=true', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        hasBlockers: true,
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Critical issues')
    })

    it('blocks when readiness can_run_analysis=false', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        readiness: {
          readiness_score: 20,
          readiness_level: 'needs_work',
          can_run_analysis: false,
          confidence_explanation: 'Graph needs more structure',
          improvements: [],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.blockingReasons).toContain('Graph needs more structure')
    })

    it('combines multiple blocking reasons', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ERROR1', message: 'Error 1' },
            { severity: 'error', code: 'ERROR2', message: 'Error 2' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('+1 more issue')
      expect(result.blockingReasons).toHaveLength(2)
    })

    it('handles multiple blocking reasons with plural', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ERROR1', message: 'Error 1' },
            { severity: 'error', code: 'ERROR2', message: 'Error 2' },
            { severity: 'error', code: 'ERROR3', message: 'Error 3' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('+2 more issues')
    })
  })

  describe('edge cases', () => {
    it('handles null graphHealth', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: null,
      })

      expect(result.allowed).toBe(true)
    })

    it('handles graphHealth with empty issues', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: { issues: [] },
      })

      expect(result.allowed).toBe(true)
    })

    it('handles issue without message', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', code: 'ORPHAN_NODE' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('ORPHAN_NODE')
    })

    it('handles issue with only type', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error', type: 'VALIDATION_ERROR' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('VALIDATION_ERROR')
    })

    it('handles issue without code, type, or message', () => {
      const result = canRunAnalysis({
        ...defaultParams,
        graphHealth: {
          issues: [
            { severity: 'error' },
          ],
        },
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Validation error')
    })
  })
})

describe('getRunButtonTooltip', () => {
  it('returns reason when not allowed', () => {
    const tooltip = getRunButtonTooltip({
      allowed: false,
      reason: 'Fix validation errors',
    })

    expect(tooltip).toBe('Fix validation errors')
  })

  it('returns warning when allowed with warning', () => {
    const tooltip = getRunButtonTooltip({
      allowed: true,
      warning: '2 optional improvements available',
    })

    expect(tooltip).toBe('2 optional improvements available')
  })

  it('returns undefined when allowed without warning', () => {
    const tooltip = getRunButtonTooltip({
      allowed: true,
    })

    expect(tooltip).toBeUndefined()
  })
})

describe('getRunButtonAriaLabel', () => {
  it('returns running message when isRunning', () => {
    const label = getRunButtonAriaLabel({ allowed: true }, true)

    expect(label).toBe('Analysis running...')
  })

  it('returns blocked message with reason when not allowed', () => {
    const label = getRunButtonAriaLabel({
      allowed: false,
      reason: 'Disconnected node found',
    }, false)

    expect(label).toContain('blocked')
    expect(label).toContain('Disconnected node found')
  })

  it('returns default blocked message when no reason', () => {
    const label = getRunButtonAriaLabel({
      allowed: false,
    }, false)

    expect(label).toContain('blocked')
    expect(label).toContain('issues need to be resolved')
  })

  it('returns standard label when allowed', () => {
    const label = getRunButtonAriaLabel({ allowed: true }, false)

    expect(label).toBe('Run Analysis')
  })
})
