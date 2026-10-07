import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnalysisResultBlockSchema, AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { WHATS_CHANGED_TESTID } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { useCanvasStore } from '../../store'
import { selectRunAffirmedCurrent } from '../../state/analysisStateSelector'
import { selectWinSharesWithheld } from '../../state/winShareGate'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { RUN_CHANGE_ARTEFACT_TESTID } from '../RunChangeArtefactCard'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

type StoreState = ReturnType<typeof useCanvasStore.getState>
const originalState = useCanvasStore.getState()

function verdict(overrides: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  return AnalysisStateV1Schema.parse({
    run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
    requires_rerun: false, blocked_unusable: false, contradictions: [],
    ...overrides,
  })
}

function seed(overrides: Partial<StoreState> = {}): string {
  const report = mapV5AnalysisToReport(AnalysisResultBlockSchema.parse({
    type: 'analysis_result', summary: 'Options compared on the current model.', leading_option_id: null,
    win_probabilities: { opt_60: 0.44, opt_49: 0.56 },
    enrichment: { factor_sensitivity: [{ factor_id: 'fac_price', factor_label: 'Pro price', sensitivity_score: 0.8,
      interpretation: 'Price is an influential input on this run.' }] },
  }))
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({
    currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS].map(([id, label]) => ({ id, data: { label }, position: { x: 0, y: 0 } })),
    edges: [],
    runDelta: { delta: runChangeDelta(), analysisHash: hash, scenarioId: 'scn-1' },
    results: { status: 'complete', progress: 100, report, hash },
    analysisStateV1: verdict(),
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    hasCompletedFirstRun: true,
    ceeAnalysisReady: null,
    ...overrides,
  })
  return hash
}

beforeEach(() => {
  useCanvasStore.setState(originalState, true)
  // The mounted projection must never request anything, including on a gate transition.
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('This Compare test is offline'))
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState(originalState, true)
})

describe('the artefact mounted in the existing Compare body', () => {
  it('shows business edits and the pair limit, with science figures disclosed in result details', () => {
    const hash = seed()
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(true)
    expect(selectWinSharesWithheld(useCanvasStore.getState())).toBe(false)
    render(<CompareRunPairBody responseHash={hash} />)
    const artefact = screen.getByRole('region', { name: 'What changed between runs' })
    expect(artefact).toHaveAttribute('data-testid', RUN_CHANGE_ARTEFACT_TESTID)
    expect(artefact).toHaveAttribute('data-prior-run-id', 'run-a')
    expect(artefact).toHaveAttribute('data-current-run-id', 'run-b')
    const row = within(screen.getByRole('region', { name: 'What changed in the model' })).getByTestId(`${WHATS_CHANGED_TESTID}-input-row`)
    expect(row).toHaveTextContent('Pro price, Raise to £60')
    expect(row).toHaveTextContent('£59 → £60')
    // Reasoning's shared row; the wire fields it renders are named once, on its section.
    expect(row.closest('[data-wire-fields]')).toHaveAttribute('data-wire-fields', expect.stringContaining('run_delta.input_changes[].before'))
    expect(screen.queryByText('Raise to £60: supported by 41% → 44% of runs.')).toBeNull()
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByText('Raise to £60: supported by 41% → 44% of runs.')).toHaveAttribute(
      'data-wire-fields', expect.stringContaining('run_delta.win_probabilities[].current'),
    )
    expect(screen.getByTestId('compare-comparability')).toHaveTextContent('Whether a change to the model explains anything below cannot be established from this pair.')
    expect(artefact).not.toHaveTextContent('Price is an influential input on this run.')
    expect(screen.getByTestId(WHATS_CHANGED_TESTID)).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['absent pair', { runDelta: null }],
    ['another scenario', { currentScenarioId: 'scn-2' }],
    ['a local edit after the current verdict', { analysisFreshnessDirty: true }],
    ['an import hold', { importPendingServerRegistration: true }],
    ['no affirmative currentness', { analysisStateV1: null, analysisFreshness: null }],
    ['wire stale despite local fresh', { analysisStateV1: verdict({
      run_state: { kind: 'complete_stale', computed_at: '2026-09-30T13:09:00.000Z', cause: 'graph_changed' },
      requires_rerun: true, usable_for_chips: false,
    }) }],
    ['wire unconfirmed despite local fresh', { analysisStateV1: verdict({
      run_state: { kind: 'unknown_degraded', cause: 'store_unreadable' },
      usable_for_prose: false, usable_for_chips: false, usable_for_followup: false,
    }) }],
    ['wire current but requires a rerun', { analysisStateV1: verdict({ requires_rerun: true, usable_for_chips: false }) }],
    ['wire refused despite local fresh', { analysisStateV1: verdict({
      run_state: { kind: 'refused', reason_code: 'analysis_declined' },
      usable_for_prose: false, usable_for_chips: false, usable_for_followup: false,
    }) }],
  ] satisfies Array<[string, Partial<StoreState>]>)('%s leaves no artefact or placeholder title', (_name, overrides) => {
    const hash = seed(overrides)
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.queryByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeNull()
    expect(screen.queryByText('What changed between runs')).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it.each(['superseded-analysis', null, undefined])('an absent or superseded displayed hash (%s) refuses the pair', hash => {
    seed()
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.queryByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeNull()
    expect(screen.queryByText('What changed between runs')).toBeNull()
  })

  it('a pre-endpoint wire block leaves no card despite currentness and permitted results', () => {
    const hash = seed()
    const stored = useCanvasStore.getState().runDelta!
    useCanvasStore.setState({ runDelta: { ...stored, delta: runChangeDelta({
      endpoints: undefined, input_changes: undefined, input_coverage: undefined,
    }) } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.queryByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeNull()
    expect(screen.getByTestId(WHATS_CHANGED_TESTID)).toBeInTheDocument()
  })

  it('withdraws the whole card when the existing licence gate withholds the result', () => {
    const hash = seed()
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.getByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeInTheDocument()
    act(() => {
      const results = useCanvasStore.getState().results
      useCanvasStore.setState({
        analysisStateV1: verdict({ leader_claim: { permitted: false, withheld_reason: 'constraint_verdict_withheld' } }),
        results: { ...results, report: { ...results.report!, producer_leader_permission: {
          permitted: false, producer_cause: 'constraint_verdict_withheld',
        } } },
      })
    })
    expect(selectRunAffirmedCurrent(useCanvasStore.getState())).toBe(true)
    expect(selectWinSharesWithheld(useCanvasStore.getState())).toBe(true)
    expect(screen.queryByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeNull()
    expect(screen.queryByText('What changed between runs')).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('withdraws the card when a local edit invalidates a currently displayed pair', () => {
    const hash = seed()
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.getByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeInTheDocument()
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(screen.queryByTestId(RUN_CHANGE_ARTEFACT_TESTID)).toBeNull()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
