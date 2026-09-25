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
 *
 * ⭐ ED #63 5806207128 / 5806266691 choice 3 + NODE-ANATOMY v3.2 (Option): the
 * qualifier is the SHORT form `Goal only`, ON THE SHARE LINE — the same row as
 * `Current model ▬ N% of runs` — replacing #1921's second line ("Goal only ·
 * your limits aren’t in this share"). The full meaning ("your limits aren’t in
 * this share") is on hover AND keyboard focus AND in the accessible name. It
 * must not look like endorsement: muted text, no colour. The producer_cause
 * gating and the reload survival (RESULT-BOUND) are unchanged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
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

const seed = (analysisStateV1: unknown, permission?: Record<string, unknown>) => {
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
      ...(permission ? { producer_leader_permission: permission } : {}),
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
const shareRow = () => screen.getByTestId('option-analysis-currency-candidate')
const label = () => shareRow().getAttribute('aria-label') ?? ''
const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const WITHHELD_FOR_LIMITS = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' }

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null },
  } as never)
})

describe('an option share under a withheld limit verdict says it is goal-only (RC P0 #3c)', () => {
  it('constraint_verdict_withheld → the share keeps its number AND carries the goal-only qualifier (visible + accessible)', () => {
    seed(envelope({ permitted: false, withheld_reason: 'constraint_verdict_withheld' }), WITHHELD_FOR_LIMITS)
    renderCard()
    expect(readout().textContent).toBe('81% of runs') // the data is not withheld — only the claim
    expect(qualifier()).not.toBeNull()
    expect(qualifier()!.textContent).toBe('Goal only')
    expect(label()).toContain('This share compares the options on the goal alone.')
    // ⛔ The token also covers a withhold on a brief with NO limits (DL #63
    // 5825413732; Panel bundle 3): the note must not presume limits exist.
    expect(label()).not.toMatch(/your limits/i)
    // The reason sentence is Panel bundle 3's (#1993), read from the shared copy.
    expect(label()).toContain("Olumi's checks on this run do not support putting one option forward.")
  })

  it('ED choice 3 — ON THE SHARE LINE: `Goal only` sits in the same row as the share, after it; no second line', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const row = shareRow()
    const q = qualifier()!
    expect(row.contains(q)).toBe(true)
    expect(row.contains(readout())).toBe(true)
    expect(Boolean(readout().compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // #1921's own paragraph is gone: nothing outside the row says "Goal only".
    expect(q.tagName).not.toBe('P')
    expect(document.body.textContent).not.toContain('Goal only · your limits')
  })

  it('ED choice 3 — label in name: the spoken string opens with the visible line, then the full meaning', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    expect(label().startsWith('Current model · 81% of runs · Goal only. This share compares the options on the goal alone.')).toBe(true)
  })

  it('ED choice 3 — the full meaning is on keyboard FOCUS as well as hover', async () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    expect(shareRow().getAttribute('tabindex')).toBe('0')
    act(() => shareRow().focus())
    expect(document.activeElement).toBe(shareRow())
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Goal only. This share compares the options on the goal alone.')
  })

  it('ED choice 3 — it must not look like endorsement: muted text, no colour channel', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const t = tokens(qualifier()!)
    expect(t.has('text-text-light')).toBe(true)
    for (const cls of [...t]) {
      expect(/^(text|bg|border)-(info|success|warning|danger|primary|option)/.test(cls), `colour token ${cls}`).toBe(false)
    }
    expect(t.has('font-medium')).toBe(false)
    expect(t.has('font-semibold')).toBe(false)
  })

  it('CONTRAST — leader permitted: same numbers, no qualifier', () => {
    seed(envelope({ permitted: true, separation: 'separated' }))
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
    expect(label()).not.toContain('goal alone')
    expect(label()).not.toContain('Goal only')
    expect(label()).not.toContain('your limits')
  })

  it('CONTRAST — withheld for a DIFFERENT reason (separation_unavailable): no goal-only qualifier', () => {
    seed(envelope({ permitted: false, withheld_reason: 'separation_unavailable' }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable' })
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
  it('RESULT-BOUND — no live envelope (reload / a later turn without analysis_state): the stamped cause still qualifies the share', () => {
    seed(null, { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' })
    renderCard()
    expect(qualifier()).not.toBeNull()
  })

  it('CONTRAST — a live withheld envelope but NO stamped cause on the result: nothing (the card reads the result, not the session)', () => {
    seed(envelope({ permitted: false, withheld_reason: 'constraint_verdict_withheld' }))
    renderCard()
    expect(qualifier()).toBeNull()
  })
})
