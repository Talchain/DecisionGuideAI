/**
 * N1: Export Brief Tests
 */

import { describe, it, expect } from 'vitest'
import { generateDecisionBriefHTML } from '../decisionBrief'
import type { StoredRun } from '../../store/runHistory'

describe('Decision Brief Export', () => {
  const mockRunA: Partial<StoredRun> = {
    id: 'a',
    seed: 1337,
    hash: 'hash-a',
    graphHash: 'graph-a',
    adapter: 'auto',
    summary: '',
    ts: Date.now(),
    report: {
      summary: {
        conservative: 10,
        likely: 50,
        optimistic: 90,
        units: 'days'
      }
    } as any,
    graph: {
      nodes: [],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5, belief: 0.6 } }] as any
    }
  }

  const mockRunB: Partial<StoredRun> = {
    id: 'b',
    seed: 1338,
    hash: 'hash-b',
    graphHash: 'graph-b',
    adapter: 'auto',
    summary: '',
    ts: Date.now(),
    report: {
      summary: {
        conservative: 15,
        likely: 55,
        optimistic: 95,
        units: 'days'
      }
    } as any,
    graph: {
      nodes: [],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.7, belief: 0.8 } }] as any
    }
  }

  it('generates HTML with both scenarios', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test Decision',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun
    })

    expect(html).toContain('Test Decision')
    expect(html).toContain('Run A')
    expect(html).toContain('Run B')
  })

  it('includes p10/p50/p90 for both runs', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun
    })

    expect(html).toContain('10.0 days') // p10 A
    expect(html).toContain('50.0 days') // p50 A
    expect(html).toContain('90.0 days') // p90 A
    expect(html).toContain('15.0 days') // p10 B
    expect(html).toContain('55.0 days') // p50 B
  })

  it('includes edge diffs table', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun
    })

    expect(html).toContain('Top 5 Edge Differences')
    expect(html).toContain('n1')
    expect(html).toContain('n2')
  })

  it('includes rationale when provided', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun,
      rationale: 'This is our reasoning'
    })

    expect(html).toContain('Decision Rationale')
    expect(html).toContain('This is our reasoning')
  })

  it('includes seed and response hashes', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun
    })

    expect(html).toContain('1337') // seed A
    expect(html).toContain('1338') // seed B
    expect(html).toContain('hash-a')
    expect(html).toContain('hash-b')
  })

  it('includes print CSS', () => {
    const html = generateDecisionBriefHTML({
      title: 'Test',
      runA: mockRunA as StoredRun,
      runB: mockRunB as StoredRun
    })

    expect(html).toContain('@media print')
    expect(html).toContain('@page')
  })
})
