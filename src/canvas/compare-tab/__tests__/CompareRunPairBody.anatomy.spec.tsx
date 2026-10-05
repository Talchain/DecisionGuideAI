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
import { PANEL_RULE } from '../../../components/results/analysisNew/panelSurfaces'
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
const runTimes = () => screen.getByTestId('compare-run-times')

beforeEach(() => {
  useCanvasStore.setState(original, true)
  useAskOlumiStore.setState(originalAsk, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation(target => target ? { target, focus, highlight } : null)
  vi.mocked(useCanvasLight).mockReturnValue({ on: lightOn, off: lightOff })
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline Compare spec'))
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useAskOlumiStore.setState(originalAsk, true) })

describe('Compare v1 anatomy and producer-only rendering', () => {
  it('orders the headline (with its ✦ Ask), then the canvas-linked inputs with the reading note, then result details — one change list, not two', () => {
    const { container } = mount()
    expect([...container.querySelectorAll('[data-compare-section]')].map(el => el.getAttribute('data-compare-section'))).toEqual(['headline', 'inputs'])
    expect(within(section('What changed between runs')).getByRole('button', { name: 'Ask Olumi about this comparison' })).toBeInTheDocument()
    expect(screen.getAllByTestId('analysis-new-whats-changed-input-row')).toHaveLength(1)
    // The details row follows the inputs: the last thing in the body.
    const details = screen.getByTestId('compare-result-details')
    expect(section('What you changed').compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('reads each section from the licensed producer pair and ignores current graph values and unrelated result prose', () => {
    const delta = runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'signal' } })
    const { container } = mount(delta)
    // Both leaders are named from the producer's own ids, once, in the headline.
    expect(screen.getByRole('heading', { name: 'In this model, the option that came out best changed from Keep £49 to Raise to £60' })).toBeInTheDocument()
    // Plain words: a run's raw identity is bound by data-run-id, never shown as text.
    expect(runTimes()).not.toHaveTextContent('run-a')
    expect(runTimes()).not.toHaveTextContent('run-b')
    expect(runTimes().querySelector('[data-run-id="run-a"]')).toHaveTextContent('Previous run')
    expect(runTimes().querySelector('[data-run-id="run-b"]')).toHaveTextContent('Latest run')
    expect([...runTimes().querySelectorAll('time')].map(t => t.getAttribute('datetime'))).toEqual([delta.endpoints!.prior.computed_at, delta.endpoints!.current.computed_at])
    expect(section('What you changed')).toHaveTextContent('Pro price, Raise to £60')
    expect(section('What you changed')).toHaveTextContent('£59 → £60')
    expect(screen.getByTestId('compare-comparability')).toHaveTextContent('Whether a change to the model explains anything below cannot be established from this pair.')
    expect(container.textContent).not.toMatch(/POISON|999999/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('states withheld-before to caveated-leader-after from independent producer IDs without claiming a switch', () => {
    mount(runChangeDelta({ leader: { changed: false, current_leading_option_id: 'opt_60', noise_verdict: 'not_noise_qualified' }, win_probabilities: [], win_probabilities_unavailable: 'prior_withheld' }))
    const hero = section('What changed between runs')
    expect(hero).toHaveTextContent('In this model, Raise to £60 came out best on the latest run; the previous run named no option')
    expect(hero).toHaveTextContent('This pair gives no basis for saying whether that is a real difference.')
    expect(hero).not.toHaveTextContent('changed')
    // No pair of figures: the producer's reason stands in the figures' place, and no details row promises figures.
    expect(hero).toHaveTextContent('The options can be compared for the first time.')
    expect(screen.queryByTestId('compare-result-details')).toBeNull()
  })

  it('renders a producer near tie as too close to call, never a named latest leader', () => {
    const hash = seed(runChangeDelta({ leader: { changed: false, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_49', noise_verdict: 'signal' } }))
    const results = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...results, report: { ...results.report!, robustness: { near_tie: { is_tie: true, top_option_id: 'opt_49' } } } } } as never)
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.getByRole('heading', { name: 'Too close to call in this model' })).toBeInTheDocument()
    // A near tie names no leader anywhere in the headline section.
    expect(section('What changed between runs')).not.toHaveTextContent('still the option put forward')
    expect(section('What changed between runs')).not.toHaveTextContent('put forward Keep £49')
    // Union, never replace: the model-relative words that replaced them (principle audit, 5 Oct).
    expect(section('What changed between runs')).not.toHaveTextContent('Keep £49 still came out best')
    expect(section('What changed between runs')).not.toHaveTextContent('came out best')
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
    expect(section('What changed between runs')).toHaveTextContent('Too close to call in this model')
  })

  it('withheld result permission hides named endpoints and every science share even on disclosure', () => {
    const hash = seed(runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'signal' } }))
    const results = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...results, report: { ...results.report!, producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' } } } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.getByRole('heading', { name: 'Result comparison not shown' })).toBeInTheDocument()
    // No option is named and no share is reachable: there is no details row to open.
    expect(screen.queryByText(/Keep £49|Raise to £60 is|put forward|came out best/)).toBeNull()
    expect(screen.queryByTestId('compare-result-details')).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(section('What you changed')).toHaveTextContent('£59 → £60')
  })

  it('never upgrades within-noise movement into an option tie', () => {
    mount(runChangeDelta({ leader: { changed: true, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_60', noise_verdict: 'within_noise' } }))
    expect(section('What changed between runs')).toHaveTextContent('In this model, the option that came out best changed from Keep £49 to Raise to £60')
    expect(section('What changed between runs')).toHaveTextContent('Too small to tell apart from ordinary run-to-run movement.')
    // Union, never replace: a regex, so neither the old nor the model-relative near-tie words slip through.
    expect(screen.queryByText(/too close to call/i)).toBeNull()
  })

  it('says an unchanged option as what came out best in this model, never as one a run puts forward', () => {
    mount(runChangeDelta({ leader: { changed: false, prior_leading_option_id: 'opt_49', current_leading_option_id: 'opt_49', noise_verdict: 'signal' } }))
    expect(screen.getByRole('heading', { name: 'In this model, Keep £49 still came out best' })).toBeInTheDocument()
    expect(section('What changed between runs')).not.toHaveTextContent('put forward')
  })

  it('renders missing endpoints, inputs and leader claims as absence, never a probability-based substitute', () => {
    mount(runChangeDelta({ endpoints: undefined, input_changes: undefined, input_coverage: undefined }))
    expect(runTimes()).toHaveTextContent('Previous run time not recorded · Latest run time not recorded')
    expect(section('What you changed')).toHaveTextContent('Input changes were not recorded for this pair.')
    expect(section('Result comparison')).toHaveTextContent('The latest run names no option')
    expect(screen.getByRole('heading', { name: 'The latest run names no option' })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Ask Olumi about this comparison' }))
    const ask = useAskOlumiStore.getState()
    expect(ask.isOpen).toBe(true)
    expect(ask.context).toContain('Previous run: run-a. Latest run: run-b.')
    expect(ask.context).toContain('This pair gives no basis for saying whether that is a real difference.')
    expect(ask.context).toContain('cannot be established from this pair')
    // The draft carries the changes the panel shows, as editable text. It is context, never a pair binding.
    expect(ask.draft).toBe('Help me understand what changed between these runs and what to investigate next.\n\nChanges recorded between the two runs:\n- Pro price, Raise to £60: £59 → £60')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('binds hover, keyboard focus and click by row ID despite duplicate labels, using the served Canvas API', () => {
    const hash = seed(runChangeDelta({ attribution_case: 'C1_attributable', pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true } }))
    const nodes = useCanvasStore.getState().nodes
    useCanvasStore.setState({ nodes: [{ ...nodes[0], id: 'decoy' }, ...nodes] })
    render(<CompareRunPairBody responseHash={hash} />)
    const button = within(section('What you changed')).getByTestId('analysis-new-whats-changed-input-row-focus')
    expect(button).toHaveAccessibleName('Show on the canvas: Pro price, Raise to £60: £59 → £60')
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
    expect(within(section('What you changed')).getByText(/^Another input, Keep £49: /)).toBeInTheDocument()
    expect(within(section('What you changed')).getAllByTestId('analysis-new-whats-changed-input-row')).toHaveLength(3)
  })


  it('binds an opaque link row by its endpoint IDs, with the pair route disabled when unattributable', () => {
    const hash = seed(runChangeDelta({ input_changes: [{ entity_kind: 'link', entity_id: 'opaque-link', field: 'strength', link: { from: 'fac_price', to: 'opt_60' }, before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' }] }))
    useCanvasStore.setState({ edges: [{ id: 'wrong-edge', source: 'fac_price', target: 'opt_49' }, { id: 'actual-edge', source: 'fac_price', target: 'opt_60' }] })
    render(<CompareRunPairBody responseHash={hash} />)
    const button = within(section('What you changed')).getByTestId('analysis-new-whats-changed-input-row-focus')
    expect(canvasLinkOfTarget).toHaveBeenCalledWith({ kind: 'edge', id: 'actual-edge' }, { route: false })
    fireEvent.mouseEnter(button)
    expect(lightOn).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: 'edge', id: 'actual-edge' } }))
    fireEvent.click(button)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(vi.mocked(canvasLinkOfTarget).mock.calls.some(([target]) => target?.id === 'wrong-edge')).toBe(false)
  })

  it('shows science input bands in plain words and never fabricates an exact value absent from the wire', () => {
    mount(runChangeDelta({ input_changes: [{ entity_kind: 'link', entity_id: 'opaque-link', field: 'strength', link: { from: 'fac_price', to: 'opt_60' }, before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed' }] }))
    // The shared link wording (`linkRowText`), the same sentence every surface prints.
    expect(section('What you changed')).toHaveTextContent('moderate → strong')
    expect(section('What you changed')).not.toHaveTextContent('0.5')
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-result-details-region')).not.toHaveTextContent('0.5')
  })

  it('is built from Reasoning\'s own parts: its measure, its rule, its heading row, its disclose row', () => {
    mount()
    // Reasoning's inner measure (AnalysisNewTabBody), owned by the body (`padding: 'self'`).
    expect(screen.getByTestId('compare-run-pair').className).toBe('px-4 pt-2 pb-4 space-y-4 max-w-[440px] mx-auto')
    // Sections are divided by the shared full-width rule, never boxed.
    expect(section('What you changed').className).toBe(PANEL_RULE)
    // The one headline uses Reasoning's section heading style; it is the only heading in the body.
    const heading = screen.getByRole('heading', { name: 'The latest run names no option' })
    expect(heading.className).toContain('text-sm font-medium')
    expect(heading.className).toContain('text-text-header')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    // CommitmentSummary's ✦: the shared PanelIconButton carrying the Olumi AI mark, beside the headline.
    const ask = screen.getByRole('button', { name: 'Ask Olumi about this comparison' })
    expect(ask).toHaveAttribute('data-ai', 'true')
    expect(heading.parentElement).toContainElement(ask)
    // The exact shares sit behind SectionShell's `disclose` row, closed by default.
    expect(screen.getByTestId('compare-result-details')).toHaveAttribute('data-section-open', 'false')
  })

  it('also respects advanced mode through the shared science gate', () => {
    const hash = seed()
    render(<DetailToggleContext.Provider value={{ showDetail: true }}><CompareRunPairBody responseHash={hash} /></DetailToggleContext.Provider>)
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByText('Raise to £60: 41% → 44% chance of leading.')).toBeInTheDocument()
  })
})
