/**
 * Tests for resolveElementLabel -- node/edge label resolution for direct_edit events.
 */

import { describe, it, expect } from 'vitest'
import { resolveElementLabel } from '../resolveElementLabel'
import type { Node, Edge } from '@xyflow/react'

const NODES: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
  { id: 'n2', position: { x: 0, y: 0 }, data: { label: 'Market size' } },
  { id: 'n3', position: { x: 0, y: 0 }, data: {} },
]

const EDGES: Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n1', target: 'n3' },
]

describe('resolveElementLabel', () => {
  it('returns node label when target is a node', () => {
    expect(resolveElementLabel('n1', NODES, EDGES)).toBe('Revenue')
  })

  it('returns edge label as "Source -> Target" when both labels exist', () => {
    expect(resolveElementLabel('e1', NODES, EDGES)).toBe('Revenue -> Market size')
  })

  it('returns undefined for edge when target node has no label', () => {
    expect(resolveElementLabel('e2', NODES, EDGES)).toBeUndefined()
  })

  it('returns undefined when element not found', () => {
    expect(resolveElementLabel('unknown', NODES, EDGES)).toBeUndefined()
  })

  it('returns undefined for node with no label', () => {
    expect(resolveElementLabel('n3', NODES, EDGES)).toBeUndefined()
  })

  it('returns undefined for empty arrays', () => {
    expect(resolveElementLabel('n1', [], [])).toBeUndefined()
  })
})
