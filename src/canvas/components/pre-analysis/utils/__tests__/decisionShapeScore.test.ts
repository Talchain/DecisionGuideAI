import { describe, it, expect } from 'vitest'
import { decisionShapeScore } from '../decisionShapeScore'

describe('decisionShapeScore', () => {
  it('returns 0 for empty graph', () => {
    expect(decisionShapeScore({ optionCount: 0, outcomeCount: 0, factorCount: 0, edgeCount: 0 })).toBe(0)
  })

  it('returns partial score for minimal graph (1 option, 1 goal, no factors, no edges)', () => {
    // optionScore = 0.5 (1/2) * 0.30 = 0.15
    // outcomeScore = 1 * 0.25 = 0.25
    // factorScore = 0 * 0.25 = 0
    // connectionScore = 0 * 0.20 = 0
    // total = 0.40
    expect(decisionShapeScore({ optionCount: 1, outcomeCount: 1, factorCount: 0, edgeCount: 0 })).toBe(0.40)
  })

  it('returns 1 for fully specified graph (2+ options, 1+ goal, 3+ factors, 4+ edges)', () => {
    expect(decisionShapeScore({ optionCount: 2, outcomeCount: 1, factorCount: 3, edgeCount: 4 })).toBe(1)
  })

  it('caps option score at 1 when optionCount > 2', () => {
    const withMany = decisionShapeScore({ optionCount: 5, outcomeCount: 1, factorCount: 3, edgeCount: 4 })
    expect(withMany).toBe(1)
  })

  it('caps factor score at 1 when factorCount > 3', () => {
    const withMany = decisionShapeScore({ optionCount: 2, outcomeCount: 1, factorCount: 10, edgeCount: 4 })
    expect(withMany).toBe(1)
  })

  it('outcome missing results in 0.25 penalty', () => {
    const withGoal = decisionShapeScore({ optionCount: 2, outcomeCount: 1, factorCount: 3, edgeCount: 4 })
    const withoutGoal = decisionShapeScore({ optionCount: 2, outcomeCount: 0, factorCount: 3, edgeCount: 4 })
    expect(withGoal - withoutGoal).toBe(0.25)
  })

  it('caller must exclude constraint edges before passing edgeCount', () => {
    // Constraint edges connect to constraint nodes (structural scaffolding, not causal).
    // The caller (PreAnalysisPanel) filters them; this test confirms the formula
    // treats the count as substantive edges only.
    // Graph with 4 total edges but 2 are constraint edges → caller passes edgeCount: 2
    const withConstraintEdgesFiltered = decisionShapeScore({ optionCount: 2, outcomeCount: 1, factorCount: 3, edgeCount: 2 })
    const withAllEdges = decisionShapeScore({ optionCount: 2, outcomeCount: 1, factorCount: 3, edgeCount: 4 })
    // Filtered count (2) gives lower connection score than full count (4)
    expect(withConstraintEdgesFiltered).toBeLessThan(withAllEdges)
    // connectionScore = min(2/4, 1) * 0.20 = 0.10 vs min(4/4, 1) * 0.20 = 0.20
    expect(withAllEdges - withConstraintEdgesFiltered).toBeCloseTo(0.10)
  })
})
