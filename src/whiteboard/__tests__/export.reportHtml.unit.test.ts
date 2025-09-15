// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildReportHtml } from '@/whiteboard/export/reportHtml'
import type { Graph } from '@/domain/graph'

describe('buildReportHtml (unit)', () => {
  it('produces deterministic HTML with ISO timestamp and counts', () => {
    const graph: Graph = {
      schemaVersion: 1,
      nodes: {
        o1: { id: 'o1', type: 'Outcome', title: 'Delight users' },
        a1: { id: 'a1', type: 'Action', title: 'Improve docs', krImpacts: [{ krId: 'kr', deltaP50: 0.3, confidence: 0.5 }] },
      },
      edges: {
        e1: { id: 'e1', from: 'a1', to: 'o1', kind: 'supports' },
      },
    }
    const html = buildReportHtml(graph, { decisionId: 'demo', decisionTitle: 'Demo Decision', now: 1700000000000 })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>Demo Decision</title>')
    expect(html).toContain('Generated 2023-11-14T22:13:20.000Z')
    expect(html).toMatch(/Scenario score: -?\d+%/)
    expect(html).toContain('Nodes: 2, Links: 1')
    // No control chars (allow tab/newline/carriage return)
    expect(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(html)).toBe(false)
  })
})
