/**
 * Graph Hash Utility Tests
 *
 * Tests for graph hashing functions used for deduplication
 */
import { describe, it, expect } from 'vitest'
import { generateGraphHash, generateStructuralHash } from '../graphHash'
import type { Node, Edge } from '@xyflow/react'

const baseNodes: Node[] = [
  { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal A' } },
  { id: 'n2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision B' } },
]

const baseEdges: Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
]

describe('generateGraphHash', () => {
  it('generates consistent hash for same graph', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)
    const hash2 = generateGraphHash(baseNodes, baseEdges)

    expect(hash1).toBe(hash2)
  })

  it('generates different hash when node added', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)

    const nodesWithExtra = [
      ...baseNodes,
      { id: 'n3', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Option C' } },
    ]
    const hash2 = generateGraphHash(nodesWithExtra, baseEdges)

    expect(hash1).not.toBe(hash2)
  })

  it('generates different hash when edge added', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)

    const nodesWithExtra = [
      ...baseNodes,
      { id: 'n3', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Option C' } },
    ]
    const edgesWithExtra: Edge[] = [
      ...baseEdges,
      { id: 'e2', source: 'n2', target: 'n3' },
    ]
    const hash2 = generateGraphHash(nodesWithExtra, edgesWithExtra)

    expect(hash1).not.toBe(hash2)
  })

  it('generates different hash when node label changes', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)

    const modifiedNodes = baseNodes.map(n =>
      n.id === 'n1' ? { ...n, data: { ...n.data, label: 'Modified Goal' } } : n
    )
    const hash2 = generateGraphHash(modifiedNodes, baseEdges)

    expect(hash1).not.toBe(hash2)
  })

  it('generates different hash when node type changes', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)

    const modifiedNodes = baseNodes.map(n =>
      n.id === 'n1' ? { ...n, type: 'risk' } : n
    )
    const hash2 = generateGraphHash(modifiedNodes, baseEdges)

    expect(hash1).not.toBe(hash2)
  })

  it('generates different hash when edge confidence changes', () => {
    const hash1 = generateGraphHash(baseNodes, baseEdges)

    const edgesWithConfidence: Edge[] = baseEdges.map(e => ({
      ...e,
      data: { confidence: 0.8 },
    }))
    const hash2 = generateGraphHash(baseNodes, edgesWithConfidence)

    expect(hash1).not.toBe(hash2)
  })

  it('is order-independent (sorted internally)', () => {
    const nodes1: Node[] = [
      { id: 'n2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'B' } },
      { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } },
    ]
    const nodes2: Node[] = [
      { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'n2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'B' } },
    ]

    const hash1 = generateGraphHash(nodes1, baseEdges)
    const hash2 = generateGraphHash(nodes2, baseEdges)

    expect(hash1).toBe(hash2)
  })

  it('handles empty graph', () => {
    const hash = generateGraphHash([], [])

    expect(hash).toBeTruthy()
    expect(typeof hash).toBe('string')
  })
})

describe('generateStructuralHash', () => {
  it('generates consistent hash for same structure', () => {
    const hash1 = generateStructuralHash(baseNodes, baseEdges)
    const hash2 = generateStructuralHash(baseNodes, baseEdges)

    expect(hash1).toBe(hash2)
  })

  it('ignores node data changes (only structural)', () => {
    const hash1 = generateStructuralHash(baseNodes, baseEdges)

    const modifiedNodes = baseNodes.map(n =>
      n.id === 'n1' ? { ...n, data: { ...n.data, label: 'Different Label' } } : n
    )
    const hash2 = generateStructuralHash(modifiedNodes, baseEdges)

    // Structural hash should be the same since IDs didn't change
    expect(hash1).toBe(hash2)
  })

  it('changes when node IDs change', () => {
    const hash1 = generateStructuralHash(baseNodes, baseEdges)

    const modifiedNodes: Node[] = [
      { id: 'n1_renamed', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal A' } },
      { id: 'n2', type: 'decision', position: { x: 100, y: 0 }, data: { label: 'Decision B' } },
    ]
    const hash2 = generateStructuralHash(modifiedNodes, baseEdges)

    expect(hash1).not.toBe(hash2)
  })

  it('changes when edge connections change', () => {
    const hash1 = generateStructuralHash(baseNodes, baseEdges)

    const modifiedEdges: Edge[] = [
      { id: 'e1', source: 'n2', target: 'n1' }, // Reversed direction
    ]
    const hash2 = generateStructuralHash(baseNodes, modifiedEdges)

    expect(hash1).not.toBe(hash2)
  })
})
