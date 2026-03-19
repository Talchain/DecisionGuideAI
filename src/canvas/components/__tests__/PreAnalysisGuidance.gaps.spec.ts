/**
 * Unit tests for PreAnalysisGuidance gap summary logic.
 *
 * Tests the key invariants of gapItems computation:
 *   - factor without value → no-baseline gap
 *   - factor with engine/inferred/cee_inference source → unconfirmed gap
 *   - external factors are excluded
 *   - goal without target → no-target gap
 *   - escalated (isResultsMode) no-baseline items sort before non-escalated
 *   - no-target sorts before no-baseline, no-baseline before unconfirmed
 *   - VoI score applied when available; edgeCount used as tiebreak
 */

import { describe, it, expect } from 'vitest'

// ----- Minimal type definitions matching PreAnalysisGuidance internals -----

interface GapItem {
  id: string
  label: string
  gapType: 'no-baseline' | 'no-target' | 'unconfirmed'
  nodeId: string
  edgeCount: number
  voiScore: number | null
  escalated: boolean
}

type MockNode = {
  id: string
  type: string
  data: Record<string, unknown>
}

type MockEdge = {
  source: string
  target: string
}

// ----- Extracted/replicated gapItems logic (mirrors PreAnalysisGuidance.tsx) -----

function computeGapItems(
  nodes: MockNode[],
  edges: MockEdge[],
  isResultsMode: boolean,
  voiMap: Map<string, number>,
): GapItem[] {
  const typeOrder = { 'no-target': 0, 'no-baseline': 1, 'unconfirmed': 2 }
  const items: GapItem[] = []

  for (const node of nodes) {
    const nodeType = node.type || (node.data?.kind as string | undefined)
    const label = String(node.data?.label ?? node.id)
    const edgeCount = edges.filter(e => e.source === node.id || e.target === node.id).length
    const observedState = node.data?.observedState as Record<string, unknown> | undefined
    const voiScore = voiMap.get(node.id) ?? null

    if (nodeType === 'factor') {
      const category = node.data?.category as string | undefined
      if (category === 'external') continue
      const hasValue = observedState?.value !== undefined && observedState.value !== null
      const hasRawValue = observedState?.raw_value !== undefined && observedState.raw_value !== null
      if (!hasValue && !hasRawValue) {
        items.push({
          id: `gap-no-baseline-${node.id}`, label, gapType: 'no-baseline',
          nodeId: node.id, edgeCount, voiScore,
          escalated: isResultsMode,
        })
      } else {
        const src = observedState?.source as string | undefined
        if (src === 'inferred' || src === 'cee_inference' || src === 'engine') {
          items.push({
            id: `gap-unconfirmed-${node.id}`, label, gapType: 'unconfirmed',
            nodeId: node.id, edgeCount, voiScore, escalated: false,
          })
        }
      }
    } else if (nodeType === 'goal') {
      const thresholdRaw = node.data?.goal_threshold_raw
      const hasTarget = thresholdRaw !== null && thresholdRaw !== undefined && String(thresholdRaw).trim() !== ''
      if (!hasTarget) {
        items.push({
          id: `gap-no-target-${node.id}`, label, gapType: 'no-target',
          nodeId: node.id, edgeCount, voiScore: null, escalated: false,
        })
      }
    }
  }

  return items.sort((a, b) => {
    if (a.escalated !== b.escalated) return a.escalated ? -1 : 1
    const typeDiff = typeOrder[a.gapType] - typeOrder[b.gapType]
    if (typeDiff !== 0) return typeDiff
    if (a.voiScore !== null && b.voiScore !== null) return b.voiScore - a.voiScore
    return b.edgeCount - a.edgeCount
  })
}

// ----- Tests -----

describe('gapItems — gap detection', () => {
  it('flags a factor with no value as no-baseline', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'Revenue', category: 'controllable', observedState: {} } },
    ]
    const gaps = computeGapItems(nodes, [], false, new Map())
    expect(gaps).toHaveLength(1)
    expect(gaps[0].gapType).toBe('no-baseline')
    expect(gaps[0].nodeId).toBe('f1')
  })

  it('skips external factors', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'Ext', category: 'external', observedState: {} } },
    ]
    expect(computeGapItems(nodes, [], false, new Map())).toHaveLength(0)
  })

  it('flags engine source as unconfirmed', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'Est', category: 'controllable', observedState: { value: 5, source: 'engine' } } },
    ]
    const gaps = computeGapItems(nodes, [], false, new Map())
    expect(gaps[0].gapType).toBe('unconfirmed')
  })

  it('flags inferred and cee_inference sources as unconfirmed', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'A', category: 'observable', observedState: { value: 1, source: 'inferred' } } },
      { id: 'f2', type: 'factor', data: { label: 'B', category: 'observable', observedState: { value: 2, source: 'cee_inference' } } },
    ]
    const gaps = computeGapItems(nodes, [], false, new Map())
    expect(gaps.every(g => g.gapType === 'unconfirmed')).toBe(true)
  })

  it('does not flag user-sourced factors', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'F', category: 'controllable', observedState: { value: 10, source: 'user' } } },
    ]
    expect(computeGapItems(nodes, [], false, new Map())).toHaveLength(0)
  })

  it('flags goal with no threshold as no-target', () => {
    const nodes: MockNode[] = [
      { id: 'g1', type: 'goal', data: { label: 'Goal', goal_threshold_raw: null } },
    ]
    const gaps = computeGapItems(nodes, [], false, new Map())
    expect(gaps[0].gapType).toBe('no-target')
  })

  it('does not flag goal with a threshold set', () => {
    const nodes: MockNode[] = [
      { id: 'g1', type: 'goal', data: { label: 'Goal', goal_threshold_raw: 100 } },
    ]
    expect(computeGapItems(nodes, [], false, new Map())).toHaveLength(0)
  })
})

describe('gapItems — sort order', () => {
  it('escalated items (isResultsMode no-baseline) sort first', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'A', category: 'controllable', observedState: {} } },
      { id: 'g1', type: 'goal', data: { label: 'G', goal_threshold_raw: null } },
    ]
    const gapsPost = computeGapItems(nodes, [], true, new Map())
    expect(gapsPost[0].gapType).toBe('no-baseline') // escalated
    expect(gapsPost[0].escalated).toBe(true)
    expect(gapsPost[1].gapType).toBe('no-target')
  })

  it('pre-analysis: no-target before no-baseline before unconfirmed', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'B', category: 'controllable', observedState: { value: 1, source: 'engine' } } },
      { id: 'f2', type: 'factor', data: { label: 'A', category: 'controllable', observedState: {} } },
      { id: 'g1', type: 'goal', data: { label: 'G', goal_threshold_raw: undefined } },
    ]
    const gaps = computeGapItems(nodes, [], false, new Map())
    expect(gaps[0].gapType).toBe('no-target')
    expect(gaps[1].gapType).toBe('no-baseline')
    expect(gaps[2].gapType).toBe('unconfirmed')
  })

  it('ranks no-baseline by VoI descending when voiMap provided', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'Low VoI', category: 'controllable', observedState: {} } },
      { id: 'f2', type: 'factor', data: { label: 'High VoI', category: 'controllable', observedState: {} } },
    ]
    const voiMap = new Map([['f1', 0.1], ['f2', 0.8]])
    const gaps = computeGapItems(nodes, [], true, voiMap)
    expect(gaps[0].nodeId).toBe('f2') // higher VoI first
    expect(gaps[1].nodeId).toBe('f1')
  })

  it('falls back to edgeCount descending when no VoI available', () => {
    const nodes: MockNode[] = [
      { id: 'f1', type: 'factor', data: { label: 'Few edges', category: 'controllable', observedState: {} } },
      { id: 'f2', type: 'factor', data: { label: 'Many edges', category: 'controllable', observedState: {} } },
    ]
    const edges: MockEdge[] = [
      { source: 'f2', target: 'x1' },
      { source: 'f2', target: 'x2' },
      { source: 'f1', target: 'x1' },
    ]
    const gaps = computeGapItems(nodes, edges, true, new Map())
    expect(gaps[0].nodeId).toBe('f2') // 2 edges
    expect(gaps[1].nodeId).toBe('f1') // 1 edge
  })
})
