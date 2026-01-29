import { describe, it, expect } from 'vitest'
import { findPathsToGoal, findPathsFromRoots, getInterventionTargets } from '../pathFinding'

describe('findPathsToGoal', () => {
  it('should return empty array if no path exists', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'b' }]
    const result = findPathsToGoal('a', 'goal', edges)
    expect(result).toEqual([])
  })

  it('should return single edge for direct connection', () => {
    const edges = [{ id: 'e1', source: 'factor', target: 'goal' }]
    const result = findPathsToGoal('factor', 'goal', edges)
    expect(result).toEqual(['e1'])
  })

  it('should return all edges for linear path', () => {
    const edges = [
      { id: 'e1', source: 'factor', target: 'outcome' },
      { id: 'e2', source: 'outcome', target: 'goal' },
    ]
    const result = findPathsToGoal('factor', 'goal', edges)
    expect(result).toContain('e1')
    expect(result).toContain('e2')
  })

  it('should return all edges for multi-path graph', () => {
    const edges = [
      { id: 'e1', source: 'factor', target: 'outcome_a' },
      { id: 'e2', source: 'factor', target: 'outcome_b' },
      { id: 'e3', source: 'outcome_a', target: 'goal' },
      { id: 'e4', source: 'outcome_b', target: 'goal' },
    ]
    const result = findPathsToGoal('factor', 'goal', edges)
    expect(result).toHaveLength(4)
  })

  // CRITICAL: Reconverging graph test (fixes visited-set bug)
  it('should highlight ALL edges in reconverging graph', () => {
    // A → B → D → Goal AND A → C → D → Goal
    // Both paths must be fully highlighted
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'D' }, // This was being missed with naive DFS!
      { id: 'e5', source: 'D', target: 'Goal' },
    ]
    const result = findPathsToGoal('A', 'Goal', edges)
    expect(result).toHaveLength(5)
    expect(result).toContain('e1')
    expect(result).toContain('e2')
    expect(result).toContain('e3')
    expect(result).toContain('e4') // Must not be missed
    expect(result).toContain('e5')
  })

  it('should handle diamond pattern (common in causal graphs)', () => {
    // factor → outcome_a → goal
    // factor → outcome_b → goal
    // outcome_a → outcome_b (cross-link)
    const edges = [
      { id: 'e1', source: 'factor', target: 'outcome_a' },
      { id: 'e2', source: 'factor', target: 'outcome_b' },
      { id: 'e3', source: 'outcome_a', target: 'goal' },
      { id: 'e4', source: 'outcome_b', target: 'goal' },
      { id: 'e5', source: 'outcome_a', target: 'outcome_b' }, // cross-link
    ]
    const result = findPathsToGoal('factor', 'goal', edges)
    expect(result).toHaveLength(5) // All edges are on valid paths
  })

  it('should handle cycles without infinite loop', () => {
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' }, // cycle
      { id: 'e3', source: 'b', target: 'goal' },
    ]
    const result = findPathsToGoal('a', 'goal', edges)
    expect(result).toContain('e1')
    expect(result).toContain('e3')
    // Cycle edge not needed for reaching goal
  })

  it('should respect maxDepth parameter', () => {
    // Create chain of 15 nodes
    const edges = Array.from({ length: 14 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i}`,
      target: `n${i + 1}`,
    }))
    // n14 is the goal
    const result = findPathsToGoal('n0', 'n14', edges, { maxDepth: 10 })
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('should return empty array when start node equals goal', () => {
    const edges = [{ id: 'e1', source: 'a', target: 'goal' }]
    const result = findPathsToGoal('goal', 'goal', edges)
    expect(result).toEqual([])
  })

  it('should handle disconnected subgraphs', () => {
    const edges = [
      { id: 'e1', source: 'factor_a', target: 'goal' },
      { id: 'e2', source: 'factor_b', target: 'other' }, // disconnected from goal
    ]
    const result = findPathsToGoal('factor_a', 'goal', edges)
    expect(result).toEqual(['e1'])
  })
})

describe('findPathsFromRoots', () => {
  it('should find all paths leading to goal', () => {
    const edges = [
      { id: 'e1', source: 'root_a', target: 'goal' },
      { id: 'e2', source: 'root_b', target: 'mid' },
      { id: 'e3', source: 'mid', target: 'goal' },
    ]
    const result = findPathsFromRoots('goal', edges)
    expect(result).toContain('e1')
    expect(result).toContain('e2')
    expect(result).toContain('e3')
  })

  it('should handle single incoming edge', () => {
    const edges = [{ id: 'e1', source: 'factor', target: 'goal' }]
    const result = findPathsFromRoots('goal', edges)
    expect(result).toEqual(['e1'])
  })

  it('should return empty array when goal has no incoming edges', () => {
    const edges = [{ id: 'e1', source: 'goal', target: 'other' }]
    const result = findPathsFromRoots('goal', edges)
    expect(result).toEqual([])
  })

  it('should handle deep tree structure', () => {
    const edges = [
      { id: 'e1', source: 'root', target: 'mid1' },
      { id: 'e2', source: 'mid1', target: 'mid2' },
      { id: 'e3', source: 'mid2', target: 'goal' },
    ]
    const result = findPathsFromRoots('goal', edges)
    expect(result).toHaveLength(3)
  })

  it('should respect maxDepth parameter', () => {
    // Create reverse chain of 15 nodes leading to goal
    const edges = Array.from({ length: 14 }, (_, i) => ({
      id: `e${i}`,
      source: `n${13 - i}`,
      target: i === 0 ? 'goal' : `n${14 - i}`,
    }))
    const result = findPathsFromRoots('goal', edges, { maxDepth: 5 })
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('should highlight ALL edges in reconverging graph (upstream convergence)', () => {
    // Graph structure:
    //       root1 → A ─┐
    //                  ├─→ mid → goal
    //       root2 → B ─┘
    //
    // Both paths A→mid and B→mid should be highlighted
    const edges = [
      { id: 'root1-a', source: 'root1', target: 'a' },
      { id: 'root2-b', source: 'root2', target: 'b' },
      { id: 'a-mid', source: 'a', target: 'mid' },
      { id: 'b-mid', source: 'b', target: 'mid' },
      { id: 'mid-goal', source: 'mid', target: 'goal' },
    ]
    const result = findPathsFromRoots('goal', edges)

    // Must include ALL 5 edges
    expect(result).toContain('root1-a')
    expect(result).toContain('root2-b')
    expect(result).toContain('a-mid')
    expect(result).toContain('b-mid')
    expect(result).toContain('mid-goal')
    expect(result).toHaveLength(5)
  })
})

describe('getInterventionTargets', () => {
  it('should return intervention target IDs from options array', () => {
    const options = [
      { id: 'option_a', interventions: { factor_price: 59, factor_spend: 100 } },
      { id: 'option_b', interventions: { factor_price: 49 } },
    ]
    const result = getInterventionTargets('option_a', options)
    expect(result).toContain('factor_price')
    expect(result).toContain('factor_spend')
    expect(result).toHaveLength(2)
  })

  it('should return empty array for option without interventions', () => {
    const options = [{ id: 'option_a', interventions: {} }]
    const result = getInterventionTargets('option_a', options)
    expect(result).toEqual([])
  })

  it('should return empty array for unknown option ID', () => {
    const options = [{ id: 'option_a', interventions: { factor_x: 1 } }]
    const result = getInterventionTargets('option_unknown', options)
    expect(result).toEqual([])
  })

  it('should return empty array for option with undefined interventions', () => {
    const options = [{ id: 'option_a' }] as { id: string; interventions?: Record<string, number> }[]
    const result = getInterventionTargets('option_a', options)
    expect(result).toEqual([])
  })

  it('should return empty array for empty options array', () => {
    const result = getInterventionTargets('option_a', [])
    expect(result).toEqual([])
  })
})
