/**
 * ⭐ AN OPTION'S SHARE SAYS IT IS GOAL-ONLY WHEN THE LIMIT VERDICT WITHHOLDS THE
 * LEADER CLAIM (RC #63 5803875794, P0 #3(c); Paul's staging test 23 Sep).
 *
 * Paul's run: goal "£20k MRR in 12 months" AND a guardrail "churn < 4%". CEE
 * answered `leader_claim: { permitted: false, withheld_reason:
 * 'constraint_verdict_withheld' }` — yet every option card still showed its
 * share ("81% / 17% / 2%") with nothing saying the guardrail was not in it,
 * which reads as a ranking of the whole decision.
 *
 * The qualifier is true in ALL THREE producer states behind that token
 * (evaluated_infeasible / unevaluated / identity_unresolved —
 * `analysisNewCopy.ts` LEADER_WITHHOLD_CAUSE): the win share is computed on the
 * goal outcome alone. It claims nothing about WHICH of the three happened.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const candidate = { id: 'candidate', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Grandfather existing customers', type: 'option' } }

const envelope = (leaderClaim: Record<string, unknown>) => ({
  run_state: { kind: 'complete_current', computed_at: '2026-09-23T21:40:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: leaderClaim,
  robustness: { aggregate_level: 'low' },
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
})

const seed = (analysisStateV1: unknown) => {
  useCanvasStore.setState({
    nodes: [candidate, { ...candidate, id: 'alternative', data: { label: 'Usage-based for all', type: 'option' } }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard',
    analysisStateV1,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-23T21:40:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: 'limits-scenario',
    v5AnalysisFact: { scenarioId: 'limits-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: {
        candidate: { status: 'computed', win_probability: 0.81 },
        alternative: { status: 'computed', win_probability: 0.19 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'candidate' } },
    } },
  } as never)
}

const renderCard = () => render(<ReactFlowProvider><OptionNode
  id={candidate.id} type="option" data={candidate.data as never} selected={false}
  isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
  dragging={false} zIndex={0} deletable selectable draggable
/></ReactFlowProvider>)

const readout = () => screen.getByTestId('option-win-readout-candidate')
const qualifier = () => screen.queryByTestId('option-share-goal-only-candidate')
const label = () => screen.getByTestId('option-analysis-currency-candidate').getAttribute('aria-label') ?? ''

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null },
  } as never)
})

describe('an option share under a withheld limit verdict says it is goal-only (RC P0 #3c)', () => {
  it('constraint_verdict_withheld → the share keeps its number AND carries the goal-only qualifier (visible + accessible)', () => {
    seed(envelope({ permitted: false, withheld_reason: 'constraint_verdict_withheld' }))
    renderCard()
    expect(readout().textContent).toBe('81% of runs') // the data is not withheld — only the claim
    expect(qualifier()).not.toBeNull()
    expect(qualifier()!.textContent).toBe('Goal only · your limits aren’t in this share')
    expect(label()).toContain('This share compares the options on the goal alone; the limits you set are not part of it.')
    expect(label()).toContain('The check against the limits you set does not support putting one option forward.')
  })

  it('CONTRAST — leader permitted: same numbers, no qualifier', () => {
    seed(envelope({ permitted: true, separation: 'separated' }))
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
    expect(label()).not.toContain('goal alone')
  })

  it('CONTRAST — withheld for a DIFFERENT reason (separation_unavailable): no goal-only qualifier', () => {
    seed(envelope({ permitted: false, withheld_reason: 'separation_unavailable' }))
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
  })

  it('CONTRAST — no wire state at all: no qualifier (nothing is inferred)', () => {
    seed(null)
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
  })
})
