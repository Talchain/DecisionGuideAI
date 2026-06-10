import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { computeGraphFacts, computeProvenanceCounts, kindOf } from '../graphFacts'

function node(id: string, kind: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } } as Node
}

describe('computeGraphFacts — presence and counts', () => {
  it('counts options and risks; picks first decision and goal', () => {
    const facts = computeGraphFacts([
      node('d1', 'decision'),
      node('g1', 'goal'),
      node('o1', 'option'),
      node('o2', 'option'),
      node('r1', 'risk', { provenance: 'ai_inferred' }),
      node('f1', 'factor'),
    ])
    expect(facts.decisionNode?.id).toBe('d1')
    expect(facts.goalNode?.id).toBe('g1')
    expect(facts.optionCount).toBe(2)
    expect(facts.riskCount).toBe(1)
    expect(facts.factorNodes.map(n => n.id)).toEqual(['f1'])
  })

  it('falls back to an outcome node for goal presence (audit detection)', () => {
    const facts = computeGraphFacts([node('out1', 'outcome')])
    expect(facts.goalNode?.id).toBe('out1')
  })

  it('risksAllOlumi is true only when every risk carries AI provenance', () => {
    expect(
      computeGraphFacts([
        node('r1', 'risk', { provenance: 'ai_inferred' }),
        node('r2', 'risk', { provenance: 'ai_inferred' }),
      ]).risksAllOlumi,
    ).toBe(true)
    expect(
      computeGraphFacts([
        node('r1', 'risk', { provenance: 'ai_inferred' }),
        node('r2', 'risk', {}),
      ]).risksAllOlumi,
    ).toBe(false)
    expect(computeGraphFacts([]).risksAllOlumi).toBe(false)
  })

  it('kindOf prefers data.kind over node.type', () => {
    const n = { id: 'x', type: 'default', position: { x: 0, y: 0 }, data: { kind: 'risk' } } as unknown as Node
    expect(kindOf(n)).toBe('risk')
  })
})

describe('computeProvenanceCounts — estimable denominator', () => {
  it('splits AI-estimated from reviewed; excludes factors with no source', () => {
    const counts = computeProvenanceCounts([
      node('f1', 'factor', { observedState: { source: 'cee_inference', value: 0.4 } }),
      node('f2', 'factor', { observedState: { source: 'user_confirmed', value: 0.4 } }),
      node('f3', 'factor', { observedState: { value: 0.4 } }),
      node('f4', 'factor', {}),
    ])
    expect(counts).toEqual({ aiEstimatedCount: 1, reviewedCount: 1, estimableCount: 2 })
  })

  it('a confirmed factor stays in the denominator (stable under confirmation)', () => {
    const before = computeProvenanceCounts([
      node('f1', 'factor', { observedState: { source: 'cee_inference' } }),
    ])
    const after = computeProvenanceCounts([
      node('f1', 'factor', { observedState: { source: 'user_confirmed' } }),
    ])
    expect(before.estimableCount).toBe(after.estimableCount)
    expect(after.reviewedCount).toBe(1)
  })
})
