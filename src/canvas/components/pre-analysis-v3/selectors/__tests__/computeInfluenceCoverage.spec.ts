/**
 * Characterisation tests pinning the transition-bridge influence-coverage
 * behaviour extracted from OutputsDock.handleRunAnalysis. The assertions
 * encode the inline algorithm exactly as it shipped, including its narrower
 * reviewed-source set (no bare 'user' alias).
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  computeInfluenceCoverage,
  isTransitionBridgeReviewed,
} from '../computeInfluenceCoverage'

function factor(id: string, source?: string, extra?: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label: id,
      ...(source ? { observedState: { source } } : {}),
      ...extra,
    },
  } as Node
}

describe('isTransitionBridgeReviewed (pinned inline behaviour)', () => {
  it('accepts the four bridge sources', () => {
    for (const s of ['user_confirmed', 'user_assumption', 'user_override', 'user_edited']) {
      expect(isTransitionBridgeReviewed(factor('f', s))).toBe(true)
    }
  })

  it("rejects the bare 'user' alias (historical bridge quirk, pinned)", () => {
    expect(isTransitionBridgeReviewed(factor('f', 'user'))).toBe(false)
  })

  it('rejects AI sources and missing observed state', () => {
    expect(isTransitionBridgeReviewed(factor('f', 'cee_inference'))).toBe(false)
    expect(isTransitionBridgeReviewed(factor('f'))).toBe(false)
  })

  it('reads snake_case observed_state when camelCase is absent', () => {
    const n = {
      id: 'f',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { kind: 'factor', observed_state: { source: 'user_confirmed' } },
    } as unknown as Node
    expect(isTransitionBridgeReviewed(n)).toBe(true)
  })

  it('rejects non-factor nodes regardless of source', () => {
    const n = {
      id: 'o1',
      type: 'option',
      position: { x: 0, y: 0 },
      data: { kind: 'option', observedState: { source: 'user_confirmed' } },
    } as unknown as Node
    expect(isTransitionBridgeReviewed(n)).toBe(false)
  })

  it('treats a node as a factor when only node.type says so', () => {
    const n = {
      id: 'f',
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { observedState: { source: 'user_edited' } },
    } as unknown as Node
    expect(isTransitionBridgeReviewed(n)).toBe(true)
  })
})

describe('computeInfluenceCoverage (pinned inline algorithm)', () => {
  const nodes: Node[] = [
    factor('f1', 'user_confirmed'),
    factor('f2', 'cee_inference'),
    factor('f3', 'user_edited'),
    {
      id: 'g1',
      type: 'goal',
      position: { x: 0, y: 0 },
      data: { kind: 'goal', label: 'Goal' },
    } as unknown as Node,
  ]

  it('weights coverage by factor influence', () => {
    const { verifiedCount, influenceCoverage, reviewedIds } = computeInfluenceCoverage(
      nodes,
      { f1: 0.6, f2: 0.3, f3: 0.1 },
      isTransitionBridgeReviewed,
    )
    expect(verifiedCount).toBe(2)
    expect(reviewedIds.has('f1')).toBe(true)
    expect(reviewedIds.has('f3')).toBe(true)
    expect(influenceCoverage).toBeCloseTo(0.7, 10)
  })

  it('returns 0 coverage with no sensitivity payload (but still counts reviews)', () => {
    const r = computeInfluenceCoverage(nodes, null, isTransitionBridgeReviewed)
    expect(r.verifiedCount).toBe(2)
    expect(r.influenceCoverage).toBe(0)
  })

  it('returns 0 (never NaN) when the payload sums to zero', () => {
    const r = computeInfluenceCoverage(nodes, { f1: 0, f2: 0 }, isTransitionBridgeReviewed)
    expect(r.influenceCoverage).toBe(0)
    expect(Number.isNaN(r.influenceCoverage)).toBe(false)
  })

  it('ignores influence entries whose ids are not reviewed factors', () => {
    const r = computeInfluenceCoverage(
      nodes,
      { f1: 0.5, ghost: 0.5 },
      isTransitionBridgeReviewed,
    )
    // ghost contributes to the denominator only — pinned inline behaviour.
    expect(r.influenceCoverage).toBeCloseTo(0.5, 10)
  })

  it('supports an injected predicate (canonical reviewed set)', () => {
    const r = computeInfluenceCoverage(
      [factor('f1', 'user')],
      { f1: 1 },
      () => true,
    )
    expect(r.verifiedCount).toBe(1)
    expect(r.influenceCoverage).toBe(1)
  })
})
