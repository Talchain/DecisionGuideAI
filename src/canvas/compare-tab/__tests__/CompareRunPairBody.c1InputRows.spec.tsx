import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnalysisStateV1Schema, type RunDelta, type RunDeltaInputChange } from '@talchain/schemas/boundary'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useCanvasStore } from '../../store'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { RUN_CHANGE_ARTEFACT_TESTID } from '../RunChangeArtefactCard'
import { InputChanges } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { C1_ENDPOINTS, C1_INTERVENTIONS, C1_LINK_ROWS, C1_OPTION_ROW, c1Delta } from './__fixtures__/c1InputRows'

const original = useCanvasStore.getState()
const labels = new Map([
  ['raise_prices_10', 'Raise prices 10%'], ['existing_customer_price_change', 'Canvas label must not replace producer label'],
  ['revenue', 'Revenue'], ['opt_49', 'Keep £49'], ['opt_60', 'Raise to £60'],
])
function seed(delta: RunDelta = c1Delta()): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.44, opt_49: 0.56 } })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-c1',
    nodes: [...labels].map(([id, label]) => ({ id, type: id === 'raise_prices_10' ? 'option' : 'factor',
      position: { x: 0, y: 0 }, data: { label, ...(id === 'raise_prices_10' ? {
        interventions: { existing_customer_price_change: C1_INTERVENTIONS.after },
      } : {}) } })), edges: [],
    runDelta: { delta, analysisHash: hash, scenarioId: 'scn-c1' }, runDeltaAbsence: null,
    results: { status: 'complete', progress: 100, report, hash },
    analysisStateV1: AnalysisStateV1Schema.parse({ run_state: { kind: 'complete_current', computed_at: C1_ENDPOINTS.current.computed_at },
      readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: true }, robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true, requires_rerun: false,
      blocked_unusable: false, contradictions: [] }),
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  })
  return hash
}
const pairRows = () => [...screen.getByTestId('compare-run-pair').querySelectorAll<HTMLElement>('[data-testid$="-input-row"]')]

beforeEach(() => {
  useCanvasStore.setState(original, true)
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline Compare fixture'))
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); vi.restoreAllMocks() })

describe('C1 Compare input rows, producer identities and values', () => {
  it('C1-a: lists the option intervention even after the first two rows, with its names and raw values', () => {
    render(<CompareRunPairBody responseHash={seed()} />)
    expect(screen.queryByTestId('compare-run-pair-empty')).toBeNull()
    expect(screen.queryByTestId('compare-run-pair-run-on-record')).toBeNull()
    const row = pairRows().find(el => el.dataset.entityId === C1_OPTION_ROW.entity_id)
    expect(row, 'J7 must find the option-setting row by its producer identity').toBeDefined()
    expect(row!).toHaveTextContent('Existing-customer price change, Raise prices 10%: 10% → 12%')
    expect(within(row!).getByTestId('compare-input-row-values')).toHaveTextContent(/^10%12%$/)
    expect(row!).toHaveAttribute('data-option-id', C1_OPTION_ROW.option_id)
    expect(row!).not.toHaveTextContent('0.1')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('C1-b: every link and option row is a separate DOM row in producer order, including sizing plus strength', () => {
    const option: RunDeltaInputChange = { entity_kind: 'option', entity_id: 'opt_49', field: 'presence',
      label_after: 'Keep £49', before: null, after: { raw: true }, change: 'added' }
    const rows = [...C1_LINK_ROWS, C1_OPTION_ROW, option]
    render(<CompareRunPairBody responseHash={seed(c1Delta(rows))} />)
    expect(pairRows().map(el => el.dataset.entityId)).toEqual(rows.map(row => row.entity_id))
    expect(pairRows()).toHaveLength(rows.length)
    expect(screen.queryByTestId('analysis-new-whats-changed-inputs-toggle')).toBeNull()
    expect(pairRows()[0]).toHaveTextContent('Olumi')
    expect(pairRows()[1]).toHaveTextContent('Slight')
  })

  it('C1-c: no best, winner or recommendation wording; goal chances use only the CEE-carried pair', () => {
    const delta = c1Delta()
    delta.goal_chances = [{ option_id: 'opt_49', prior: { kind: 'point', pct: 47, rounding: 'whole' },
      current: { kind: 'range', low_pct: 20, high_pct: 40, low_rounding: 'whole', high_rounding: 'whole' } }]
    render(<CompareRunPairBody responseHash={seed(delta)} />)
    const pair = screen.getByTestId('compare-run-pair')
    const goals = screen.getByTestId('compare-goal-chances')
    expect(within(goals).getAllByRole('listitem').map(row => row.dataset.optionId)).toEqual(['opt_49'])
    expect(within(goals).getByTestId('compare-goal-chance-words')).toHaveTextContent(
      /^Keep £49: Earlier about 47% → Latest between about 20% and 40%$/)
    expect(within(goals).getByTestId('compare-goal-chance-pair')).toHaveTextContent(
      /^about 47%between about 20% and 40%$/)
    expect(goals.textContent).not.toMatch(/10%|12%|41%|44%|56%|59%/)
    expect(pair.textContent).not.toMatch(/\bbest\b|\bwinner\b|recommend/i)
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-share-results')).toBeInTheDocument()
    expect(pair.textContent).not.toMatch(/\bbest\b|\bwinner\b|recommend/i)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(c1Delta())} />)
    expect(screen.queryByTestId('compare-goal-chances')).toBeNull()
    expect(screen.getByTestId('compare-run-pair').textContent).not.toMatch(/\bbest\b|\bwinner\b|recommend/i)
  })

  it('C1-d: the producer refuses the auto-Run pair with its existing absence token and explanation', () => {
    const hash = seed()
    useCanvasStore.setState({ runDelta: null, runDeltaAbsence: {
      reason: 'unrequested_run_in_pair', analysisHash: hash, scenarioId: 'scn-c1',
    } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.queryByTestId('compare-run-pair')).toBeNull()
    expect(screen.getByTestId('compare-run-pair-empty')).toHaveAttribute('data-absence-reason', 'unrequested_run_in_pair')
    expect(screen.getByTestId('compare-run-pair-empty')).toHaveTextContent('automatic first pass')
  })

  it('C1-e: the headline artefact binds the requested prior R1 and current R2 ids', () => {
    render(<CompareRunPairBody responseHash={seed()} />)
    expect(screen.getByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toHaveAttribute('data-prior-run-id', C1_ENDPOINTS.prior.run_id)
    expect(screen.getByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toHaveAttribute('data-current-run-id', C1_ENDPOINTS.current.run_id)
  })

  it('the shared sentence-list row carries the same entity identity', () => {
    const view = buildRunDeltaView(c1Delta([C1_OPTION_ROW]), id => labels.get(id) ?? null)
    const { container } = render(<InputChanges inputs={view.inputs} />)
    expect(container.querySelector('[data-testid$="-input-row"]')).toHaveAttribute('data-entity-id', C1_OPTION_ROW.entity_id)
  })

  it('keeps a producer string verbatim and numeric precision without adding a percent frame', () => {
    const row = { ...C1_OPTION_ROW, before: { raw: 'producer value' }, after: { raw: 0.123456789 } }
    render(<CompareRunPairBody responseHash={seed(c1Delta([row]))} />)
    expect(pairRows()[0]).toHaveTextContent('producer value → 0.123456789')
  })

  it.each([
    ['missing', (hash: string) => { useCanvasStore.setState({ runDelta: null }); return hash }],
    ['incompatible', () => 'superseded-response'],
    ['stale on record', () => undefined],
  ])('a %s pair explains itself in words and mints no client absence token (C10a: only a producer-bound reason)', (name, arrange) => {
    const hash = arrange(seed())
    if (name === 'stale on record') useCanvasStore.setState({ runDelta: null })
    const { container } = render(<CompareRunPairBody responseHash={hash} runOnRecordWithoutResult={name === 'stale on record' ? 'stale' : null} />)
    expect(container.querySelector('[data-absence-reason]')).toBeNull()
    expect(container.textContent!.trim().length).toBeGreaterThan(0)
  })
})
