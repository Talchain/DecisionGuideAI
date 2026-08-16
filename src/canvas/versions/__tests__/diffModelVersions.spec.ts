/**
 * The canonical diff authority — behaviour pinned.
 *
 * BINDING ASSERTION STYLE (CLAUDE.md trap #19): every assertion binds to its
 * object by IDENTITY (node/edge id, field name), never by a value predicate
 * another object could satisfy. Fixtures therefore deliberately contain
 * SEVERAL elements sharing a label and several sharing a value, so a diff that
 * paired by label or by value would resolve the wrong object and RED here.
 */

import { describe, it, expect } from 'vitest'
import { diffModelVersions } from '../diffModelVersions'
import type { ModelVersion, VersionedNode, VersionedEdge } from '../types'

function node(
  id: string,
  label: string,
  fields: Record<string, string | number | boolean | null> = {},
  kind = 'factor',
): VersionedNode {
  return { id, kind, label, fields }
}

function edge(
  id: string,
  from: string,
  to: string,
  fields: Record<string, string | number | boolean | null> = {},
  label?: string,
): VersionedEdge {
  return { id, from, to, label, fields }
}

function version(
  id: string,
  nodes: VersionedNode[],
  edges: VersionedEdge[],
  createdAt = 1_000,
): ModelVersion {
  return { id, name: `version ${id}`, createdAt, origin: 'manual', nodes, edges }
}

describe('diffModelVersions', () => {
  it('reports no changes between a version and itself', () => {
    const v = version('a', [node('n1', 'Price', { value: 0.5 })], [edge('e1', 'n1', 'n2')])

    const cs = diffModelVersions(v, v)

    expect(cs.isEmpty).toBe(true)
    expect(cs.addedNodes).toHaveLength(0)
    expect(cs.removedNodes).toHaveLength(0)
    expect(cs.modifiedNodes).toHaveLength(0)
    expect(cs.addedEdges).toHaveLength(0)
    expect(cs.removedEdges).toHaveLength(0)
    expect(cs.modifiedEdges).toHaveLength(0)
  })

  it('carries both version refs so a caption can name what was compared', () => {
    const a: ModelVersion = {
      id: 'va',
      name: 'Before the board review',
      createdAt: 111,
      origin: 'manual',
      nodes: [],
      edges: [],
    }
    const b: ModelVersion = {
      id: 'vb',
      name: 'After the board review',
      createdAt: 222,
      origin: 'manual',
      nodes: [],
      edges: [],
    }

    const cs = diffModelVersions(a, b)

    expect(cs.from).toEqual({ id: 'va', name: 'Before the board review', createdAt: 111 })
    expect(cs.to).toEqual({ id: 'vb', name: 'After the board review', createdAt: 222 })
  })

  describe('node identity', () => {
    it('pairs nodes by id, not by label — a renamed node is MODIFIED, not add+remove', () => {
      const a = version('a', [node('n1', 'Price')], [])
      const b = version('b', [node('n1', 'Unit price')], [])

      const cs = diffModelVersions(a, b)

      expect(cs.addedNodes).toHaveLength(0)
      expect(cs.removedNodes).toHaveLength(0)
      expect(cs.modifiedNodes).toHaveLength(1)
      expect(cs.modifiedNodes[0]!.id).toBe('n1')
      expect(cs.modifiedNodes[0]!.fields).toEqual([
        { field: 'label', before: 'Price', after: 'Unit price' },
      ])
    })

    it('does NOT pair two distinct nodes that share a label', () => {
      // n1 and n2 both read "Cost" — a label-keyed diff would pair them and
      // report zero changes. Identity keeps them separate.
      const a = version('a', [node('n1', 'Cost', { value: 1 }), node('n2', 'Cost', { value: 2 })], [])
      const b = version('b', [node('n1', 'Cost', { value: 9 }), node('n2', 'Cost', { value: 2 })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes.map((n) => n.id)).toEqual(['n1'])
      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: 1, after: 9 }])
    })

    it('reports an added node by id', () => {
      const a = version('a', [node('n1', 'Price')], [])
      const b = version('b', [node('n1', 'Price'), node('n2', 'Volume')], [])

      const cs = diffModelVersions(a, b)

      expect(cs.addedNodes.map((n) => n.id)).toEqual(['n2'])
      expect(cs.removedNodes).toHaveLength(0)
      expect(cs.modifiedNodes).toHaveLength(0)
    })

    it('reports a removed node by id', () => {
      const a = version('a', [node('n1', 'Price'), node('n2', 'Volume')], [])
      const b = version('b', [node('n1', 'Price')], [])

      const cs = diffModelVersions(a, b)

      expect(cs.removedNodes.map((n) => n.id)).toEqual(['n2'])
      expect(cs.addedNodes).toHaveLength(0)
    })

    it('uses the LATER label and kind on a modified node', () => {
      const a = version('a', [node('n1', 'Price', { value: 1 }, 'factor')], [])
      const b = version('b', [node('n1', 'Unit price', { value: 2 }, 'outcome')], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.label).toBe('Unit price')
      expect(cs.modifiedNodes[0]!.kind).toBe('outcome')
    })
  })

  describe('field-level node changes', () => {
    it('reports only the fields that actually differ', () => {
      const a = version('a', [node('n1', 'Price', { value: 0.5, unit: '£', utility: 1 })], [])
      const b = version('b', [node('n1', 'Price', { value: 0.8, unit: '£', utility: 1 })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: 0.5, after: 0.8 }])
    })

    it('treats a field appearing as a change from null', () => {
      const a = version('a', [node('n1', 'Price', {})], [])
      const b = version('b', [node('n1', 'Price', { value: 0.8 })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: null, after: 0.8 }])
    })

    it('treats a field disappearing as a change to null', () => {
      const a = version('a', [node('n1', 'Price', { value: 0.8 })], [])
      const b = version('b', [node('n1', 'Price', {})], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: 0.8, after: null }])
    })

    it('does not confuse the number 0 with an absent field', () => {
      // 0 is falsy; a truthiness-based presence check would call this "absent"
      // and report no change at all.
      const a = version('a', [node('n1', 'Price', { value: 0 })], [])
      const b = version('b', [node('n1', 'Price', {})], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: 0, after: null }])
    })

    it('does not confuse the empty string with an absent field', () => {
      const a = version('a', [node('n1', 'Price', { unit: '' })], [])
      const b = version('b', [node('n1', 'Price', {})], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'unit', before: '', after: null }])
    })

    it('does not confuse false with an absent field', () => {
      const a = version('a', [node('n1', 'Price', { pinned: false })], [])
      const b = version('b', [node('n1', 'Price', {})], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'pinned', before: false, after: null }])
    })

    it('does not report a node whose fields are unchanged but reordered', () => {
      const a = version('a', [node('n1', 'Price', { value: 1, unit: '£' })], [])
      const b = version('b', [node('n1', 'Price', { unit: '£', value: 1 })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.isEmpty).toBe(true)
    })

    it('orders field changes deterministically by field name', () => {
      const a = version('a', [node('n1', 'Price', { zeta: 1, alpha: 1, mid: 1 })], [])
      const b = version('b', [node('n1', 'Price', { zeta: 2, alpha: 2, mid: 2 })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields.map((f) => f.field)).toEqual(['alpha', 'mid', 'zeta'])
    })

    it('distinguishes the number 1 from the string "1"', () => {
      const a = version('a', [node('n1', 'Price', { value: 1 })], [])
      const b = version('b', [node('n1', 'Price', { value: '1' })], [])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedNodes[0]!.fields).toEqual([{ field: 'value', before: 1, after: '1' }])
    })
  })

  describe('edge identity', () => {
    it('pairs edges by id and reports a re-pointed edge as modified', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2')])
      const b = version('b', [], [edge('e1', 'n1', 'n3')])

      const cs = diffModelVersions(a, b)

      expect(cs.addedEdges).toHaveLength(0)
      expect(cs.removedEdges).toHaveLength(0)
      expect(cs.modifiedEdges).toHaveLength(1)
      expect(cs.modifiedEdges[0]!.id).toBe('e1')
      expect(cs.modifiedEdges[0]!.fields).toEqual([{ field: 'to', before: 'n2', after: 'n3' }])
    })

    it('reports an added edge by id', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2')])
      const b = version('b', [], [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3')])

      const cs = diffModelVersions(a, b)

      expect(cs.addedEdges.map((e) => e.id)).toEqual(['e2'])
    })

    it('reports a removed edge by id', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2'), edge('e2', 'n2', 'n3')])
      const b = version('b', [], [edge('e1', 'n1', 'n2')])

      const cs = diffModelVersions(a, b)

      expect(cs.removedEdges.map((e) => e.id)).toEqual(['e2'])
    })

    it('does NOT pair two distinct edges that share the same endpoints', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2', { weight: 1 }), edge('e2', 'n1', 'n2', { weight: 2 })])
      const b = version('b', [], [edge('e1', 'n1', 'n2', { weight: 5 }), edge('e2', 'n1', 'n2', { weight: 2 })])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedEdges.map((e) => e.id)).toEqual(['e1'])
      expect(cs.modifiedEdges[0]!.fields).toEqual([{ field: 'weight', before: 1, after: 5 }])
    })

    it('reports an edge strength change field-level', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2', { weight: 0.5, beliefExists: 0.8 })])
      const b = version('b', [], [edge('e1', 'n1', 'n2', { weight: 0.9, beliefExists: 0.8 })])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedEdges[0]!.fields).toEqual([{ field: 'weight', before: 0.5, after: 0.9 }])
    })

    it('reports an edge label change and carries the later endpoints', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2', {}, 'drives')])
      const b = version('b', [], [edge('e1', 'n1', 'n2', {}, 'strongly drives')])

      const cs = diffModelVersions(a, b)

      expect(cs.modifiedEdges[0]!.label).toBe('strongly drives')
      expect(cs.modifiedEdges[0]!.from).toBe('n1')
      expect(cs.modifiedEdges[0]!.to).toBe('n2')
      expect(cs.modifiedEdges[0]!.fields).toEqual([
        { field: 'label', before: 'drives', after: 'strongly drives' },
      ])
    })
  })

  describe('determinism and ordering', () => {
    it('orders added/removed/modified collections by id', () => {
      const a = version('a', [node('n3', 'C'), node('n1', 'A')], [])
      const b = version('b', [node('n2', 'B'), node('n4', 'D'), node('n1', 'A')], [])

      const cs = diffModelVersions(a, b)

      expect(cs.addedNodes.map((n) => n.id)).toEqual(['n2', 'n4'])
      expect(cs.removedNodes.map((n) => n.id)).toEqual(['n3'])
    })

    it('is asymmetric — swapping the arguments swaps added and removed', () => {
      const a = version('a', [node('n1', 'Price')], [])
      const b = version('b', [node('n1', 'Price'), node('n2', 'Volume')], [])

      const forward = diffModelVersions(a, b)
      const backward = diffModelVersions(b, a)

      expect(forward.addedNodes.map((n) => n.id)).toEqual(['n2'])
      expect(backward.removedNodes.map((n) => n.id)).toEqual(['n2'])
      expect(backward.addedNodes).toHaveLength(0)
    })

    it('does not mutate either input version', () => {
      const a = version('a', [node('n1', 'Price', { value: 1 })], [edge('e1', 'n1', 'n2')])
      const b = version('b', [node('n1', 'Price', { value: 2 })], [])
      const snapshotA = JSON.stringify(a)
      const snapshotB = JSON.stringify(b)

      diffModelVersions(a, b)

      expect(JSON.stringify(a)).toBe(snapshotA)
      expect(JSON.stringify(b)).toBe(snapshotB)
    })
  })

  describe('isEmpty', () => {
    it('is false when only an edge changed', () => {
      const a = version('a', [], [edge('e1', 'n1', 'n2', { weight: 1 })])
      const b = version('b', [], [edge('e1', 'n1', 'n2', { weight: 2 })])

      expect(diffModelVersions(a, b).isEmpty).toBe(false)
    })

    it('is false when only a node was added', () => {
      const a = version('a', [], [])
      const b = version('b', [node('n1', 'Price')], [])

      expect(diffModelVersions(a, b).isEmpty).toBe(false)
    })

    it('is true for two structurally identical but distinct versions', () => {
      const a = version('a', [node('n1', 'Price', { value: 1 })], [edge('e1', 'n1', 'n2')])
      const b = version('b', [node('n1', 'Price', { value: 1 })], [edge('e1', 'n1', 'n2')], 9_999)

      expect(diffModelVersions(a, b).isEmpty).toBe(true)
    })
  })
})
