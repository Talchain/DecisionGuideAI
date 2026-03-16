import { describe, it, expect } from 'vitest'
import { computeOptionPaths } from '../computeOptionPaths'

/*
 * Test graph topology:
 *
 *   decision ──→ optionA ──→ factorX ──→ outcome ──→ goal
 *             └─→ optionB ──→ factorY ──→ outcome
 *                               └──→ riskR ──→ goal
 *   constraint ──→ outcome
 */

const nodes = [
  { id: 'decision', type: 'decision' },
  { id: 'optionA', type: 'option' },
  { id: 'optionB', type: 'option' },
  { id: 'factorX', type: 'factor' },
  { id: 'factorY', type: 'factor' },
  { id: 'outcome', type: 'outcome' },
  { id: 'goal', type: 'goal' },
  { id: 'riskR', type: 'risk' },
  { id: 'constraint', type: 'constraint' },
  { id: 'disconnected', type: 'factor' },
]

const edges = [
  { id: 'e-dec-a', source: 'decision', target: 'optionA' },
  { id: 'e-dec-b', source: 'decision', target: 'optionB' },
  { id: 'e-a-x', source: 'optionA', target: 'factorX' },
  { id: 'e-b-y', source: 'optionB', target: 'factorY' },
  { id: 'e-x-out', source: 'factorX', target: 'outcome' },
  { id: 'e-y-out', source: 'factorY', target: 'outcome' },
  { id: 'e-out-goal', source: 'outcome', target: 'goal' },
  { id: 'e-y-risk', source: 'factorY', target: 'riskR' },
  { id: 'e-risk-goal', source: 'riskR', target: 'goal' },
  { id: 'e-con-out', source: 'constraint', target: 'outcome' },
]

const ceeOptions = [
  { id: 'optionA', interventions: { factorX: 1.0 } },
  { id: 'optionB', interventions: { factorY: 0.8 } },
]

describe('computeOptionPaths', () => {
  it('includes the full structural path: decision → option → target → downstream → goal', () => {
    const result = computeOptionPaths(nodes, edges, 'optionA', ceeOptions)

    // Decision node
    expect(result.activeNodeIds.has('decision')).toBe(true)
    // Option node
    expect(result.activeNodeIds.has('optionA')).toBe(true)
    // Intervention target
    expect(result.activeNodeIds.has('factorX')).toBe(true)
    // Downstream
    expect(result.activeNodeIds.has('outcome')).toBe(true)
    expect(result.activeNodeIds.has('goal')).toBe(true)

    // Structural edges
    expect(result.activeEdgeKeys.has('e-dec-a')).toBe(true)  // decision → optionA
    expect(result.activeEdgeKeys.has('e-a-x')).toBe(true)    // optionA → factorX
    expect(result.activeEdgeKeys.has('e-x-out')).toBe(true)  // factorX → outcome
    expect(result.activeEdgeKeys.has('e-out-goal')).toBe(true) // outcome → goal
  })

  it('excludes the other option and its exclusive paths', () => {
    const result = computeOptionPaths(nodes, edges, 'optionA', ceeOptions)

    // optionB is NOT in the active set (it is a sibling, not on optionA's path)
    expect(result.activeNodeIds.has('optionB')).toBe(false)
    // decision → optionB edge excluded
    expect(result.activeEdgeKeys.has('e-dec-b')).toBe(false)
    // optionB → factorY edge excluded
    expect(result.activeEdgeKeys.has('e-b-y')).toBe(false)
  })

  it('includes risk nodes downstream of intervention targets', () => {
    const result = computeOptionPaths(nodes, edges, 'optionB', ceeOptions)

    // factorY → riskR → goal
    expect(result.activeNodeIds.has('riskR')).toBe(true)
    expect(result.activeEdgeKeys.has('e-y-risk')).toBe(true)
    expect(result.activeEdgeKeys.has('e-risk-goal')).toBe(true)
  })

  it('includes constraint nodes connected to visible paths', () => {
    const result = computeOptionPaths(nodes, edges, 'optionA', ceeOptions)

    // constraint → outcome (outcome is active, constraint should be included)
    expect(result.activeNodeIds.has('constraint')).toBe(true)
    expect(result.activeEdgeKeys.has('e-con-out')).toBe(true)
  })

  it('excludes disconnected nodes', () => {
    const result = computeOptionPaths(nodes, edges, 'optionA', ceeOptions)

    expect(result.activeNodeIds.has('disconnected')).toBe(false)
  })

  it('handles shared factors on paths for multiple options', () => {
    // Both optionA and optionB paths converge at outcome → goal
    const resultA = computeOptionPaths(nodes, edges, 'optionA', ceeOptions)
    const resultB = computeOptionPaths(nodes, edges, 'optionB', ceeOptions)

    // Both should include outcome and goal
    expect(resultA.activeNodeIds.has('outcome')).toBe(true)
    expect(resultB.activeNodeIds.has('outcome')).toBe(true)
    expect(resultA.activeNodeIds.has('goal')).toBe(true)
    expect(resultB.activeNodeIds.has('goal')).toBe(true)
  })

  it('handles option with no interventions gracefully', () => {
    const result = computeOptionPaths(
      nodes,
      edges,
      'optionA',
      [{ id: 'optionA' }],  // no interventions field
    )

    // Still includes decision and option node
    expect(result.activeNodeIds.has('decision')).toBe(true)
    expect(result.activeNodeIds.has('optionA')).toBe(true)
    expect(result.activeEdgeKeys.has('e-dec-a')).toBe(true)
  })

  it('handles unknown optionId gracefully', () => {
    const result = computeOptionPaths(nodes, edges, 'nonexistent', ceeOptions)

    // Should still include the optionId itself
    expect(result.activeNodeIds.has('nonexistent')).toBe(true)
    // But nothing else significant
    expect(result.activeNodeIds.size).toBe(1)
  })
})
