/**
 * B5 — the per-limit verdict lines: parsed from the contract, joined by constraint
 * id, said in words, and never louder than the verdict.
 *
 * ⭐ THE COMPOSITION ARM runs the REAL chain (applyV5State → canvas store → hook →
 * section) on the production store construction, as `whatsChangedComposesEndToEnd`
 * does for run_delta: N green seams do not compose into a working product.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State } from '../../../../v5/applyV5State'
import { ADDITIVE_EXTENSIONS_KEY } from '../../../../v5/responseParser'
import { useCanvasStore } from '../../../../canvas/store'
import {
  limitVerdictsDescribeDisplayedAnalysis,
  readLimitVerdicts,
  type LimitVerdicts,
  type StoredLimitVerdicts,
} from '../../../../canvas/state/storedLimitVerdicts'
import type { StatedLimit } from '../../decision-overview/statedLimits'
import { buildLimitVerdictView, LIMIT_UNSCORED_REASON_WORDS, LIMIT_VERDICT_COPY } from '../limitVerdictView'
import { LimitVerdictLines } from '../sections/LimitVerdictLines'
import { useAnalysisNewViewModel } from '../useAnalysisNewViewModel'
import { makeData } from './analysisNewFixtures'

const CHURN: StatedLimit = { id: 'c_churn', text: 'Monthly churn ≤ 5%' }
const BUDGET: StatedLimit = { id: 'c_budget', text: 'Budget ≤ £50,000' }

const verdicts = (over: Partial<LimitVerdicts> = {}): LimitVerdicts => ({ perLimit: [], joint: null, ...over })

describe('the reader takes the contract shape and nothing else', () => {
  it('parses every state and keeps ids and reasons verbatim', () => {
    const read = readLimitVerdicts({
      per_limit: [
        { constraint_id: 'c_churn', state: 'scored' },
        { constraint_id: 'c_budget', state: 'estimate_only', reason: 'baseline_is_estimate' },
        { constraint_id: 'c_nps', state: 'unscored', reason: 'target_unanchored' },
      ],
      joint: { state: 'withheld', withheld_reason: 'limit_unscored', constraint_ids: ['c_nps'] },
    })
    expect(read?.perLimit).toEqual([
      { constraintId: 'c_churn', state: 'scored', reason: null },
      { constraintId: 'c_budget', state: 'estimate_only', reason: 'baseline_is_estimate' },
      { constraintId: 'c_nps', state: 'unscored', reason: 'target_unanchored' },
    ])
    expect(read?.joint).toEqual({ state: 'withheld', withheldReason: 'limit_unscored', constraintIds: ['c_nps'] })
  })

  it('drops a row the contract refuses — never repairs it', () => {
    const read = readLimitVerdicts({
      per_limit: [
        { constraint_id: 'c_a', state: 'scored', reason: 'baseline_is_estimate' }, // scored names no reason
        { constraint_id: 'c_b', state: 'unscored' }, // unscored must name one
        { constraint_id: 'c_c', state: 'met' }, // not a state
        { constraint_id: '', state: 'scored' },
        { constraint_id: 'c_ok', state: 'scored' },
      ],
      joint: { state: 'withheld' }, // withheld must name its reason
    })
    expect(read?.perLimit.map((r) => r.constraintId)).toEqual(['c_ok'])
    expect(read?.joint).toBeNull()
  })

  it('absence is not a verdict', () => {
    expect(readLimitVerdicts(undefined)).toBeNull()
    expect(readLimitVerdicts(null)).toBeNull()
    expect(readLimitVerdicts([])).toBeNull()
    expect(readLimitVerdicts({})).toBeNull()
    expect(readLimitVerdicts({ per_limit: [{ constraint_id: 'x', state: 'bogus' }] })).toBeNull()
  })
})

describe('bound to the analysis it came beside', () => {
  const stored: StoredLimitVerdicts = { verdicts: verdicts(), analysisHash: 'h1', scenarioId: 's1' }
  it('reads only on the same hash and scenario', () => {
    expect(limitVerdictsDescribeDisplayedAnalysis(stored, 'h1', 's1')).toBe(true)
    expect(limitVerdictsDescribeDisplayedAnalysis(stored, 'h2', 's1')).toBe(false)
    expect(limitVerdictsDescribeDisplayedAnalysis(stored, 'h1', 's2')).toBe(false)
    expect(limitVerdictsDescribeDisplayedAnalysis(stored, '', 's1')).toBe(false)
    expect(limitVerdictsDescribeDisplayedAnalysis(stored, undefined, 's1')).toBe(false)
    expect(limitVerdictsDescribeDisplayedAnalysis(null, 'h1', 's1')).toBe(false)
  })
})

describe('the words never say more than the state', () => {
  it('joins by constraint id, in the order the user stated the limits', () => {
    const view = buildLimitVerdictView(
      verdicts({
        perLimit: [
          { constraintId: 'c_budget', state: 'scored', reason: null },
          { constraintId: 'c_churn', state: 'unscored', reason: 'target_unanchored' },
        ],
      }),
      [CHURN, BUDGET],
    )
    expect(view?.rows.map((r) => [r.id, r.limitText, r.state])).toEqual([
      ['c_churn', CHURN.text, 'unscored'],
      ['c_budget', BUDGET.text, 'scored'],
    ])
  })

  it('a verdict for a limit this model does not hold is dropped, never named', () => {
    const view = buildLimitVerdictView(verdicts({ perLimit: [{ constraintId: 'c_ghost', state: 'scored', reason: null }] }), [CHURN])
    expect(view).toBeNull()
  })

  it('scored says checked; estimate_only names whose figure and never says met', () => {
    const view = buildLimitVerdictView(
      verdicts({
        perLimit: [
          { constraintId: 'c_churn', state: 'scored', reason: null },
          { constraintId: 'c_budget', state: 'estimate_only', reason: 'baseline_is_estimate' },
        ],
      }),
      [CHURN, BUDGET],
    )
    const [scored, estimate] = view!.rows
    expect(scored.words).toBe(LIMIT_VERDICT_COPY.scored)
    expect(estimate.words).toBe(LIMIT_VERDICT_COPY.estimateOnly)
    expect(estimate.words).toMatch(/Olumi's estimate/)
    for (const row of view!.rows) {
      expect(row.words).not.toMatch(/\bmet\b|\bmeets\b|within/i)
      expect(row.words).not.toMatch(/\d/)
    }
  })

  it('unscored names the reason in words, and an unknown code is never printed', () => {
    for (const [code, words] of Object.entries(LIMIT_UNSCORED_REASON_WORDS)) {
      const view = buildLimitVerdictView(verdicts({ perLimit: [{ constraintId: 'c_churn', state: 'unscored', reason: code }] }), [CHURN])
      expect(view!.rows[0].words).toBe(LIMIT_VERDICT_COPY.unscoredBecause(words))
      expect(view!.rows[0].words).not.toContain(code)
    }
    const unknown = buildLimitVerdictView(
      verdicts({ perLimit: [{ constraintId: 'c_churn', state: 'unscored', reason: 'a_code_from_the_future' }] }),
      [CHURN],
    )
    expect(unknown!.rows[0].words).toBe(LIMIT_VERDICT_COPY.unscored)
  })

  it('a withheld joint verdict is said only when there are limits to join', () => {
    const joint = { state: 'withheld' as const, withheldReason: 'limit_unscored', constraintIds: ['c_churn'] }
    const perLimit = [{ constraintId: 'c_churn', state: 'unscored' as const, reason: 'target_unanchored' }]
    expect(buildLimitVerdictView(verdicts({ perLimit, joint }), [CHURN, BUDGET])?.jointWords).toBe(LIMIT_VERDICT_COPY.jointWithheld)
    expect(buildLimitVerdictView(verdicts({ perLimit, joint }), [CHURN])?.jointWords).toBeNull()
    expect(
      buildLimitVerdictView(verdicts({ perLimit, joint: { state: 'scored', withheldReason: null, constraintIds: [] } }), [CHURN, BUDGET])
        ?.jointWords,
    ).toBeNull()
  })
})

// ── the real chain ───────────────────────────────────────────────────────────

const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'A leads',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.64, opt_b: 0.36 },
  enrichment: {},
}

const WIRE_VERDICTS = {
  per_limit: [
    { constraint_id: 'c_churn', state: 'estimate_only', reason: 'baseline_is_estimate' },
    { constraint_id: 'c_budget', state: 'unscored', reason: 'CONSTRAINT_NOT_CONVERTIBLE' },
  ],
  joint: { state: 'withheld', withheld_reason: 'limit_unscored', constraint_ids: ['c_budget'] },
}

/**
 * A production-shaped analyse turn CARRIES `analysis_ready`. Without it the applicator
 * clears readiness on an analyse turn, and that clear set includes `goalConstraints`
 * (READINESS_CLEAR_FIELDS) — found by this spec's first run, not assumed.
 */
const ANALYSIS_READY = {
  status: 'ready',
  goal_node_id: 'goal_1',
  freshness: 'fresh',
  options: [
    { id: 'opt_a', status: 'ready', interventions: {} },
    { id: 'opt_b', status: 'ready', interventions: {} },
  ],
}

function wireResponse(extra: Record<string, unknown> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [analysisBlock],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_ready: ANALYSIS_READY,
    ...extra,
  } as unknown as OlumiResponse
}

/** EXACTLY the production construction — `useConversation.ts` spreads the store whole. */
function productionApplicatorStore() {
  const snap = useCanvasStore.getState()
  return { ...snap, currentResultsHash: snap.results?.hash ?? null } as never
}

beforeEach(() => {
  useCanvasStore.setState({
    limitVerdicts: null,
    results: { status: 'idle', progress: 0 },
    currentScenarioId: 'scn-int',
    goalConstraints: [
      { constraint_id: 'c_churn', label: 'Monthly churn', operator: '<=', value: 5, unit: '%' },
      { constraint_id: 'c_budget', label: 'Budget', operator: '<=', value: 50000, unit: '£' },
    ],
  } as never)
})
afterEach(() => cleanup())

function renderChain(responseHash: string | undefined) {
  return renderHook(() =>
    useAnalysisNewViewModel({ data: makeData(), isPreRun: false, isRunning: false, isStale: false, responseHash }),
  )
}

describe('⭐ the wire reaches the screen', () => {
  it.each([
    ['top-level key (0.61 carrier)', { limit_verdicts: WIRE_VERDICTS }],
    ['additive sidecar (before the UI vendors 0.61)', { [ADDITIVE_EXTENSIONS_KEY]: { limit_verdicts: WIRE_VERDICTS } }],
  ])('%s → stored with its analysis → one line per limit', (_name, extra) => {
    applyV5State(wireResponse(extra), productionApplicatorStore())
    const stored = useCanvasStore.getState().limitVerdicts
    expect(stored, 'the production store object is missing setLimitVerdicts').not.toBeNull()
    const displayedHash = useCanvasStore.getState().results?.hash
    expect(displayedHash).toBeTruthy()
    expect(stored?.analysisHash).toBe(displayedHash)
    expect(stored?.scenarioId).toBe('scn-int')

    const { result } = renderChain(displayedHash)
    expect(result.current.limitVerdicts).not.toBeNull()
    render(<LimitVerdictLines view={result.current.limitVerdicts} />)
    const rows = screen.getAllByTestId('analysis-new-limit-verdicts-row')
    expect(rows.map((r) => [r.getAttribute('data-constraint-id'), r.getAttribute('data-state')])).toEqual([
      ['c_churn', 'estimate_only'],
      ['c_budget', 'unscored'],
    ])
    expect(rows[0].textContent).toContain(LIMIT_VERDICT_COPY.estimateOnly)
    expect(rows[1].textContent).toContain(LIMIT_UNSCORED_REASON_WORDS.CONSTRAINT_NOT_CONVERTIBLE)
    expect(screen.getByTestId('analysis-new-limit-verdicts-joint').textContent).toBe(LIMIT_VERDICT_COPY.jointWithheld)
  })
})

describe('⛔ the negative arms', () => {
  it('a turn with no verdicts renders nothing', () => {
    applyV5State(wireResponse(), productionApplicatorStore())
    const { result } = renderChain(useCanvasStore.getState().results?.hash)
    expect(result.current.limitVerdicts).toBeNull()
    const { container } = render(<LimitVerdictLines view={result.current.limitVerdicts} />)
    expect(container.innerHTML).toBe('')
  })

  it('verdicts about a superseded analysis, or another scenario, are invisible', () => {
    applyV5State(wireResponse({ limit_verdicts: WIRE_VERDICTS }), productionApplicatorStore())
    const displayedHash = useCanvasStore.getState().results?.hash
    expect(renderChain('a-different-analysis-hash').result.current.limitVerdicts).toBeNull()
    useCanvasStore.setState({ currentScenarioId: 'scn-elsewhere' } as never)
    expect(renderChain(displayedHash).result.current.limitVerdicts).toBeNull()
  })

  it('a NEW analysis without verdicts evicts; a conversation turn leaves them alone', () => {
    applyV5State(wireResponse({ limit_verdicts: WIRE_VERDICTS }), productionApplicatorStore())
    expect(useCanvasStore.getState().limitVerdicts).not.toBeNull()
    applyV5State(
      { response_version: 2, assistant_text: 'just chatting', blocks: [], suggested_actions: [], insights: [], stage_indicator: 'analyse' } as OlumiResponse,
      productionApplicatorStore(),
    )
    expect(useCanvasStore.getState().limitVerdicts).not.toBeNull()
    applyV5State(
      wireResponse({ blocks: [{ ...analysisBlock, leading_option_id: 'opt_b', win_probabilities: { opt_a: 0.3, opt_b: 0.7 } }] }),
      productionApplicatorStore(),
    )
    expect(useCanvasStore.getState().limitVerdicts).toBeNull()
  })

  it('a re-delivered analysis carrying the verdicts still stores them (the second-writer case)', () => {
    applyV5State(wireResponse(), productionApplicatorStore())
    expect(useCanvasStore.getState().limitVerdicts).toBeNull()
    applyV5State(wireResponse({ limit_verdicts: WIRE_VERDICTS }), productionApplicatorStore())
    expect(useCanvasStore.getState().limitVerdicts?.analysisHash).toBe(useCanvasStore.getState().results?.hash)
  })
})
