// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildReportMarkdown } from '@/whiteboard/export/reportMarkdown'
import type { Graph } from '@/domain/graph'

describe('buildReportMarkdown (unit)', () => {
  it('produces deterministic markdown with counts and score', () => {
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
    const md = buildReportMarkdown(graph, { decisionId: 'demo', decisionTitle: 'Demo Decision', now: 1700000000000 })
    expect(md).toContain('# Demo Decision')
    expect(md).toContain('Generated 2023-11-14T22:13:20.000Z') // ISO from fixed ts
    expect(md).toMatch(/Scenario score: -?\d+%/)
    expect(md).toContain('Nodes: 2, Links: 1')
    // No control chars (allow tab/newline/carriage return)
    expect(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(md)).toBe(false)
  })
})
