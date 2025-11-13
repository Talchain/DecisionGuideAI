/**
 * Backend Kind Mapping Tests
 * S1-MAP: Comprehensive coverage of kind mapping edge cases
 */

import { describe, it, expect } from 'vitest'
import {
  toUiKind,
  isKnownKind,
  coerceNode,
  coerceNodes,
  getUnknownKindWarning,
  type BackendNode
} from '../backendKinds'

describe('S1-MAP: toUiKind - Exact Matches', () => {
  it('should map canonical kinds correctly', () => {
    expect(toUiKind('goal')).toBe('goal')
    expect(toUiKind('decision')).toBe('decision')
    expect(toUiKind('option')).toBe('option')
    expect(toUiKind('factor')).toBe('factor')
    expect(toUiKind('risk')).toBe('risk')
    expect(toUiKind('outcome')).toBe('outcome')
  })

  it('should map snake_case variants', () => {
    expect(toUiKind('decision_node')).toBe('decision')
    expect(toUiKind('outcome_node')).toBe('outcome')
    expect(toUiKind('goal_node')).toBe('goal')
    expect(toUiKind('option_node')).toBe('option')
    expect(toUiKind('factor_node')).toBe('factor')
    expect(toUiKind('risk_node')).toBe('risk')
  })

  it('should map legacy/alternative names', () => {
    expect(toUiKind('decision-binary')).toBe('decision')
    expect(toUiKind('decision-probability')).toBe('decision')
    expect(toUiKind('outcome-terminal')).toBe('outcome')
    expect(toUiKind('input-categorical')).toBe('factor')
    expect(toUiKind('input-continuous')).toBe('factor')
    expect(toUiKind('transform-lookup')).toBe('factor')
  })
})

describe('S1-MAP: toUiKind - Case Insensitivity', () => {
  it('should handle uppercase variants', () => {
    expect(toUiKind('GOAL')).toBe('goal')
    expect(toUiKind('DECISION')).toBe('decision')
    expect(toUiKind('OPTION')).toBe('option')
    expect(toUiKind('FACTOR')).toBe('factor')
    expect(toUiKind('RISK')).toBe('risk')
    expect(toUiKind('OUTCOME')).toBe('outcome')
  })

  it('should handle mixed case variants', () => {
    expect(toUiKind('Goal')).toBe('goal')
    expect(toUiKind('Decision')).toBe('decision')
    expect(toUiKind('Option')).toBe('option')
  })

  it('should handle case-insensitive snake_case', () => {
    expect(toUiKind('DECISION_NODE')).toBe('decision')
    expect(toUiKind('Decision_Node')).toBe('decision')
  })
})

describe('S1-UNK: toUiKind - Unknown Kinds', () => {
  it('should fallback to factor for unknown kinds', () => {
    expect(toUiKind('unknown-type')).toBe('factor')
    expect(toUiKind('custom_node')).toBe('factor')
    expect(toUiKind('foobar')).toBe('factor')
  })

  it('should handle null/undefined gracefully', () => {
    expect(toUiKind(null)).toBe('factor')
    expect(toUiKind(undefined)).toBe('factor')
    expect(toUiKind('')).toBe('factor')
  })

  it('should handle non-string types gracefully', () => {
    expect(toUiKind(123 as any)).toBe('factor')
    expect(toUiKind({} as any)).toBe('factor')
    expect(toUiKind([] as any)).toBe('factor')
  })
})

describe('S1-MAP: isKnownKind', () => {
  it('should return true for known canonical kinds', () => {
    expect(isKnownKind('goal')).toBe(true)
    expect(isKnownKind('decision')).toBe(true)
    expect(isKnownKind('option')).toBe(true)
    expect(isKnownKind('factor')).toBe(true)
    expect(isKnownKind('risk')).toBe(true)
    expect(isKnownKind('outcome')).toBe(true)
  })

  it('should return true for known variants', () => {
    expect(isKnownKind('decision_node')).toBe(true)
    expect(isKnownKind('GOAL')).toBe(true)
    expect(isKnownKind('decision-binary')).toBe(true)
  })

  it('should return false for unknown kinds', () => {
    expect(isKnownKind('unknown-type')).toBe(false)
    expect(isKnownKind('custom_node')).toBe(false)
    expect(isKnownKind('foobar')).toBe(false)
  })

  it('should return false for null/undefined/empty', () => {
    expect(isKnownKind(null)).toBe(false)
    expect(isKnownKind(undefined)).toBe(false)
    expect(isKnownKind('')).toBe(false)
  })
})

describe('S1-MAP: coerceNode', () => {
  it('should coerce node with known kind', () => {
    const backendNode: BackendNode = {
      id: 'n1',
      label: 'Test Node',
      kind: 'decision',
      body: 'Test description',
      position: { x: 100, y: 200 }
    }

    const coerced = coerceNode(backendNode)

    expect(coerced.id).toBe('n1')
    expect(coerced.type).toBe('decision')
    expect(coerced.position).toEqual({ x: 100, y: 200 })
    expect(coerced.data.label).toBe('Test Node')
    expect(coerced.data.type).toBe('decision')
    expect(coerced.data.kind).toBe('decision')
    expect(coerced.data.body).toBe('Test description')
    expect(coerced.data.unknownKind).toBeUndefined()
    expect(coerced.data.originalKind).toBeUndefined()
  })

  it('should flag unknown kinds and preserve original', () => {
    const backendNode: BackendNode = {
      id: 'n2',
      label: 'Custom Node',
      kind: 'custom-type'
    }

    const coerced = coerceNode(backendNode)

    expect(coerced.type).toBe('factor') // Fallback
    expect(coerced.data.type).toBe('factor')
    expect(coerced.data.kind).toBe('factor')
    expect(coerced.data.unknownKind).toBe(true)
    expect(coerced.data.originalKind).toBe('custom-type')
  })

  it('should apply default position when missing', () => {
    const backendNode: BackendNode = {
      id: 'n3',
      label: 'No Position',
      kind: 'goal'
    }

    const coerced = coerceNode(backendNode, 0)

    expect(coerced.position).toEqual({ x: 200, y: 100 })
  })

  it('should apply grid layout for multiple nodes without position', () => {
    const coerced0 = coerceNode({ id: 'n0', kind: 'goal' }, 0)
    const coerced1 = coerceNode({ id: 'n1', kind: 'decision' }, 1)
    const coerced2 = coerceNode({ id: 'n2', kind: 'option' }, 2)
    const coerced3 = coerceNode({ id: 'n3', kind: 'factor' }, 3)

    expect(coerced0.position).toEqual({ x: 200, y: 100 })
    expect(coerced1.position).toEqual({ x: 450, y: 100 })
    expect(coerced2.position).toEqual({ x: 700, y: 100 })
    expect(coerced3.position).toEqual({ x: 200, y: 300 }) // Row 2
  })

  it('should use label or id as fallback', () => {
    const withLabel = coerceNode({ id: 'n1', label: 'My Label', kind: 'decision' })
    const withoutLabel = coerceNode({ id: 'n2', kind: 'decision' })

    expect(withLabel.data.label).toBe('My Label')
    expect(withoutLabel.data.label).toBe('n2') // Falls back to ID
  })

  it('should preserve prior and utility', () => {
    const backendNode: BackendNode = {
      id: 'n1',
      kind: 'decision',
      prior: 0.7,
      utility: 0.5
    }

    const coerced = coerceNode(backendNode)

    expect(coerced.data.prior).toBe(0.7)
    expect(coerced.data.utility).toBe(0.5)
  })

  it('should handle nodes with missing kind', () => {
    const backendNode: BackendNode = {
      id: 'n1',
      label: 'No Kind'
    }

    const coerced = coerceNode(backendNode)

    expect(coerced.type).toBe('factor') // Default fallback
    expect(coerced.data.unknownKind).toBeUndefined() // No flag if kind was absent
  })
})

describe('S1-MAP: coerceNodes batch processing', () => {
  it('should coerce multiple nodes with correct indices', () => {
    const backendNodes: BackendNode[] = [
      { id: 'n1', kind: 'goal' },
      { id: 'n2', kind: 'decision' },
      { id: 'n3', kind: 'outcome' }
    ]

    const coerced = coerceNodes(backendNodes)

    expect(coerced).toHaveLength(3)
    expect(coerced[0].type).toBe('goal')
    expect(coerced[1].type).toBe('decision')
    expect(coerced[2].type).toBe('outcome')
    expect(coerced[0].position).toEqual({ x: 200, y: 100 })
    expect(coerced[1].position).toEqual({ x: 450, y: 100 })
    expect(coerced[2].position).toEqual({ x: 700, y: 100 })
  })

  it('should handle empty array', () => {
    const coerced = coerceNodes([])
    expect(coerced).toHaveLength(0)
  })
})

describe('S1-UNK: getUnknownKindWarning', () => {
  it('should generate user-friendly warning', () => {
    const warning = getUnknownKindWarning('custom-type')
    expect(warning).toContain('Unknown node type')
    expect(warning).toContain('custom-type')
    expect(warning).toContain('generic node')
  })
})

describe('S1-FIXTURES: Real Backend Graph Scenarios', () => {
  it('should map realistic backend graph with mixed kinds', () => {
    const backendGraph: BackendNode[] = [
      { id: '1', label: 'Maximize ROI', kind: 'goal', position: { x: 400, y: 50 } },
      { id: '2', label: 'Choose Strategy', kind: 'decision_node', position: { x: 400, y: 200 } },
      { id: '3', label: 'Aggressive', kind: 'option', position: { x: 200, y: 350 } },
      { id: '4', label: 'Conservative', kind: 'option', position: { x: 600, y: 350 } },
      { id: '5', label: 'Market Volatility', kind: 'factor_node', position: { x: 100, y: 500 } },
      { id: '6', label: 'High Return', kind: 'outcome-terminal', position: { x: 200, y: 650 } },
      { id: '7', label: 'Stable Return', kind: 'outcome', position: { x: 600, y: 650 } }
    ]

    const coerced = coerceNodes(backendGraph)

    expect(coerced).toHaveLength(7)
    expect(coerced[0].type).toBe('goal')
    expect(coerced[1].type).toBe('decision') // decision_node → decision
    expect(coerced[2].type).toBe('option')
    expect(coerced[3].type).toBe('option')
    expect(coerced[4].type).toBe('factor') // factor_node → factor
    expect(coerced[5].type).toBe('outcome') // outcome-terminal → outcome
    expect(coerced[6].type).toBe('outcome')

    // All should have valid positions
    coerced.forEach(node => {
      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
    })

    // None should be flagged as unknown
    coerced.forEach(node => {
      expect(node.data.unknownKind).toBeUndefined()
    })
  })

  it('should handle backend graph with unknown kinds gracefully', () => {
    const backendGraph: BackendNode[] = [
      { id: '1', label: 'Known Node', kind: 'decision' },
      { id: '2', label: 'Unknown Node 1', kind: 'custom-type' },
      { id: '3', label: 'Unknown Node 2', kind: 'experimental_node' },
      { id: '4', label: 'Another Known', kind: 'outcome' }
    ]

    const coerced = coerceNodes(backendGraph)

    expect(coerced).toHaveLength(4)
    expect(coerced[0].type).toBe('decision')
    expect(coerced[0].data.unknownKind).toBeUndefined()

    expect(coerced[1].type).toBe('factor') // Fallback
    expect(coerced[1].data.unknownKind).toBe(true)
    expect(coerced[1].data.originalKind).toBe('custom-type')

    expect(coerced[2].type).toBe('factor') // Fallback
    expect(coerced[2].data.unknownKind).toBe(true)
    expect(coerced[2].data.originalKind).toBe('experimental_node')

    expect(coerced[3].type).toBe('outcome')
    expect(coerced[3].data.unknownKind).toBeUndefined()
  })

  it('should preserve all node data during coercion', () => {
    const backendGraph: BackendNode[] = [
      {
        id: 'n1',
        label: 'Complex Node',
        kind: 'decision',
        body: 'Detailed description here',
        position: { x: 300, y: 400 },
        prior: 0.6,
        utility: 0.8,
        customField: 'preserved',
        metadata: { source: 'template' }
      }
    ]

    const coerced = coerceNodes(backendGraph)

    expect(coerced[0].id).toBe('n1')
    expect(coerced[0].data.label).toBe('Complex Node')
    expect(coerced[0].data.body).toBe('Detailed description here')
    expect(coerced[0].data.prior).toBe(0.6)
    expect(coerced[0].data.utility).toBe(0.8)
    expect(coerced[0].position).toEqual({ x: 300, y: 400 })
  })
})
