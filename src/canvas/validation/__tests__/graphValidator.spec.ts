/**
 * M4: Graph Validator Tests
 */

import { describe, it, expect } from 'vitest'
import { validateGraph } from '../graphValidator'
import type { Node, Edge } from '@xyflow/react'

describe('validateGraph (M4)', () => {
  it('returns healthy status for valid graph', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('healthy')
    expect(health.issues).toHaveLength(0)
    expect(health.score).toBe(100)
  })

  it('detects cycle in graph', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n1' }, // Creates cycle
    ]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('errors')
    expect(health.issues).toHaveLength(1)
    expect(health.issues[0].type).toBe('cycle')
    expect(health.issues[0].severity).toBe('error')
    expect(health.issues[0].message).toContain('Cycle detected')
  })

  it('detects dangling edge (missing source node)', () => {
    const nodes: Node[] = [
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('errors')
    const danglingIssue = health.issues.find((i) => i.type === 'dangling_edge')
    expect(danglingIssue).toBeDefined()
    expect(danglingIssue?.severity).toBe('error')
    expect(danglingIssue?.suggestedFix?.type).toBe('remove_edge')
  })

  it('detects orphan nodes (no connections)', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Orphan' }, position: { x: 200, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('warnings')
    const orphanIssue = health.issues.find((i) => i.type === 'orphan_node')
    expect(orphanIssue).toBeDefined()
    expect(orphanIssue?.severity).toBe('warning')
    expect(orphanIssue?.nodeIds).toContain('n3')
  })

  it('detects duplicate edges (same source and target)', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n2' }, // Duplicate
    ]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('warnings')
    const duplicateIssue = health.issues.find((i) => i.type === 'duplicate_edge')
    expect(duplicateIssue).toBeDefined()
    expect(duplicateIssue?.severity).toBe('warning')
    expect(duplicateIssue?.edgeIds).toHaveLength(2)
  })

  it('detects self-loops', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n1' }]

    const health = validateGraph(nodes, edges)

    expect(health.status).toBe('errors')
    const loopIssue = health.issues.find((i) => i.type === 'self_loop')
    expect(loopIssue).toBeDefined()
    expect(loopIssue?.severity).toBe('warning')
    expect(loopIssue?.suggestedFix?.type).toBe('remove_edge')
  })

  it('detects missing labels', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: '' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n2' }]

    const health = validateGraph(nodes, edges)

    const missingLabelIssue = health.issues.find((i) => i.type === 'missing_label')
    expect(missingLabelIssue).toBeDefined()
    expect(missingLabelIssue?.severity).toBe('info')
    expect(missingLabelIssue?.nodeIds).toContain('n1')
  })

  it('calculates health score based on issues', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: '' }, position: { x: 200, y: 0 } }, // Missing label (info)
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n2' }, // Duplicate (warning)
    ]

    const health = validateGraph(nodes, edges)

    // 2 warnings (orphan + duplicate) => -10 points
    expect(health.score).toBe(90)
  })

  it('detects multiple issues in same graph', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: '' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Orphan' }, position: { x: 200, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n1' }, // Self-loop
      { id: 'e2', source: 'n1', target: 'n2' },
      { id: 'e3', source: 'n1', target: 'n2' }, // Duplicate
    ]

    const health = validateGraph(nodes, edges)

    expect(health.issues.length).toBeGreaterThan(2)
    // Mix of warnings and an implicit cycle error => overall status errors
    expect(health.status).toBe('errors')
  })

  it('provides suggested fix for each issue', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
    ]
    const edges: Edge[] = [{ id: 'e1', source: 'n1', target: 'n1' }]

    const health = validateGraph(nodes, edges)

    const loopIssue = health.issues.find((i) => i.type === 'self_loop')
    expect(loopIssue?.suggestedFix).toBeDefined()
    expect(loopIssue?.suggestedFix?.type).toBe('remove_edge')
    expect(loopIssue?.suggestedFix?.targetId).toBe('e1')
  })

  it('detects probability errors when edges do not sum to 100%', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Option A' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Option B' }, position: { x: 100, y: 100 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.3 } },
      { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.3 } },
      // Sum = 60%, not 100%
    ]

    const health = validateGraph(nodes, edges)

    const probIssue = health.issues.find((i) => i.type === 'probability_error')
    expect(probIssue).toBeDefined()
    expect(probIssue?.severity).toBe('error')
    expect(probIssue?.message).toContain('60%')
    expect(probIssue?.suggestedFix?.type).toBe('normalize_probabilities')
  })

  it('detects single-edge probability errors (incomplete branch)', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Option Node' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Outcome' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.6 } },
      // Single edge with 60% - where does the other 40% go?
    ]

    const health = validateGraph(nodes, edges)

    const probIssue = health.issues.find((i) => i.type === 'probability_error')
    expect(probIssue).toBeDefined()
    expect(probIssue?.severity).toBe('error')
    expect(probIssue?.message).toContain('incomplete probability')
    expect(probIssue?.message).toContain('60%')
    expect(probIssue?.suggestedFix?.type).toBe('normalize_probabilities')
  })

  it('allows single-edge with 100% probability (valid)', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Option Node' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Outcome' }, position: { x: 100, y: 0 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 1.0 } },
    ]

    const health = validateGraph(nodes, edges)

    const probIssue = health.issues.find((i) => i.type === 'probability_error')
    expect(probIssue).toBeUndefined()
    expect(health.status).toBe('healthy')
  })

  it('skips probability validation for pristine edges (no confidence set)', () => {
    const nodes: Node[] = [
      { id: 'n1', data: { label: 'Node 1' }, position: { x: 0, y: 0 } },
      { id: 'n2', data: { label: 'Node 2' }, position: { x: 100, y: 0 } },
      { id: 'n3', data: { label: 'Node 3' }, position: { x: 100, y: 100 } },
    ]
    const edges: Edge[] = [
      { id: 'e1', source: 'n1', target: 'n2', data: {} }, // No confidence
      { id: 'e2', source: 'n1', target: 'n3', data: {} }, // No confidence
    ]

    const health = validateGraph(nodes, edges)

    const probIssue = health.issues.find((i) => i.type === 'probability_error')
    expect(probIssue).toBeUndefined()
  })
})
