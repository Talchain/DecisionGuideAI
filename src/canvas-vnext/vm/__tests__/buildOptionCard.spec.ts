// Option card builder — status banding (UI-SEM-072), behind-reason parity
// (UI-SEM-073 vs OptionNode's UI-SEM-067 logic), stale retention (UI-SEM-076).
//
// The parity fixtures mirror OptionNode.tsx's computeBehindReason inputs
// exactly; the expected strings are derived from that implementation. If
// OptionNode changes, update BOTH the derivation and these pins.

import { describe, it, expect } from 'vitest'
import { buildAnalysisContext } from '../analysisContext'
import { buildOptionCards, computeBehindReasonParity } from '../buildOptionCard'

const nodes = [
  { id: 'o1', type: 'option', data: { label: 'Expand north' } },
  { id: 'o2', type: 'option', data: { label: 'Expand south' } },
  { id: 'o3', type: 'option', data: { label: 'Current plan', is_baseline: true } },
  { id: 'f1', type: 'factor', data: { label: 'Marketing Spend Level' } },
]

function makeReport(overrides: Record<string, any> = {}) {
  return {
    option_probabilities: {
      o1: { win_probability: 0.6, goal_probability: 0.7 },
      o2: { win_probability: 0.3, goal_probability: 0.4 },
      o3: { win_probability: 0.1, goal_probability: 0.15 },
    },
    robustness: { recommended_option_id: 'o1', fragile_edges: [] },
    factor_sensitivity: [{ factor_id: 'f1', label: 'Marketing Spend Level', importance_score: 0.8 }],
    ...overrides,
  }
}

const cee = {
  options: [
    { id: 'o1', interventions: { f1: { value: 0.9 } } },
    { id: 'o2', interventions: { f1: { value: 0.4 } } },
    { id: 'o3', interventions: {} },
  ],
}

function build(report: Record<string, any> | null, opts: { displayState?: 'complete' | 'results_stale' | 'ready_to_analyse'; goalThreshold?: number | null; nodeList?: typeof nodes } = {}) {
  const { displayState = report ? 'complete' : 'ready_to_analyse', goalThreshold = null, nodeList = nodes } = opts
  const analysis = buildAnalysisContext({ displayState, report, nodes: nodeList, goalThreshold })
  return buildOptionCards({ nodes: nodeList, report, ceeAnalysisReady: cee, analysis })
}

describe('status banding (UI-SEM-072, gap shared with UI-SEM-006)', () => {
  it('resolved recommendation → leading; distant rival → behind; baseline → baseline', () => {
    const cards = build(makeReport())
    expect(cards.o1.status).toBe('leading')
    expect(cards.o2.status).toBe('behind') // gap 0.30 ≥ 0.10
    expect(cards.o3.status).toBe('baseline')
  })

  it('gap 0.09 → close_second', () => {
    const report = makeReport()
    report.option_probabilities.o2 = { win_probability: 0.51, goal_probability: 0.4 }
    expect(build(report).o2.status).toBe('close_second')
  })

  it('gap 0.11 → behind', () => {
    const report = makeReport()
    report.option_probabilities.o2 = { win_probability: 0.49, goal_probability: 0.4 }
    expect(build(report).o2.status).toBe('behind')
  })

  it('gap nominally 0.10 → close_second (raw FP comparison, parity with buildResultsVM)', () => {
    // 0.6 - 0.5 is 0.0999…8 in IEEE754, which is < GAP_THRESHOLD. buildResultsVM
    // (UI-SEM-006) compares the same raw difference, so the boundary behaviour
    // deliberately matches it rather than adding rounding this surface owns.
    const report = makeReport()
    report.option_probabilities.o2 = { win_probability: 0.5, goal_probability: 0.4 }
    expect(build(report).o2.status).toBe('close_second')
  })

  it('a baseline that IS the resolved leader shows leading', () => {
    const report = makeReport({ robustness: { recommended_option_id: 'o3', fragile_edges: [] } })
    expect(build(report).o3.status).toBe('leading')
  })

  it('fail-closed: no recommendation → no leading/behind statuses, baseline still labelled', () => {
    const report = makeReport({ robustness: { fragile_edges: [] } })
    const cards = build(report)
    expect(cards.o1.status).toBeNull()
    expect(cards.o2.status).toBeNull()
    expect(cards.o3.status).toBe('baseline')
  })

  it('pre-analysis: no statuses except baseline, no win display', () => {
    const cards = build(null)
    expect(cards.o1.status).toBeNull()
    expect(cards.o1.winDisplay).toBeNull()
    expect(cards.o3.status).toBe('baseline')
  })
})

describe('win display', () => {
  it('formats via formatWinProbability with the sub-1% floor', () => {
    const report = makeReport()
    report.option_probabilities.o2 = { win_probability: 0.005, goal_probability: 0.01 }
    const cards = build(report)
    expect(cards.o1.winDisplay).toBe('60%')
    expect(cards.o2.winDisplay).toBe('< 1%')
  })

  it('missing win probability → null display, still behind', () => {
    const report = makeReport()
    delete (report.option_probabilities as any).o2
    const cards = build(report)
    expect(cards.o2.winDisplay).toBeNull()
    expect(cards.o2.status).toBe('behind')
  })
})

describe('behind-reason parity (UI-SEM-073 vs UI-SEM-067)', () => {
  it('baseline → "no changes from current state"', () => {
    expect(computeBehindReasonParity('o3', true, makeReport(), cee, nodes)).toBe('no changes from current state')
  })

  it('no report → null', () => {
    expect(computeBehindReasonParity('o2', false, null, cee, nodes)).toBeNull()
  })

  it('no recommendation → null (fail-closed)', () => {
    const report = makeReport({ robustness: { fragile_edges: [] } })
    expect(computeBehindReasonParity('o2', false, report, cee, nodes)).toBeNull()
  })

  it('no sensitivity → "fewer key changes"', () => {
    const report = makeReport({ factor_sensitivity: [] })
    expect(computeBehindReasonParity('o2', false, report, cee, nodes)).toBe('fewer key changes')
  })

  it('winner has the top factor, this option does not → "no {label} added" (suffix stripped)', () => {
    const report = makeReport()
    const ceeNoFactor = {
      options: [
        { id: 'o1', interventions: { f1: { value: 0.9 } } },
        { id: 'o2', interventions: {} },
        { id: 'o3', interventions: {} },
      ],
    }
    expect(computeBehindReasonParity('o2', false, report, ceeNoFactor, nodes)).toBe('no marketing spend added')
  })

  it('both have the factor with different values → "{label} lower"', () => {
    expect(computeBehindReasonParity('o2', false, makeReport(), cee, nodes)).toBe('marketing spend lower')
  })

  it('both have the factor with equal values → "fewer key changes"', () => {
    const ceeSame = {
      options: [
        { id: 'o1', interventions: { f1: { value: 0.9 } } },
        { id: 'o2', interventions: { f1: { value: 0.9 } } },
        { id: 'o3', interventions: {} },
      ],
    }
    expect(computeBehindReasonParity('o2', false, makeReport(), ceeSame, nodes)).toBe('fewer key changes')
  })

  it('identical-reason suppression: same reason on multiple losers renders on none', () => {
    // Both o2 and o4 lack the winner's factor → identical 'no … added' reason.
    const nodesWith4 = [...nodes, { id: 'o4', type: 'option', data: { label: 'Expand east' } }]
    const report = makeReport()
    ;(report.option_probabilities as any).o4 = { win_probability: 0.2 }
    const ceeDup = {
      options: [
        { id: 'o1', interventions: { f1: { value: 0.9 } } },
        { id: 'o2', interventions: {} },
        { id: 'o4', interventions: {} },
        { id: 'o3', interventions: {} },
      ],
    }
    const analysis = buildAnalysisContext({ displayState: 'complete', report, nodes: nodesWith4, goalThreshold: null })
    const cards = buildOptionCards({ nodes: nodesWith4, report, ceeAnalysisReady: ceeDup, analysis })
    expect(cards.o2.keyReason).toBeNull()
    expect(cards.o4.keyReason).toBeNull()
    // The baseline's distinct reason survives.
    expect(cards.o3.keyReason).toBe('no changes from current state')
  })

  it('leader is excluded from the duplicate scan (win within 1e-4 of max)', () => {
    const cards = build(makeReport())
    expect(cards.o1.keyReason).toBeNull() // leader gets no behind reason
    expect(cards.o2.keyReason).toBe('marketing spend lower')
  })
})

describe('stale retention (UI-SEM-076 — Paul decision 3)', () => {
  it('stale keeps every claim and flags isStaleResult on each card', () => {
    const cards = build(makeReport(), { displayState: 'results_stale' })
    expect(cards.o1.status).toBe('leading')
    expect(cards.o1.winDisplay).toBe('60%')
    expect(cards.o1.isStaleResult).toBe(true)
    expect(cards.o2.keyReason).toBe('marketing spend lower')
    expect(cards.o2.isStaleResult).toBe(true)
  })
})

describe('goal fit gating (UI-SEM-071)', () => {
  it('no user target → no goal display, even with producer goal probabilities', () => {
    const cards = build(makeReport(), { goalThreshold: null })
    expect(cards.o1.goalFitDisplay).toBeNull()
  })

  it('user target present → goal display renders', () => {
    const cards = build(makeReport(), { goalThreshold: 100 })
    expect(cards.o1.goalFitDisplay).toBe('70%')
  })
})

describe('gap to leader (Detailed slot)', () => {
  it('reports the pp gap for non-leaders, null for the leader', () => {
    const cards = build(makeReport())
    expect(cards.o1.gapToLeaderPp).toBeNull()
    expect(cards.o2.gapToLeaderPp).toBe(30)
  })
})
