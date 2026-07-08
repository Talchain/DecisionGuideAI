// AnalysisContext honesty rules (UI-SEM-071/072/076) — each rule pinned.

import { describe, it, expect } from 'vitest'
import { buildAnalysisContext } from '../analysisContext'

const optionNodes = [
  { id: 'opt-a', type: 'option', data: { label: 'Option A' } },
  { id: 'opt-b', type: 'option', data: { label: 'Option B' } },
]

const baseReport = {
  option_probabilities: { 'opt-a': { win_probability: 0.6 }, 'opt-b': { win_probability: 0.4 } },
  robustness: { recommended_option_id: 'opt-a', fragile_edges: [] },
}

describe('buildAnalysisContext — fail-closed identity (UI-SEM-072)', () => {
  it('resolves the leader when recommended_option_id names a visible option', () => {
    const ctx = buildAnalysisContext({ displayState: 'complete', report: baseReport, nodes: optionNodes, goalThreshold: null })
    expect(ctx.leadingOptionId).toBe('opt-a')
    expect(ctx.leadingOptionLabel).toBe('Option A')
  })

  it('fails closed when recommended_option_id is missing', () => {
    const report = { ...baseReport, robustness: { fragile_edges: [] } }
    const ctx = buildAnalysisContext({ displayState: 'complete', report, nodes: optionNodes, goalThreshold: null })
    expect(ctx.leadingOptionId).toBeNull()
    expect(ctx.leadingOptionLabel).toBeNull()
  })

  it('fails closed when recommended_option_id names a node that is not on the canvas', () => {
    const report = { ...baseReport, robustness: { recommended_option_id: 'opt-gone', fragile_edges: [] } }
    const ctx = buildAnalysisContext({ displayState: 'complete', report, nodes: optionNodes, goalThreshold: null })
    expect(ctx.leadingOptionId).toBeNull()
  })

  it('fails closed on single-option runs (no leader claim with < 2 options)', () => {
    const ctx = buildAnalysisContext({
      displayState: 'complete',
      report: baseReport,
      nodes: [optionNodes[0]],
      goalThreshold: null,
    })
    expect(ctx.leadingOptionId).toBeNull()
  })

  it('never resolves a leader pre-analysis', () => {
    const ctx = buildAnalysisContext({ displayState: 'ready_to_analyse', report: null, nodes: optionNodes, goalThreshold: null })
    expect(ctx.hasResults).toBe(false)
    expect(ctx.leadingOptionId).toBeNull()
  })
})

describe('buildAnalysisContext — staleness (UI-SEM-076)', () => {
  it('stale results keep hasResults true and set isStaleResult (claims retained, not stripped)', () => {
    const ctx = buildAnalysisContext({ displayState: 'results_stale', report: baseReport, nodes: optionNodes, goalThreshold: null })
    expect(ctx.hasResults).toBe(true)
    expect(ctx.isStaleResult).toBe(true)
    expect(ctx.leadingOptionId).toBe('opt-a')
  })

  it('fresh results are not stale', () => {
    const ctx = buildAnalysisContext({ displayState: 'complete', report: baseReport, nodes: optionNodes, goalThreshold: null })
    expect(ctx.isStaleResult).toBe(false)
  })

  it('a stale display state without a report yields no results at all', () => {
    const ctx = buildAnalysisContext({ displayState: 'results_stale', report: null, nodes: optionNodes, goalThreshold: null })
    expect(ctx.hasResults).toBe(false)
    expect(ctx.isStaleResult).toBe(false)
  })
})

describe('buildAnalysisContext — user goal target (UI-SEM-071)', () => {
  it('carries the user target through', () => {
    const ctx = buildAnalysisContext({ displayState: 'complete', report: baseReport, nodes: optionNodes, goalThreshold: 50000 })
    expect(ctx.goalThreshold).toBe(50000)
  })

  it('goalThreshold is null when the user set no target — producer values never substitute', () => {
    const report = { ...baseReport, goal_node: { id: 'goal-1', label: 'Goal', threshold: 0.8 } }
    const ctx = buildAnalysisContext({ displayState: 'complete', report, nodes: optionNodes, goalThreshold: null })
    expect(ctx.goalThreshold).toBeNull()
  })
})
