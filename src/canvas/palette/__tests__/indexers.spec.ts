/**
 * Command Palette Indexers Tests
 *
 * Tests for pure indexing and search functions.
 * Performance target: ≤75ms P95 on 1k items
 */

import { describe, it, expect } from 'vitest'
import {
  indexNodes,
  indexEdges,
  indexDrivers,
  indexTemplates,
  indexRuns,
  indexActions,
  searchItems,
  groupResultsByKind,
  type PaletteItem,
} from '../indexers'

describe('Command Palette Indexers', () => {
  describe('indexNodes', () => {
    it('indexes nodes with sanitized labels', () => {
      const nodes = [
        { id: 'n1', data: { label: 'Risk Node' } },
        { id: 'n2', data: { label: 'Decision <script>alert(1)</script>' } },
        { id: 'n3', data: {} },
      ]

      const items = indexNodes(nodes)

      expect(items).toHaveLength(3)
      expect(items[0]).toMatchObject({
        id: 'node:n1',
        kind: 'node',
        label: 'Risk Node',
        description: 'Node • n1',
      })

      // Should sanitize HTML
      expect(items[1].label).not.toContain('<script>')
      expect(items[1].label).not.toContain('alert')

      // Should use ID when no label
      expect(items[2].label).toBe('n3')
    })

    it('includes node metadata', () => {
      const nodes = [{ id: 'test-node', data: { label: 'Test' } }]
      const items = indexNodes(nodes)

      expect(items[0].metadata?.nodeId).toBe('test-node')
      expect(items[0].keywords).toContain('node')
    })
  })

  describe('indexEdges', () => {
    it('indexes edges with source → target labels', () => {
      const edges = [
        { id: 'e1', source: 'n1', target: 'n2', data: { label: 'causes' } },
        { id: 'e2', source: 'n2', target: 'n3' },
      ]

      const items = indexEdges(edges)

      expect(items).toHaveLength(2)
      expect(items[0].label).toBe('causes')
      expect(items[0].description).toBe('Edge • n1 → n2')

      // Should generate label from source → target when missing
      expect(items[1].label).toBe('n2 → n3')
    })

    it('includes edge metadata', () => {
      const edges = [{ id: 'e1', source: 'a', target: 'b', data: { label: 'test' } }]
      const items = indexEdges(edges)

      expect(items[0].metadata).toMatchObject({
        edgeId: 'e1',
        source: 'a',
        target: 'b',
      })
    })
  })

  describe('indexDrivers', () => {
    it('indexes drivers with polarity and strength', () => {
      const drivers = [
        { label: 'Market Risk', polarity: 'up', strength: 'high', node_id: 'n1' },
        { label: 'Cost Savings', polarity: 'down', strength: 'medium', edge_id: 'e1' },
      ]

      const items = indexDrivers(drivers)

      expect(items).toHaveLength(2)
      expect(items[0].kind).toBe('driver')
      expect(items[0].description).toContain('up')
      expect(items[0].description).toContain('high')
      expect(items[0].keywords).toContain('up')
      expect(items[0].metadata?.nodeId).toBe('n1')
    })

    it('sanitizes driver labels', () => {
      const drivers = [{ label: '<b>Bold Label</b>', polarity: 'neutral', strength: 'low' }]
      const items = indexDrivers(drivers)

      expect(items[0].label).not.toContain('<b>')
      expect(items[0].label).not.toContain('</b>')
    })
  })

  describe('indexTemplates', () => {
    it('indexes templates with tags', () => {
      const templates = [
        { id: 't1', title: 'Pricing Decision', tags: ['pricing', 'revenue'] },
        { id: 't2', title: 'Feature Launch' },
      ]

      const items = indexTemplates(templates)

      expect(items).toHaveLength(2)
      expect(items[0].kind).toBe('template')
      expect(items[0].description).toContain('pricing')
      expect(items[0].keywords).toContain('pricing')
      expect(items[1].description).not.toContain('•')
    })
  })

  describe('indexRuns', () => {
    it('indexes runs with seed and hash', () => {
      const runs = [
        { id: 'r1', seed: 42, hash: 'abc123def456', timestamp: Date.now() },
        { id: 'r2', timestamp: Date.now() - 1000 },
      ]

      const items = indexRuns(runs)

      expect(items).toHaveLength(2)
      expect(items[0].label).toContain('seed=42')
      expect(items[0].description).toContain('abc123def456')
      expect(items[1].label).toContain('r2')
    })
  })

  describe('indexActions', () => {
    it('shows Run action when not streaming', () => {
      const items = indexActions(false)

      expect(items.length).toBeGreaterThan(0)
      expect(items.every(item => item.kind === 'action')).toBe(true)

      // Should have Run action
      const runAction = items.find(a => a.id === 'action:run')
      expect(runAction).toBeDefined()
      expect(runAction?.keywords).toContain('run')

      // Should NOT have Cancel action
      const cancelAction = items.find(a => a.id === 'action:cancel')
      expect(cancelAction).toBeUndefined()

      // Should always have panel toggles
      expect(items.find(a => a.id === 'action:results')).toBeDefined()
    })

    it('shows Cancel action when streaming', () => {
      const items = indexActions(true)

      expect(items.length).toBeGreaterThan(0)
      expect(items.every(item => item.kind === 'action')).toBe(true)

      // Should have Cancel action
      const cancelAction = items.find(a => a.id === 'action:cancel')
      expect(cancelAction).toBeDefined()
      expect(cancelAction?.keywords).toContain('cancel')

      // Should NOT have Run action
      const runAction = items.find(a => a.id === 'action:run')
      expect(runAction).toBeUndefined()

      // Should always have panel toggles
      expect(items.find(a => a.id === 'action:results')).toBeDefined()
    })
  })

  describe('searchItems', () => {
    const testItems: PaletteItem[] = [
      { id: 'n1', kind: 'node', label: 'Risk Assessment' },
      { id: 'n2', kind: 'node', label: 'Risk Node', keywords: ['important'] },
      { id: 'a1', kind: 'action', label: 'Run Analysis' },
      { id: 'e1', kind: 'edge', label: 'causes' },
    ]

    it('returns all items when query is empty', () => {
      const results = searchItems('', testItems, 20)
      expect(results).toHaveLength(4)
    })

    it('finds exact matches', () => {
      const results = searchItems('causes', testItems, 20)
      expect(results).toHaveLength(1)
      expect(results[0].matchType).toBe('exact')
      expect(results[0].label).toBe('causes')
    })

    it('finds prefix matches', () => {
      const results = searchItems('Risk', testItems, 20)
      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results[0].matchType).toBe('prefix')
    })

    it('ranks exact > prefix > fuzzy', () => {
      const items: PaletteItem[] = [
        { id: 'a', kind: 'node', label: 'risk' },         // exact
        { id: 'b', kind: 'node', label: 'risky business' }, // prefix
        { id: 'c', kind: 'node', label: 'r i s k' },     // fuzzy
      ]

      const results = searchItems('risk', items, 20)

      expect(results[0].label).toBe('risk')
      expect(results[0].matchType).toBe('exact')
      expect(results[1].label).toBe('risky business')
      expect(results[1].matchType).toBe('prefix')
    })

    it('searches keywords', () => {
      const results = searchItems('important', testItems, 20)
      expect(results.length).toBeGreaterThan(0)
      const riskNode = results.find(r => r.id === 'n2')
      expect(riskNode).toBeDefined()
    })

    it('is case-insensitive', () => {
      const results = searchItems('RISK', testItems, 20)
      expect(results.length).toBeGreaterThan(0)
    })

    it('respects limit parameter', () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        id: `n${i}`,
        kind: 'node' as const,
        label: `Node ${i}`,
      }))

      const results = searchItems('node', manyItems, 10)
      expect(results).toHaveLength(10)
    })

    it('handles fuzzy matches', () => {
      const items: PaletteItem[] = [
        { id: 'n1', kind: 'node', label: 'React Flow Graph' },
      ]

      const results = searchItems('rfg', items, 20)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].matchType).toBe('fuzzy')
    })

    it('returns empty array for non-matching query', () => {
      const results = searchItems('nonexistent', testItems, 20)
      expect(results).toHaveLength(0)
    })

    it('handles word boundary prefix matches', () => {
      const items: PaletteItem[] = [
        { id: 'n1', kind: 'node', label: 'Risk Factor Analysis' },
      ]

      const results = searchItems('factor', items, 20)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].matchType).toBe('prefix')
    })
  })

  describe('groupResultsByKind', () => {
    it('groups results by kind', () => {
      const results = [
        { id: 'n1', kind: 'node' as const, label: 'Node 1', score: 100, matchType: 'exact' as const },
        { id: 'a1', kind: 'action' as const, label: 'Action 1', score: 90, matchType: 'prefix' as const },
        { id: 'n2', kind: 'node' as const, label: 'Node 2', score: 80, matchType: 'fuzzy' as const },
      ]

      const grouped = groupResultsByKind(results)

      expect(grouped.node).toHaveLength(2)
      expect(grouped.action).toHaveLength(1)
      expect(grouped.edge).toHaveLength(0)
    })

    it('returns empty arrays for unused kinds', () => {
      const results = [
        { id: 'n1', kind: 'node' as const, label: 'Node', score: 100, matchType: 'exact' as const },
      ]

      const grouped = groupResultsByKind(results)

      expect(grouped.edge).toEqual([])
      expect(grouped.template).toEqual([])
      expect(grouped.driver).toEqual([])
    })
  })

  describe('Performance', () => {
    it('searches 1000 items in <75ms', () => {
      const items: PaletteItem[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `item${i}`,
        kind: 'node',
        label: `Node ${i} with some text`,
        description: `Description for node ${i}`,
        keywords: ['test', 'node', `keyword${i}`],
      }))

      const start = performance.now()
      const results = searchItems('node', items, 20)
      const duration = performance.now() - start

      expect(results).toHaveLength(20)
      expect(duration).toBeLessThan(75)
    })

    it('handles empty search efficiently', () => {
      const items: PaletteItem[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `item${i}`,
        kind: 'node',
        label: `Node ${i}`,
      }))

      const start = performance.now()
      searchItems('', items, 20)
      const duration = performance.now() - start

      expect(duration).toBeLessThan(10) // Should be very fast
    })
  })

  describe('Sanitization', () => {
    it('sanitizes all indexed labels', () => {
      const dangerousNodes = [
        { id: 'n1', data: { label: '<script>alert(1)</script>' } },
        { id: 'n2', data: { label: 'Normal <b>bold</b> text' } },
      ]

      const items = indexNodes(dangerousNodes)

      items.forEach(item => {
        expect(item.label).not.toMatch(/<script/i)
        expect(item.label).not.toMatch(/<b>/i)
        expect(item.label).not.toMatch(/<\/b>/i)
      })
    })

    it('enforces max length on labels', () => {
      const longLabel = 'a'.repeat(500)
      const nodes = [{ id: 'n1', data: { label: longLabel } }]
      const items = indexNodes(nodes)

      expect(items[0].label.length).toBeLessThanOrEqual(200) // From sanitizeLabel max
    })
  })
})
