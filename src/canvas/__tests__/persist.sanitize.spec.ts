import { describe, it, expect, beforeEach } from 'vitest'
import { saveState, loadState } from '../persist'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

describe('persist - sanitization', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('deepSanitize', () => {
    it('removes React internals (__reactFiber$, __reactProps$)', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            __reactFiber$abc123: { /* React fiber */ },
            __reactProps$xyz789: { /* React props */ }
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data).toHaveProperty('label')
      expect(loaded?.nodes[0].data).not.toHaveProperty('__reactFiber$abc123')
      expect(loaded?.nodes[0].data).not.toHaveProperty('__reactProps$xyz789')
    })

    it('removes ReactFlow internals (measured, resizing, dragging, internals, handleBounds, isParent)', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          measured: { width: 100, height: 50 } as any,
          resizing: true as any,
          dragging: true as any,
          handleBounds: {} as any,
          isParent: false as any,
          data: {
            label: 'Test',
            internals: { /* ReactFlow internals */ }
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0]).not.toHaveProperty('measured')
      expect(loaded?.nodes[0]).not.toHaveProperty('resizing')
      expect(loaded?.nodes[0]).not.toHaveProperty('dragging')
      expect(loaded?.nodes[0]).not.toHaveProperty('handleBounds')
      expect(loaded?.nodes[0]).not.toHaveProperty('isParent')
      expect(loaded?.nodes[0].data).not.toHaveProperty('internals')
    })

    it('removes functions', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            onClick: () => console.log('click'),
            handler: function() { /* handler */ }
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data).toHaveProperty('label')
      expect(loaded?.nodes[0].data).not.toHaveProperty('onClick')
      expect(loaded?.nodes[0].data).not.toHaveProperty('handler')
    })

    it('removes symbol-valued properties', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            symbolProp: Symbol('test') as any
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data).toHaveProperty('label')
      expect(loaded?.nodes[0].data).not.toHaveProperty('symbolProp')
    })

    it('removes DOM elements (objects with nodeType)', () => {
      const button = { nodeType: 1, tagName: 'BUTTON' } as any // Mock DOM element
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            domRef: button
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data).toHaveProperty('label')
      expect(loaded?.nodes[0].data).not.toHaveProperty('domRef')
    })

    it('recursively sanitizes nested objects', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            nested: {
              deep: {
                __reactFiber$: {},
                value: 'keep me'
              }
            }
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data.nested?.deep).toHaveProperty('value', 'keep me')
      expect(loaded?.nodes[0].data.nested?.deep).not.toHaveProperty('__reactFiber$')
    })

    it('sanitizes arrays recursively', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            items: [
              { id: 'a', __reactFiber$: {}, value: 1 },
              { id: 'b', measured: true, value: 2 }
            ]
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data.items).toHaveLength(2)
      expect(loaded?.nodes[0].data.items[0]).toHaveProperty('value', 1)
      expect(loaded?.nodes[0].data.items[0]).not.toHaveProperty('__reactFiber$')
      expect(loaded?.nodes[0].data.items[1]).toHaveProperty('value', 2)
      expect(loaded?.nodes[0].data.items[1]).not.toHaveProperty('measured')
    })

    it('preserves safe properties (label, kind, position, weight, belief, provenance)', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 100, y: 200 },
          data: {
            label: 'Test Node',
            kind: 'decision',
            extra: 'safe data'
          }
        }
      ]
      const edges: Edge<EdgeData>[] = [
        {
          id: 'e1',
          source: '1',
          target: '2',
          data: {
            weight: 0.75,
            belief: 0.85,
            provenance: 'template' as const,
            style: 'solid' as const,
            curvature: 0.15,
            kind: 'decision-probability' as const,
            schemaVersion: 3
          }
        }
      ]

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()

      // Node data preserved
      expect(loaded?.nodes[0].position).toEqual({ x: 100, y: 200 })
      expect(loaded?.nodes[0].data.label).toBe('Test Node')
      expect(loaded?.nodes[0].data.kind).toBe('decision')
      expect(loaded?.nodes[0].data.extra).toBe('safe data')

      // Edge data preserved
      expect(loaded?.edges[0].data?.weight).toBe(0.75)
      expect(loaded?.edges[0].data?.belief).toBe(0.85)
      expect(loaded?.edges[0].data?.provenance).toBe('template')
      expect(loaded?.edges[0].data?.style).toBe('solid')
      expect(loaded?.edges[0].data?.curvature).toBe(0.15)
    })

    it('handles null values correctly (undefined is stripped by JSON)', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            nullValue: null,
            undefinedValue: undefined,
            nested: {
              alsoNull: null
            }
          }
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      const loaded = loadState()
      expect(loaded).toBeDefined()
      expect(loaded?.nodes[0].data.nullValue).toBeNull()
      // undefined is stripped by JSON.stringify, so it won't be present
      expect(loaded?.nodes[0].data).not.toHaveProperty('undefinedValue')
      expect(loaded?.nodes[0].data.nested?.alsoNull).toBeNull()
    })

    it('never throws on circular references (safety test)', () => {
      const circular: any = { id: 'circular' }
      circular.self = circular // Create circular reference

      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          data: {
            label: 'Test',
            circular
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      // Should not throw, will just skip the circular property
      expect(() => saveState({ nodes, edges })).not.toThrow()
    })

    it('JSON-serializes successfully after sanitization', () => {
      const nodes: Node[] = [
        {
          id: '1',
          type: 'decision',
          position: { x: 0, y: 0 },
          __reactFiber$: {},
          data: {
            label: 'Test',
            onClick: () => {},
            domRef: { nodeType: 1 }
          } as any
        }
      ]
      const edges: Edge<EdgeData>[] = []

      const saved = saveState({ nodes, edges })
      expect(saved).toBe(true)

      // Should be able to load back without errors
      const loaded = loadState()
      expect(loaded).toBeDefined()

      // Should be JSON-serializable again
      expect(() => JSON.stringify(loaded)).not.toThrow()
    })
  })
})
