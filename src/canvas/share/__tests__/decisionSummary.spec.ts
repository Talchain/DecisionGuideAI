import { describe, it, expect } from 'vitest'
import type { StoredRun } from '../../store/runHistory'
import type { ScenarioFraming } from '../../store/scenarios'
import { formatDecisionSummary } from '../decisionSummary'

function buildRun({
  id,
  ts,
  hash,
  p10 = 100,
  p50 = 200,
  p90 = 300,
  units = 'percent',
}: {
  id: string
  ts: number
  hash: string
  p10?: number | null
  p50?: number | null
  p90?: number | null
  units?: 'currency' | 'percent' | 'count'
}): StoredRun {
  const unitSymbol = units === 'currency' ? '$' : undefined

  return {
    id,
    ts,
    seed: 1,
    hash,
    adapter: 'mock',
    summary: 'Mock summary',
    graphHash: `graph-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed: 1, response_id: `response-${id}`, elapsed_ms: 500 },
      model_card: { response_hash: hash, response_hash_algo: 'sha256', normalized: true },
      results: {
        conservative: p10 ?? undefined,
        likely: p50 ?? undefined,
        optimistic: p90 ?? undefined,
        units,
        unitSymbol,
      },
      confidence: { level: 'medium', why: 'Mock run' },
      drivers: [],
      run: {
        responseHash: hash,
        bands: { p10, p50, p90 },
      },
    },
  }
}

function buildLegacyRun({
  id,
  ts,
  hash,
  p10 = 100,
  p50 = 200,
  p90 = 300,
  units = 'percent',
}: {
  id: string
  ts: number
  hash: string
  p10?: number
  p50?: number
  p90?: number
  units?: 'currency' | 'percent' | 'count'
}): StoredRun {
  const unitSymbol = units === 'currency' ? '$' : undefined

  return {
    id,
    ts,
    seed: 1,
    hash,
    adapter: 'mock',
    summary: 'Mock summary',
    graphHash: `graph-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed: 1, response_id: `response-${id}`, elapsed_ms: 500 },
      model_card: { response_hash: hash, response_hash_algo: 'sha256', normalized: true },
      results: {
        conservative: p10,
        likely: p50,
        optimistic: p90,
        units,
        unitSymbol,
      },
      confidence: { level: 'medium', why: 'Mock run' },
      drivers: [],
    },
  }
}

describe('formatDecisionSummary', () => {
  it('includes framing, last run metadata, and canonical bands when available', () => {
    const framing: ScenarioFraming = {
      title: 'Choose pricing strategy',
      goal: 'Maximise revenue while maintaining market share',
      timeline: 'Next 2 quarters',
    }

    const run = buildRun({
      id: 'run-1',
      ts: Date.parse('2025-11-18T10:00:00.000Z'),
      hash: 'aaaa1111aaaa1111',
      p10: 100,
      p50: 200,
      p90: 300,
      units: 'percent',
    })

    const summary = formatDecisionSummary({
      framing,
      lastResultHash: 'aaaa1111aaaa1111',
      lastRunAt: '2025-11-18T10:00:00.000Z',
      lastRunSeed: '42',
      lastRun: run,
    })

    expect(summary).toContain('Decision: Choose pricing strategy')
    expect(summary).toContain('Goal: Maximise revenue while maintaining market share')
    expect(summary).toContain('Time horizon: Next 2 quarters')

    expect(summary).toContain('2025-11-18 10:00')
    expect(summary).toContain('seed 42')
    expect(summary).toContain('run aaaa1111…')
    expect(summary).not.toContain('aaaa1111aaaa1111')

    expect(summary).toContain('Most likely outcome: 200.0% (p10: 100.0%, p90: 300.0%)')
  })

  it('falls back to legacy results when canonical bands are absent', () => {
    const run = buildLegacyRun({
      id: 'run-legacy',
      ts: Date.parse('2025-11-18T11:00:00.000Z'),
      hash: 'bbbb2222bbbb2222',
      p10: 10,
      p50: 20,
      p90: 30,
      units: 'percent',
    })

    const summary = formatDecisionSummary({
      framing: null,
      lastResultHash: 'bbbb2222bbbb2222',
      lastRunAt: '2025-11-18T11:00:00.000Z',
      lastRunSeed: '7',
      lastRun: run,
    })

    expect(summary).toContain('2025-11-18 11:00')
    expect(summary).toContain('run bbbb2222…')
    expect(summary).toContain('Most likely outcome: 20.0% (p10: 10.0%, p90: 30.0%)')
  })

  it('handles missing last run by explaining that the decision has not been analysed', () => {
    const framing: ScenarioFraming = {
      title: 'Launch new product',
    }

    const summary = formatDecisionSummary({
      framing,
      lastResultHash: null,
      lastRunAt: null,
      lastRunSeed: null,
      lastRun: null,
    })

    expect(summary).toContain('Decision: Launch new product')
    expect(summary).toContain('This decision has not yet been analysed.')
  })

  it('handles fully missing context by stating that the decision has not been framed or analysed', () => {
    const summary = formatDecisionSummary({
      framing: null,
      lastResultHash: null,
      lastRunAt: null,
      lastRunSeed: null,
      lastRun: null,
    })

    expect(summary).toBe('This decision has not yet been framed or analysed.')
  })

  it('uses placeholders for null canonical bands and avoids fabricating values', () => {
    const run = buildRun({
      id: 'run-null',
      ts: Date.parse('2025-11-18T12:00:00.000Z'),
      hash: 'cccc3333cccc3333',
      p10: null,
      p50: null,
      p90: 300,
      units: 'percent',
    })

    const summary = formatDecisionSummary({
      framing: null,
      lastResultHash: 'cccc3333cccc3333',
      lastRunAt: '2025-11-18T12:00:00.000Z',
      lastRunSeed: '99',
      lastRun: run,
    })

    expect(summary).toContain('Most likely outcome: — (p10: —, p90: 300.0%)')
    expect(summary).not.toContain('null')
  })
})
