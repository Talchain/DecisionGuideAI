/**
 * getFactorDirection Tests (P0 Fix)
 *
 * Tests for direction priority: API factor_sensitivity.direction takes precedence
 * over canvas edge direction.
 */

import { describe, it, expect } from 'vitest'
import { getFactorDirection, normaliseDirection } from '../useResultsSectionData'
import type { EdgeForDirection } from '../types'

// ============================================================================
// normaliseDirection Tests
// ============================================================================

describe('normaliseDirection', () => {
  it('normalises positive variants', () => {
    expect(normaliseDirection('positive')).toBe('positive')
    expect(normaliseDirection('increases')).toBe('positive')
    expect(normaliseDirection('+')).toBe('positive')
    expect(normaliseDirection('increase')).toBe('positive')
    expect(normaliseDirection('up')).toBe('positive')
    expect(normaliseDirection('POSITIVE')).toBe('positive') // Case insensitive
  })

  it('normalises negative variants', () => {
    expect(normaliseDirection('negative')).toBe('negative')
    expect(normaliseDirection('decreases')).toBe('negative')
    expect(normaliseDirection('-')).toBe('negative')
    expect(normaliseDirection('decrease')).toBe('negative')
    expect(normaliseDirection('down')).toBe('negative')
    expect(normaliseDirection('NEGATIVE')).toBe('negative') // Case insensitive
  })

  it('returns undefined for unrecognised values', () => {
    expect(normaliseDirection(undefined)).toBeUndefined()
    expect(normaliseDirection('unknown')).toBeUndefined()
    expect(normaliseDirection('')).toBeUndefined()
  })
})

// ============================================================================
// getFactorDirection Tests - P0 Fix: API direction takes precedence
// ============================================================================

describe('getFactorDirection (P0 Fix)', () => {
  const mockEdges: EdgeForDirection[] = [
    {
      source: 'fac_pro_price',
      target: 'goal_revenue',
      effect_direction: 'positive', // Canvas edge says positive
      direction: 'positive',
    },
    {
      source: 'fac_market_size',
      target: 'outcome_sales',
      effect_direction: 'negative',
      direction: 'negative',
    },
  ]

  const goalNodeId = 'goal_revenue'
  const outcomeNodeIds = ['outcome_sales', 'outcome_profit']

  it('prioritises API factorDirection over canvas edge direction', () => {
    // P0 Fix: API says negative, canvas edge says positive
    // The API direction should win
    const result = getFactorDirection(
      'fac_pro_price',
      mockEdges,
      goalNodeId,
      outcomeNodeIds,
      'negative' // API factor_sensitivity.direction
    )

    expect(result).toBe('negative') // API wins, not canvas edge
  })

  it('uses canvas edge to goal as fallback when API direction is undefined', () => {
    const result = getFactorDirection(
      'fac_pro_price',
      mockEdges,
      goalNodeId,
      outcomeNodeIds,
      undefined // No API direction
    )

    expect(result).toBe('positive') // Falls back to canvas edge
  })

  it('uses canvas edge to outcome as second fallback', () => {
    const result = getFactorDirection(
      'fac_market_size', // Has edge to outcome, not to goal
      mockEdges,
      goalNodeId,
      outcomeNodeIds,
      undefined // No API direction
    )

    expect(result).toBe('negative') // Falls back to outcome edge
  })

  it('returns undefined when no direction source available', () => {
    const result = getFactorDirection(
      'fac_unknown', // No edges, no API direction
      mockEdges,
      goalNodeId,
      outcomeNodeIds,
      undefined
    )

    expect(result).toBeUndefined()
  })

  it('API direction beats both goal and outcome edges', () => {
    // Factor has edges to both goal and outcome, but API overrides
    const edgesWithBoth: EdgeForDirection[] = [
      { source: 'fac_test', target: 'goal_revenue', effect_direction: 'positive' },
      { source: 'fac_test', target: 'outcome_sales', effect_direction: 'positive' },
    ]

    const result = getFactorDirection(
      'fac_test',
      edgesWithBoth,
      goalNodeId,
      outcomeNodeIds,
      'negative' // API says negative
    )

    expect(result).toBe('negative') // API wins
  })

  it('handles empty edges array with API direction', () => {
    const result = getFactorDirection(
      'fac_test',
      [], // No edges
      goalNodeId,
      outcomeNodeIds,
      'positive' // API direction only
    )

    expect(result).toBe('positive')
  })

  it('handles empty edges array without API direction', () => {
    const result = getFactorDirection(
      'fac_test',
      [], // No edges
      goalNodeId,
      outcomeNodeIds,
      undefined // No API direction either
    )

    expect(result).toBeUndefined()
  })
})
