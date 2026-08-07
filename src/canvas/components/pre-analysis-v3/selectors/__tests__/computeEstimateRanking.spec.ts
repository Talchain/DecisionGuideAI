import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { computeEstimateRanking, sensitivityMatchesGraph } from '../computeEstimateRanking'
import type { PreAnalysisSensitivity } from '../../../../../adapters/cee/types'
// Staging-derived payload (PLoT /v1/pre-analysis-sensitivity, 2026-06-10).
import stagingSensitivity from '../../../../../../tests/fixtures/plot-responses/pre-analysis-sensitivity.staging-20260610.json'

function factor(id: string, label?: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', label: label ?? id },
  } as Node
}

function edge(source: string, target: string): Edge {
  return { id: `${source}->${target}`, source, target } as Edge
}

const STAGING_IDS = Object.keys(
  (stagingSensitivity as PreAnalysisSensitivity).factor_influence,
)

describe('computeEstimateRanking — sensitivity mode', () => {
  const factors = STAGING_IDS.map(id => factor(id))
  const sensitivity = stagingSensitivity as PreAnalysisSensitivity

  it('orders factors by descending live influence (staging payload)', () => {
    const ranking = computeEstimateRanking(factors, [], sensitivity)
    expect(ranking.source).toBe('sensitivity')
    expect(ranking.ordered[0]).toBe('fac_migration_effort') // influence 1
    expect(ranking.ordered[1]).toBe('fac_vendor_spend') // 0.58
    const weights = ranking.ordered.map(id => ranking.weights[id])
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeLessThanOrEqual(weights[i - 1])
    }
  })

  it('stale guard: a factor removed since the payload falls back to degree', () => {
    const withoutOne = factors.slice(1)
    const ranking = computeEstimateRanking(withoutOne, [], sensitivity)
    expect(ranking.source).toBe('degree')
  })

  it('stale guard: a factor added since the payload falls back to degree', () => {
    const withExtra = [...factors, factor('fac_new_addition')]
    const ranking = computeEstimateRanking(withExtra, [], sensitivity)
    expect(ranking.source).toBe('degree')
  })

  it('stale guard: a renamed id (remove + add) falls back to degree', () => {
    const swapped = [...factors.slice(1), factor('fac_renamed')]
    expect(
      sensitivityMatchesGraph(
        (stagingSensitivity as PreAnalysisSensitivity).factor_influence,
        swapped,
      ),
    ).toBe(false)
    expect(computeEstimateRanking(swapped, [], sensitivity).source).toBe('degree')
  })

  it('null payload uses degree', () => {
    expect(computeEstimateRanking(factors, [], null).source).toBe('degree')
  })
})

describe('computeEstimateRanking — degree fallback', () => {
  it('weights by connections in plus out, plus the base weight', () => {
    const factors = [factor('a'), factor('b'), factor('c')]
    const edges = [edge('a', 'goal'), edge('x', 'a'), edge('b', 'goal')]
    const ranking = computeEstimateRanking(factors, edges, null)
    expect(ranking.source).toBe('degree')
    expect(ranking.weights.a).toBe(3) // 2 connections + base 1
    expect(ranking.weights.b).toBe(2)
    expect(ranking.weights.c).toBe(1) // unconnected still counts
    expect(ranking.ordered).toEqual(['a', 'b', 'c'])
  })

  it('tie-break is stable: label (case-insensitive), then id', () => {
    const factors = [factor('f2', 'beta'), factor('f1', 'Alpha'), factor('f3', 'alpha')]
    const ranking = computeEstimateRanking(factors, [], null)
    // All weights equal (base 1): Alpha (f1) before alpha (f3) by id, then beta.
    expect(ranking.ordered).toEqual(['f1', 'f3', 'f2'])
  })

  it('returns empty ordering for no factors', () => {
    const ranking = computeEstimateRanking([], [], null)
    expect(ranking.ordered).toEqual([])
  })
})
