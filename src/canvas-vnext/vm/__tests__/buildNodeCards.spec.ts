// Stage-3 node-card builders — UI-SEM-077 flag ladder, UI-SEM-078 outcome
// polarity + risk fragile-incidence, decision fail-closed lead + hinge reuse,
// goal user-target gating.

import { describe, it, expect } from 'vitest'
import { buildAnalysisContext } from '../analysisContext'
import {
  buildDecisionCards,
  buildFactorCards,
  buildRiskCards,
  buildOutcomeCards,
  buildGoalCards,
  deriveFactorFlag,
  type NodeCardResultInputs,
} from '../buildNodeCards'
import type { AnalysisContextVM } from '../types'

const nodes = [
  { id: 'g1', type: 'goal', data: { label: 'Grow revenue' } },
  { id: 'd1', type: 'decision', data: { label: 'How to grow?' } },
  { id: 'o1', type: 'option', data: { label: 'Option A' } },
  { id: 'o2', type: 'option', data: { label: 'Option B' } },
  { id: 'f1', type: 'factor', data: { label: 'Customer demand', observedState: { value: 1200, unit: 'visits/week' } } },
  { id: 'f2', type: 'factor', data: { label: 'Setup costs', observedState: { value: 45000 } } },
  { id: 'f3', type: 'factor', data: { label: 'Staff morale' } },
  { id: 'r1', type: 'risk', data: { label: 'Overstretch', probability: 0.4, impact: 'high' } },
  { id: 'r2', type: 'risk', data: { label: 'Bare risk' } },
  { id: 'out1', type: 'outcome', data: { label: 'Repeat customers' } },
  { id: 'out2', type: 'outcome', data: { label: 'Detached outcome' } },
]

const edges = [
  { id: 'e-r1-g1', source: 'r1', target: 'g1', data: { weight: 0.4, direction: 'negative' } },
  { id: 'e-out1-g1', source: 'out1', target: 'g1', data: { weight: 0.5, direction: 'positive' } },
  { id: 'e-f1-g1', source: 'f1', target: 'g1', data: { weight: 0.6, direction: 'positive' } },
]

const report = {
  option_probabilities: { o1: { win_probability: 0.62 }, o2: { win_probability: 0.38 } },
  robustness: {
    recommended_option_id: 'o1',
    fragile_edges: [{ edge_id: 'e-r1-g1', switch_probability: 0.45 }],
  },
}

function analysis(overrides: Partial<AnalysisContextVM> = {}): AnalysisContextVM {
  return buildAnalysisContext({ displayState: 'complete', report, nodes, goalThreshold: null, ...(overrides as any) })
}

const NO_RESULTS = buildAnalysisContext({ displayState: 'ready_to_analyse', report: null, nodes, goalThreshold: null })

const signals: NodeCardResultInputs = {
  stateHeadline: 'Analysis complete',
  driverSignals: [
    { nodeId: 'f1', influenceRank: 1, confidence: 0.8, canFlipResult: false },
    { nodeId: 'f2', influenceRank: 2, confidence: 0.9, canFlipResult: true },
    { nodeId: 'f3', influenceRank: 3, confidence: 0.3, canFlipResult: false },
  ],
  evidenceGapSignals: [],
  hingeLabel: 'Customer demand',
}

const EMPTY_SIGNALS: NodeCardResultInputs = { stateHeadline: null, driverSignals: [], evidenceGapSignals: [], hingeLabel: null }

describe('decision cards', () => {
  it('carries the canonical state line, the fail-closed lead sentence and the hinge line', () => {
    const cards = buildDecisionCards(nodes, report, analysis(), signals)
    expect(cards.d1.stateLine).toBe('Analysis complete')
    expect(cards.d1.leadSentence).toBe('Option A leads in 62% of scenarios')
    expect(cards.d1.sensitiveTo).toBe('Sensitive to Customer demand')
  })

  it('no lead sentence when the leader is unresolved (fail-closed, UI-SEM-072)', () => {
    const noRec = { ...report, robustness: { fragile_edges: [] } }
    const ctx = buildAnalysisContext({ displayState: 'complete', report: noRec, nodes, goalThreshold: null })
    const cards = buildDecisionCards(nodes, noRec, ctx, signals)
    expect(cards.d1.leadSentence).toBeNull()
  })

  it('no lead sentence when the leader has no win probability', () => {
    const noWin = { ...report, option_probabilities: { o2: { win_probability: 0.38 } } }
    const ctx = buildAnalysisContext({ displayState: 'complete', report: noWin, nodes, goalThreshold: null })
    const cards = buildDecisionCards(nodes, noWin, ctx, signals)
    expect(cards.d1.leadSentence).toBeNull()
  })

  it('no result lines pre-analysis; state line still shows', () => {
    const cards = buildDecisionCards(nodes, null, NO_RESULTS, { ...EMPTY_SIGNALS, stateHeadline: 'Ready to analyse' })
    expect(cards.d1.stateLine).toBe('Ready to analyse')
    expect(cards.d1.leadSentence).toBeNull()
    expect(cards.d1.sensitiveTo).toBeNull()
  })
})

describe('factor flag ladder (UI-SEM-077)', () => {
  it('top_driver beats could_flip beats weak_evidence beats worth_checking', () => {
    expect(deriveFactorFlag('f1', analysis(), signals)).toBe('top_driver')
    expect(deriveFactorFlag('f2', analysis(), signals)).toBe('could_flip')
    expect(deriveFactorFlag('f3', analysis(), signals)).toBe('worth_checking')
    const withGap = { ...signals, evidenceGapSignals: [{ nodeId: 'f3' }] }
    expect(deriveFactorFlag('f3', analysis(), withGap)).toBe('weak_evidence')
  })

  it('no flags without results (fail-closed)', () => {
    expect(deriveFactorFlag('f1', NO_RESULTS, signals)).toBeNull()
  })

  it('worth_checking uses the shared low-confidence band (<0.40)', () => {
    const at40 = { ...signals, driverSignals: [{ nodeId: 'f3', influenceRank: 3, confidence: 0.4, canFlipResult: false }] }
    expect(deriveFactorFlag('f3', analysis(), at40)).toBeNull()
  })

  it('cards: value display is model input; live flags are result-derived; fixture flag overrides', () => {
    const cards = buildFactorCards(nodes, analysis(), signals, { f2: 'worth_discussing' })
    expect(cards.f1.valueDisplay).toBe('1200 visits/week')
    expect(cards.f2.valueDisplay).toBe('45000')
    expect(cards.f3.valueDisplay).toBeNull()
    expect(cards.f1.flag).toBe('top_driver')
    expect(cards.f1.flagIsResultDerived).toBe(true)
    expect(cards.f2.flag).toBe('worth_discussing')
    expect(cards.f2.flagIsResultDerived).toBe(false)
  })
})

describe('risk cards', () => {
  it('likelihood/impact only when set; fragile incidence counted via the canonical matcher', () => {
    const cards = buildRiskCards(nodes, edges, report, analysis())
    expect(cards.r1.likelihoodDisplay).toBe('40% likely')
    expect(cards.r1.impactDisplay).toBe('high impact')
    expect(cards.r1.fragileLinkCount).toBe(1)
    expect(cards.r2.likelihoodDisplay).toBeNull()
    expect(cards.r2.impactDisplay).toBeNull()
    expect(cards.r2.fragileLinkCount).toBe(0)
  })

  it('fragility requires results', () => {
    const cards = buildRiskCards(nodes, edges, null, NO_RESULTS)
    expect(cards.r1.fragileLinkCount).toBe(0)
  })
})

describe('outcome cards', () => {
  it('helps/hurts from the goal-directed edge sign; no edge ⇒ no claim', () => {
    const cards = buildOutcomeCards(nodes, edges)
    expect(cards.out1.goalEffect).toBe('helps')
    expect(cards.out2.goalEffect).toBeNull()
  })

  it('negative edge ⇒ hurts', () => {
    const hurtEdges = [{ id: 'e-out1-g1', source: 'out1', target: 'g1', data: { weight: 0.5, direction: 'negative' } }]
    expect(buildOutcomeCards(nodes, hurtEdges).out1.goalEffect).toBe('hurts')
  })
})

describe('goal cards (user-target gating)', () => {
  it('no user target ⇒ hint, no target line', () => {
    const cards = buildGoalCards(nodes, analysis())
    expect(cards.g1.targetDisplay).toBeNull()
    expect(cards.g1.needsTargetHint).toBe(true)
  })

  it('user target renders raw and untransformed', () => {
    const ctx = buildAnalysisContext({ displayState: 'complete', report, nodes, goalThreshold: 50000 })
    const cards = buildGoalCards(nodes, ctx)
    expect(cards.g1.targetDisplay).toBe('Success target: 50000')
    expect(cards.g1.needsTargetHint).toBe(false)
  })
})

describe('staleness (UI-SEM-076)', () => {
  it('stale flags retained with isStaleResult set', () => {
    const staleCtx = buildAnalysisContext({ displayState: 'results_stale', report, nodes, goalThreshold: null })
    const factor = buildFactorCards(nodes, staleCtx, signals)
    expect(factor.f1.flag).toBe('top_driver')
    expect(factor.f1.isStaleResult).toBe(true)
    const decision = buildDecisionCards(nodes, report, staleCtx, signals)
    expect(decision.d1.leadSentence).toBe('Option A leads in 62% of scenarios')
    expect(decision.d1.isStaleResult).toBe(true)
  })
})
