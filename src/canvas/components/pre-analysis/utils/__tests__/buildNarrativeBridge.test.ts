/**
 * Brief 5.8A D3a — narrative bridge selector tests.
 *
 * Pure function; no React dependencies. Asserts the structured output for
 * every combination relevant to the rendered T1 card so the render layer
 * can stay declarative.
 */

import { describe, it, expect } from 'vitest'
import { buildNarrativeBridge } from '../buildNarrativeBridge'

describe('buildNarrativeBridge (Brief 5.8A D3a)', () => {
  it('returns null bridge and null meta when no items are worth reviewing', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 0,
      relationshipsToReviewCount: 0,
      hasGoalTarget: true,
    })
    expect(result).toEqual({ prefix: null, bridge: null, meta: null })
  })

  it('renders the prefix sentence when the goal target is unset, even with no items', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 0,
      relationshipsToReviewCount: 0,
      hasGoalTarget: false,
    })
    expect(result.prefix).toBe('No success target set, so analysis cannot show probability of success.')
    expect(result.bridge).toBeNull()
    expect(result.meta).toBeNull()
  })

  it('uses singular nouns when both counts are 1', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 1,
      relationshipsToReviewCount: 1,
      hasGoalTarget: true,
    })
    expect(result.bridge).toEqual({
      estimateCount: 1,
      estimateSuffix: ' unverified estimate',
      relationshipCount: 1,
      relationshipSuffix: ' relationship',
      tail: ' worth reviewing. These are the highest-priority items to review:',
    })
    expect(result.meta).toBe('Ranked by priority')
    expect(result.prefix).toBeNull()
  })

  it('uses plural nouns when both counts exceed 1', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 3,
      relationshipsToReviewCount: 5,
      hasGoalTarget: true,
    })
    expect(result.bridge?.estimateCount).toBe(3)
    expect(result.bridge?.estimateSuffix).toBe(' unverified estimates')
    expect(result.bridge?.relationshipCount).toBe(5)
    expect(result.bridge?.relationshipSuffix).toBe(' relationships')
  })

  it('renders bridge with prefix when both items exist and goal target is unset', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 2,
      relationshipsToReviewCount: 4,
      hasGoalTarget: false,
    })
    expect(result.prefix).toBe('No success target set, so analysis cannot show probability of success.')
    expect(result.bridge).not.toBeNull()
    expect(result.bridge?.estimateCount).toBe(2)
    expect(result.bridge?.relationshipCount).toBe(4)
    expect(result.meta).toBe('Ranked by priority')
  })

  it('renders bridge when only estimates are present (zero relationships)', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 2,
      relationshipsToReviewCount: 0,
      hasGoalTarget: true,
    })
    expect(result.bridge?.estimateCount).toBe(2)
    expect(result.bridge?.relationshipCount).toBe(0)
    expect(result.bridge?.relationshipSuffix).toBe(' relationships')
  })

  it('renders bridge when only relationships are present (zero estimates)', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 0,
      relationshipsToReviewCount: 3,
      hasGoalTarget: true,
    })
    expect(result.bridge?.estimateCount).toBe(0)
    expect(result.bridge?.estimateSuffix).toBe(' unverified estimates')
    expect(result.bridge?.relationshipCount).toBe(3)
  })

  it('always emits "Ranked by priority" meta when bridge is non-null', () => {
    const cases = [
      { unverifiedEstimateCount: 1, relationshipsToReviewCount: 0 },
      { unverifiedEstimateCount: 0, relationshipsToReviewCount: 1 },
      { unverifiedEstimateCount: 5, relationshipsToReviewCount: 5 },
    ]
    for (const c of cases) {
      const result = buildNarrativeBridge({ ...c, hasGoalTarget: true })
      expect(result.meta).toBe('Ranked by priority')
    }
  })

  it('does not include count tokens or HTML in the suffix or tail strings', () => {
    const result = buildNarrativeBridge({
      unverifiedEstimateCount: 7,
      relationshipsToReviewCount: 9,
      hasGoalTarget: true,
    })
    // Suffixes start with a leading space and contain only the noun phrase.
    expect(result.bridge?.estimateSuffix).not.toMatch(/\d/)
    expect(result.bridge?.relationshipSuffix).not.toMatch(/\d/)
    // No HTML — the render layer wraps counts in <strong> itself.
    expect(result.bridge?.tail).not.toMatch(/<[^>]+>/)
  })
})
