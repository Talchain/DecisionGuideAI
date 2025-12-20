/**
 * Tests for Next Steps Computation Module
 *
 * Phase 1 P0: Compute actionable next steps after analysis
 */

import { describe, it, expect } from 'vitest'
import {
  computeNextSteps,
  getTopNextStep,
  hasActionableSteps,
  getActionableSteps,
  type NextStepsInput,
} from '../nextSteps'
import type { ModelAction } from '../../types/primitives'
import type { NormalizedDriver } from '../../adapters/driversAdapter'

describe('computeNextSteps', () => {
  describe('CEE suggestions', () => {
    it('uses CEE suggested actions when available', () => {
      const suggestedActions: ModelAction[] = [
        {
          action_id: 'act_1',
          op: 'add_node',
          payload: { type: 'factor', label: 'Market Growth' },
          label: 'Add market growth factor',
        },
      ]

      const result = computeNextSteps({
        suggestedActions,
        analysisComplete: true,
      })

      expect(result).toHaveLength(3) // CEE + generic fallbacks
      expect(result[0].type).toBe('cee_suggestion')
      expect(result[0].action).toBeDefined()
    })

    it('prioritizes CEE suggestions over others', () => {
      const suggestedActions: ModelAction[] = [
        { action_id: 'act_1', op: 'add_node', payload: {}, label: 'CEE Suggestion' },
      ]

      const drivers: NormalizedDriver[] = [
        { id: 'node_1', kind: 'node', label: 'Driver 1', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 },
      ]

      const result = computeNextSteps({
        suggestedActions,
        drivers,
        analysisComplete: true,
      })

      expect(result[0].type).toBe('cee_suggestion')
    })
  })

  describe('driver-based suggestions', () => {
    it('generates suggestions from drivers', () => {
      const drivers: NormalizedDriver[] = [
        { id: 'node_1', kind: 'node', label: 'Market Size', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 },
        { id: 'node_2', kind: 'node', label: 'Competition', impact: 60, impactDirection: 'negative', rawImpact: 0.6, rank: 2 },
      ]

      const result = computeNextSteps({
        drivers,
        analysisComplete: true,
      })

      expect(result.some(s => s.type === 'driver_based')).toBe(true)
      expect(result.some(s => s.label.includes('Market Size'))).toBe(true)
    })

    it('includes highlight IDs for drivers', () => {
      const drivers: NormalizedDriver[] = [
        { id: 'node_1', kind: 'node', label: 'Factor A', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 },
      ]

      const result = computeNextSteps({
        drivers,
        analysisComplete: true,
      })

      const driverStep = result.find(s => s.type === 'driver_based')
      expect(driverStep?.highlightIds).toContain('node_1')
    })
  })

  describe('readiness suggestions', () => {
    it('includes readiness suggestions', () => {
      const result = computeNextSteps({
        readinessSuggestions: ['Add an outcome node'],
        analysisComplete: false,
      })

      expect(result.some(s => s.type === 'readiness')).toBe(true)
    })
  })

  describe('generic fallback', () => {
    it('falls back to generic suggestions when nothing else available', () => {
      const result = computeNextSteps({
        analysisComplete: true,
      })

      expect(result.length).toBeGreaterThan(0)
      expect(result.some(s => s.type === 'generic')).toBe(true)
    })

    it('can disable generic fallback', () => {
      const result = computeNextSteps(
        { analysisComplete: true },
        { includeGenericFallback: false, maxSteps: 3 }
      )

      expect(result.every(s => s.type !== 'generic')).toBe(true)
    })
  })

  describe('configuration', () => {
    it('respects maxSteps limit', () => {
      const suggestedActions: ModelAction[] = [
        { action_id: 'act_1', op: 'add_node', payload: {}, label: 'Step 1' },
        { action_id: 'act_2', op: 'add_node', payload: {}, label: 'Step 2' },
        { action_id: 'act_3', op: 'add_node', payload: {}, label: 'Step 3' },
        { action_id: 'act_4', op: 'add_node', payload: {}, label: 'Step 4' },
      ]

      const result = computeNextSteps(
        { suggestedActions, analysisComplete: true },
        { maxSteps: 2 }
      )

      expect(result).toHaveLength(2)
    })

    it('can deprioritize CEE suggestions', () => {
      const suggestedActions: ModelAction[] = [
        { action_id: 'act_1', op: 'add_node', payload: {}, label: 'CEE' },
      ]
      const drivers: NormalizedDriver[] = [
        { id: 'node_1', kind: 'node', label: 'Driver', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 },
      ]

      const result = computeNextSteps(
        { suggestedActions, drivers, analysisComplete: true },
        { preferCEESuggestions: false }
      )

      // When CEE not preferred, drivers come first
      expect(result[0].type).toBe('driver_based')
    })
  })

  describe('priority assignment', () => {
    it('assigns high priority to CEE suggestions', () => {
      const suggestedActions: ModelAction[] = [
        { action_id: 'act_1', op: 'add_node', payload: {}, label: 'Test' },
      ]

      const result = computeNextSteps({
        suggestedActions,
        analysisComplete: true,
      })

      expect(result[0].priority).toBe('high')
    })

    it('assigns priority based on driver rank', () => {
      const drivers: NormalizedDriver[] = [
        { id: 'node_1', kind: 'node', label: 'Top', impact: 90, impactDirection: 'positive', rawImpact: 0.9, rank: 1 },
        { id: 'node_2', kind: 'node', label: 'Second', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 2 },
        { id: 'node_3', kind: 'node', label: 'Third', impact: 70, impactDirection: 'positive', rawImpact: 0.7, rank: 3 },
      ]

      const result = computeNextSteps({
        drivers,
        analysisComplete: true,
      }, { includeGenericFallback: false })

      expect(result[0].priority).toBe('high')
      expect(result[1].priority).toBe('high')
      expect(result[2].priority).toBe('medium')
    })
  })
})

describe('getTopNextStep', () => {
  it('returns the first step', () => {
    const suggestedActions: ModelAction[] = [
      { action_id: 'act_1', op: 'add_node', payload: {}, label: 'First' },
      { action_id: 'act_2', op: 'add_node', payload: {}, label: 'Second' },
    ]

    const result = getTopNextStep({
      suggestedActions,
      analysisComplete: true,
    })

    expect(result?.label).toBe('First')
  })

  it('returns null when no actionable steps', () => {
    const result = getTopNextStep({
      analysisComplete: true,
    })

    // Generic fallbacks are excluded from getTopNextStep
    expect(result).toBeNull()
  })
})

describe('hasActionableSteps', () => {
  it('returns true when CEE suggestions exist', () => {
    expect(hasActionableSteps({
      suggestedActions: [{ action_id: 'act_1', op: 'add_node', payload: {}, label: 'Test' }],
      analysisComplete: true,
    })).toBe(true)
  })

  it('returns true when drivers exist', () => {
    expect(hasActionableSteps({
      drivers: [{ id: 'node_1', kind: 'node', label: 'A', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 }],
      analysisComplete: true,
    })).toBe(true)
  })

  it('returns false when only generic fallbacks', () => {
    expect(hasActionableSteps({
      analysisComplete: true,
    })).toBe(false)
  })
})

describe('getActionableSteps', () => {
  it('returns only steps with actions', () => {
    const suggestedActions: ModelAction[] = [
      { action_id: 'act_1', op: 'add_node', payload: {}, label: 'With Action' },
    ]

    const drivers: NormalizedDriver[] = [
      { id: 'node_1', kind: 'node', label: 'Without Action', impact: 80, impactDirection: 'positive', rawImpact: 0.8, rank: 1 },
    ]

    const result = getActionableSteps({
      suggestedActions,
      drivers,
      analysisComplete: true,
    })

    expect(result.every(s => s.action !== undefined)).toBe(true)
    expect(result).toHaveLength(1) // Only CEE suggestion has action
  })
})
