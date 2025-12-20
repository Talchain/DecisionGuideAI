/**
 * Tests for CTA State Machine
 *
 * Phase 1 P0: State machine for primary analysis button
 */

import { describe, it, expect } from 'vitest'
import {
  computeCTA,
  canTriggerAnalysis,
  getCTAButtonText,
  type CTAInput,
} from '../ctaStateMachine'

describe('computeCTA', () => {
  describe('idle state', () => {
    it('shows Analyse text when graph is valid', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: true,
        readinessLevel: 'ready',
      })
      expect(result.state).toBe('idle')
      expect(result.text).toBe('Analyse')
      expect(result.enabled).toBe(true)
      expect(result.variant).toBe('primary')
    })

    it('shows disabled state for empty graph', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: false,
        readinessLevel: 'not_ready',
      })
      expect(result.enabled).toBe(false)
      expect(result.variant).toBe('disabled')
    })

    it('disables when not_ready', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: true,
        readinessLevel: 'not_ready',
      })
      expect(result.enabled).toBe(false)
    })

    it('enables with needs_review readiness', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: true,
        readinessLevel: 'needs_review',
      })
      expect(result.enabled).toBe(true)
    })
  })

  describe('running state', () => {
    const runningStatuses: Array<'preparing' | 'connecting' | 'streaming'> = [
      'preparing',
      'connecting',
      'streaming',
    ]

    runningStatuses.forEach((status) => {
      it(`shows running state for ${status}`, () => {
        const result = computeCTA({
          resultsStatus: status,
          hasGraph: true,
          readinessLevel: 'ready',
        })
        expect(result.state).toBe('running')
        expect(result.text).toBe('Running…')
        expect(result.enabled).toBe(false)
        expect(result.icon).toBe('loader')
      })
    })
  })

  describe('done state', () => {
    it('shows Analyse again after completion', () => {
      const result = computeCTA({
        resultsStatus: 'complete',
        hasGraph: true,
        readinessLevel: 'ready',
      })
      expect(result.state).toBe('done')
      expect(result.text).toBe('Analyse again')
      expect(result.enabled).toBe(true)
      expect(result.icon).toBe('refresh')
    })

    it('shows degraded state when isDegraded', () => {
      const result = computeCTA({
        resultsStatus: 'complete',
        hasGraph: true,
        readinessLevel: 'ready',
        isDegraded: true,
      })
      expect(result.state).toBe('degraded')
      expect(result.text).toBe('Retry')
      expect(result.variant).toBe('warning')
    })
  })

  describe('error state', () => {
    it('shows Retry for error status', () => {
      const result = computeCTA({
        resultsStatus: 'error',
        hasGraph: true,
        readinessLevel: 'ready',
        errorMessage: 'Connection failed',
      })
      expect(result.state).toBe('error')
      expect(result.text).toBe('Retry')
      expect(result.enabled).toBe(true)
      expect(result.variant).toBe('warning')
      expect(result.tooltip).toBe('Connection failed')
    })
  })

  describe('cancelled state', () => {
    it('returns to idle after cancellation', () => {
      const result = computeCTA({
        resultsStatus: 'cancelled',
        hasGraph: true,
        readinessLevel: 'ready',
      })
      expect(result.state).toBe('idle')
      expect(result.text).toBe('Analyse')
    })
  })

  describe('tooltip generation', () => {
    it('shows tooltip for empty graph', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: false,
        readinessLevel: 'not_ready',
      })
      expect(result.tooltip).toContain('Add nodes')
    })

    it('shows tooltip for not_ready state', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: true,
        readinessLevel: 'not_ready',
      })
      expect(result.tooltip).toContain('issues')
    })

    it('no tooltip when ready', () => {
      const result = computeCTA({
        resultsStatus: 'idle',
        hasGraph: true,
        readinessLevel: 'ready',
      })
      expect(result.tooltip).toBeUndefined()
    })
  })
})

describe('canTriggerAnalysis', () => {
  it('returns true when enabled', () => {
    expect(canTriggerAnalysis({
      resultsStatus: 'idle',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe(true)
  })

  it('returns false when running', () => {
    expect(canTriggerAnalysis({
      resultsStatus: 'streaming',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe(false)
  })

  it('returns false for empty graph', () => {
    expect(canTriggerAnalysis({
      resultsStatus: 'idle',
      hasGraph: false,
      readinessLevel: 'not_ready',
    })).toBe(false)
  })
})

describe('getCTAButtonText', () => {
  it('returns correct text for each state', () => {
    expect(getCTAButtonText({
      resultsStatus: 'idle',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe('Analyse')

    expect(getCTAButtonText({
      resultsStatus: 'streaming',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe('Running…')

    expect(getCTAButtonText({
      resultsStatus: 'complete',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe('Analyse again')

    expect(getCTAButtonText({
      resultsStatus: 'error',
      hasGraph: true,
      readinessLevel: 'ready',
    })).toBe('Retry')
  })
})
