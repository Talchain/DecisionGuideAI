// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { templates } from '@/sandbox/templates'
import { normalizeGraph, countEntities } from '@/sandbox/state/graphIO'

describe('templates load/normalize', () => {
  it('each template normalizes and has non-zero counts', () => {
    expect(Array.isArray(templates)).toBe(true)
    expect(templates.length).toBeGreaterThan(0)
    for (const t of templates) {
      const g = normalizeGraph({ graph: t.graph })
      const { nodeCount, edgeCount } = countEntities(g)
      expect(nodeCount).toBeGreaterThan(0)
      expect(edgeCount).toBeGreaterThanOrEqual(0)
    }
  })
})
