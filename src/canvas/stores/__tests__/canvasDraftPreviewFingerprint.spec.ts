import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { canvasDraftPreviewFingerprint } from '../draftStore'

function graph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Grow', kind: 'option' } },
      { id: 'goal', type: 'goal', position: { x: 100, y: 0 }, data: { label: 'Revenue', kind: 'goal' } },
      { id: 'factor', position: { x: 50, y: 50 }, data: { label: 'Demand', kind: 'factor' } },
    ],
    edges: [
      { id: 'e_a', source: 'opt_a', target: 'factor', data: { weight: 0.4, direction: 'positive' } },
      { id: 'e_b', source: 'factor', target: 'goal', data: { weight: 0.7, strengthStd: 0.1 } },
    ],
  }
}

describe('canvasDraftPreviewFingerprint', () => {
  it('is independent of node and edge order without mutating the inputs', () => {
    const { nodes, edges } = graph()
    const before = JSON.stringify({ nodes, edges })
    expect(canvasDraftPreviewFingerprint(nodes, edges)).toBe(
      canvasDraftPreviewFingerprint([...nodes].reverse(), [...edges].reverse()),
    )
    expect(JSON.stringify({ nodes, edges })).toBe(before)
  })

  it('changes when the canvas data label changes', () => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    nodes[0] = { ...nodes[0], data: { ...nodes[0].data, label: 'User rename' } }
    expect(canvasDraftPreviewFingerprint(nodes, edges)).not.toBe(before)
  })

  it('changes when a top-level label changes', () => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    nodes[0] = { ...nodes[0], label: 'Imported rename' } as Node
    expect(canvasDraftPreviewFingerprint(nodes, edges)).not.toBe(before)
  })

  it.each([
    ['weight', 0.9],
    ['direction', 'negative'],
    ['strength_mean', -0.4],
    ['strengthStd', 0.2],
    ['beliefStrength', 0.8],
    ['serverStrength', { mean: 0.4, effect_direction: 'positive' }],
  ])('changes when the stored edge %s changes', (field, value) => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    edges[0] = { ...edges[0], data: { ...edges[0].data, [field as string]: value } }
    expect(canvasDraftPreviewFingerprint(nodes, edges)).not.toBe(before)
  })

  it('changes when a node is added', () => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    nodes.push({ id: 'new', type: 'factor', position: { x: 0, y: 100 }, data: { label: 'New factor' } })
    expect(canvasDraftPreviewFingerprint(nodes, edges)).not.toBe(before)
  })

  it('changes when a stored node kind changes', () => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    nodes[2] = { ...nodes[2], data: { ...nodes[2].data, kind: 'risk' } }
    expect(canvasDraftPreviewFingerprint(nodes, edges)).not.toBe(before)
  })

  it('ignores position and selection changes', () => {
    const { nodes, edges } = graph()
    const before = canvasDraftPreviewFingerprint(nodes, edges)
    nodes[0] = { ...nodes[0], position: { x: 250, y: 500 }, selected: true }
    expect(canvasDraftPreviewFingerprint(nodes, edges)).toBe(before)
  })
})
