import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { DetailToggleContext } from '../../components/model-tab/DetailToggleContext'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()
const originalAsk = useAskOlumiStore.getState()
const focus = vi.fn()
const highlight = vi.fn()
const lightOn = vi.fn()
const lightOff = vi.fn()

function seed(delta: RunDelta = runChangeDelta()): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'POISON unrelated result narrative',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.1, opt_49: 0.9 } })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS].map(([id, label]) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label, observed_state: { value: 999999 } } })), edges: [],
    results: { status: 'complete', progress: 100, report, hash },
    runDelta: { delta, analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }), analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  })
  return hash
}
function mount(delta?: RunDelta) { return render(<CompareRunPairBody responseHash={seed(delta)} />) }
const section = (name: string) => screen.getByRole('region', { name })

beforeEach(() => {
  useCanvasStore.setState(original, true)
  useAskOlumiStore.setState(originalAsk, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation(target => target ? { target, focus, highlight } : null)
  vi.mocked(useCanvasLight).mockReturnValue({ on: lightOn, off: lightOff })
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline Compare spec'))
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useAskOlumiStore.setState(originalAsk, true) })

describe('Compare v1 anatomy and producer-only rendering', () => {
  it('orders headline, endpoints, exact inputs, qualification, Ask Olumi, then canvas rows', () => {
    const { container } = mount()
    expect([...container.querySelectorAll('[data-compare-section]')].map(el => el.getAttribute('data-compare-section'))).toEqual([
      'headline', 'endpoints', 'inputs', 'qualification', 'ask', 'canvas',
    ])
  })

  it('reads each section from the licensed producer pair and ignores current graph values and unrelated result prose', () => {
    const delta = runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'signal' } })
    const { container } = mount(delta)
    expect(section('What changed between runs')).toHaveTextContent('The option put forward changed')
    const endpoints = section('Previous and latest runs')
    // Plain words: a run's raw identity is bound by data-run-id, never shown as text.
    expect(endpoints).not.toHaveTextContent('run-a')
    expect(endpoints).not.toHaveTextContent('run-b')
    expect(endpoints).toHaveTextContent('Keep £49 · put forward by this run')
    expect(endpoints).toHaveTextContent('Raise to £60 · put forward by this run')
    expect(within(endpoints).getByText('Previous run').parentElement).toHaveAttribute('data-run-id', 'run-a')
    expect(within(endpoints).getByText('Latest run').parentElement).toHaveAttribute('data-run-id', 'run-b')
    expect([...endpoints.querySelectorAll('time')].map(t => t.getAttribute('datetime'))).toEqual([delta.endpoints!.prior.computed_at, delta.endpoints!.current.computed_at])
    expect(section('What you changed')).toHaveTextContent('Pro price, Raise to £60: £59 → £60')
    expect(section('How to read this comparison')).toHaveTextContent('Whether a change to the model explains anything below cannot be established from this pair.')
    expect(container.textContent).not.toMatch(/POISON|999999/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('states withheld-before to caveated-leader-after from independent producer IDs without claiming a switch', () => {
    mount(runChangeDelta({ leader: { changed: false, current_leading_option_id: 'opt_60', noise_verdict: 'not_noise_qualified' }, win_probabilities: [], win_probabilities_unavailable: 'prior_withheld' }))
    const hero = section('What changed between runs')
    expect(hero).toHaveTextContent('The latest run puts forward Raise to £60; the previous run did not put one forward')
    expect(hero).toHaveTextContent('This pair gives no basis for saying whether that is a real difference.')
    expect(hero).not.toHaveTextContent('changed')
    expect(section('Previous and latest runs')).toHaveTextContent('No option put forward')
    expect(section('How to read this comparison')).toHaveTextContent('The options can be compared for the first time.')
  })

  it('renders a producer near tie as too close to call, never a named latest leader', () => {
    const hash = seed(runChangeDelta({ leader: { changed: false, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_49', noise_verdict: 'signal' } }))
    const results = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...results, report: { ...results.report!, robustness: { near_tie: { is_tie: true, top_option_id: 'opt_49' } } } } } as never)
    render(<CompareRunPairBody responseHash={hash} />)
    expect(section('What changed between runs')).toHaveTextContent('Too close to call')
    const latest = within(section('Previous and latest runs')).getByText('Latest run').parentElement!
    expect(latest).toHaveTextContent('Too close to call')
    expect(latest).not.toHaveTextContent('put forward by this run')
  })


  it('renders a mapped producer very-close band as too close to call on the live-shaped result path', () => {
    const hash = seed()
    const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared', leading_option_id: null,
      win_probabilities: { opt_60: 0.49, opt_49: 0.51 },
      enrichment: { decision_brief: { headline_banded: { band: 'very_close', leader_option_id: 'opt_49' } } },
    })
    report.producer_leader_permission = { permitted: true }
    useCanvasStore.setState({ results: { ...useCanvasStore.getState().results, report, hash } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(section('What changed between runs')).toHaveTextContent('Too close to call')
  })

  it('withheld result permission hides named endpoints and every science share even on disclosure', () => {
    const hash = seed(runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'signal' } }))
    const results = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...results, report: { ...results.report!, producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' } } } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(within(section('Previous and latest runs')).getAllByText('Option put forward not shown')).toHaveLength(2)
    expect(section('Previous and latest runs')).not.toHaveTextContent('put forward by this run')
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-result-details-region')).not.toHaveTextContent('%')
    expect(section('What you changed')).toHaveTextContent('£59 → £60')
  })

  it('never upgrades within-noise movement into an option tie', () => {
    mount(runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'within_noise' } }))
    expect(section('What changed between runs')).toHaveTextContent('The option put forward changed')
    expect(section('What changed between runs')).toHaveTextContent('Too small to tell apart from ordinary run-to-run movement.')
    expect(screen.queryByText('Too close to call')).toBeNull()
  })

  it('renders missing endpoints, inputs and leader claims as absence, never a probability-based substitute', () => {
    mount(runChangeDelta({ endpoints: undefined, input_changes: undefined, input_coverage: undefined }))
    expect(within(section('Previous and latest runs')).getAllByText('Run time not recorded')).toHaveLength(2)
    expect(section('What you changed')).toHaveTextContent('Input changes were not recorded for this pair.')
    expect(section('Result comparison')).toHaveTextContent('The latest run does not put an option forward')
    expect(screen.getByRole('heading', { name: 'The latest run does not put an option forward' })).toBeInTheDocument()
    expect(section('Previous and latest runs')).not.toHaveTextContent('put forward by this run')
    expect(screen.queryByText('Both runs used the same input values.')).toBeNull()
    expect(screen.queryByText('0%')).toBeNull()
  })

  it('keeps business quantities visible and hides science numerics until result disclosure', () => {
    mount()
    expect(section('What you changed')).toHaveTextContent('£59 → £60')
    expect(screen.queryByText(/41%.*44%/)).toBeNull()
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByText('Raise to £60: 41% → 44% chance of leading.')).toBeInTheDocument()
    expect(screen.getByText('Keep £49: 59% → 56% chance of leading.')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.queryByText(/41%.*44%/)).toBeNull()
  })

  it('keeps the not-noise-qualified magnitude withheld even on disclosure', () => {
    mount(runChangeDelta({ win_probabilities: [{ option_id: 'opt_60', prior: 0.1, current: 0.9, noise_verdict: 'not_noise_qualified' }] }))
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-result-details-region')).not.toHaveTextContent('10%')
    expect(screen.getByTestId('compare-result-details-region')).toHaveTextContent('This pair gives no basis for saying whether that is a real difference.')
  })

  it('opens the existing editable Ask Olumi draft only on user click, with producer pair context', () => {
    mount()
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Ask Olumi' }))
    const ask = useAskOlumiStore.getState()
    expect(ask.isOpen).toBe(true)
    expect(ask.context).toContain('Previous run: run-a. Latest run: run-b.')
    expect(ask.context).toContain('This pair gives no basis for saying whether that is a real difference.')
    expect(ask.context).toContain('cannot be established from this pair')
    expect(ask.draft).toBe('Help me understand what changed between these runs and what to investigate next.')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('binds hover, keyboard focus and click by row ID despite duplicate labels, using the served Canvas API', () => {
    const hash = seed(runChangeDelta({ attribution_case: 'C1_attributable', pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true } }))
    const nodes = useCanvasStore.getState().nodes
    useCanvasStore.setState({ nodes: [{ ...nodes[0], id: 'decoy' }, ...nodes] })
    render(<CompareRunPairBody responseHash={hash} />)
    const button = within(section('Changes on the canvas')).getByRole('button')
    expect(canvasLinkOfTarget).toHaveBeenCalledWith({ kind: 'node', id: 'opt_60' }, { route: true })
    expect(canvasLinkOfTarget).toHaveBeenCalledWith({ kind: 'node', id: 'opt_60' })
    fireEvent.mouseEnter(button)
    expect(lightOn).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: 'node', id: 'opt_60' } }))
    fireEvent.mouseLeave(button)
    expect(lightOff).toHaveBeenCalledTimes(1)
    fireEvent.focus(button)
    expect(lightOn).toHaveBeenCalledTimes(2)
    fireEvent.blur(button)
    expect(lightOff).toHaveBeenCalledTimes(2)
    fireEvent.click(button)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(vi.mocked(canvasLinkOfTarget).mock.calls.some(([target]) => target?.id === 'decoy')).toBe(false)
  })

  it('keeps every producer input reachable in order beyond the two-row preview', () => {
    const delta = runChangeDelta()
    mount(runChangeDelta({ input_changes: [delta.input_changes![0], { ...delta.input_changes![0], option_id: 'opt_49' }, { ...delta.input_changes![0], entity_id: 'other', label_after: 'Another input', option_id: 'opt_49' }] }))
    expect(within(section('What you changed')).queryByText(/Another input/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'See all 3 changes' }))
    expect(within(section('What you changed')).getByText('Another input, Keep £49: £59 → £60')).toBeInTheDocument()
    expect(within(section('Changes on the canvas')).getAllByRole('listitem')).toHaveLength(3)
  })


  it('binds an opaque link row by its endpoint IDs, with the pair route disabled when unattributable', () => {
    const hash = seed(runChangeDelta({ input_changes: [{ entity_kind: 'link', entity_id: 'opaque-link', field: 'strength', link: { from: 'fac_price', to: 'opt_60' }, before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' }] }))
    useCanvasStore.setState({ edges: [{ id: 'wrong-edge', source: 'fac_price', target: 'opt_49' }, { id: 'actual-edge', source: 'fac_price', target: 'opt_60' }] })
    render(<CompareRunPairBody responseHash={hash} />)
    const button = within(section('Changes on the canvas')).getByRole('button')
    expect(canvasLinkOfTarget).toHaveBeenCalledWith({ kind: 'edge', id: 'actual-edge' }, { route: false })
    fireEvent.mouseEnter(button)
    expect(lightOn).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: 'edge', id: 'actual-edge' } }))
    fireEvent.click(button)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(vi.mocked(canvasLinkOfTarget).mock.calls.some(([target]) => target?.id === 'wrong-edge')).toBe(false)
  })

  it('shows science input bands in plain words and never fabricates an exact value absent from the wire', () => {
    mount(runChangeDelta({ input_changes: [{ entity_kind: 'link', entity_id: 'opaque-link', field: 'strength', link: { from: 'fac_price', to: 'opt_60' }, before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' }] }))
    expect(section('What you changed')).toHaveTextContent('moderate → strong')
    expect(section('What you changed')).not.toHaveTextContent('0.5')
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-result-details-region')).not.toHaveTextContent('0.5')
  })

  it('retains neutral Reasoning surfaces, panel typography and the existing SectionShell', () => {
    const { container } = mount()
    for (const el of container.querySelectorAll('[data-compare-section]')) {
      expect(el.className).toBe('border-b py-3 border-panel-border')
    }
    expect(screen.getByTestId('compare-result-details')).toHaveAttribute('data-section-open', 'false')
    expect(screen.getByRole('heading', { name: 'The latest run does not put an option forward' }).className).toContain('text-sm font-medium')
    expect(screen.getByRole('button', { name: 'Ask Olumi' }).querySelector('svg')).toHaveClass('w-3', 'h-3')
  })

  it('also respects advanced mode through the shared science gate', () => {
    const hash = seed()
    render(<DetailToggleContext.Provider value={{ showDetail: true }}><CompareRunPairBody responseHash={hash} /></DetailToggleContext.Provider>)
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByText('Raise to £60: 41% → 44% chance of leading.')).toBeInTheDocument()
  })
})
