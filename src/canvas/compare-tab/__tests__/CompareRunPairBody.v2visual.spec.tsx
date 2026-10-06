/**
 * Compare v2 visual pass (Compare tab design review, 5 Oct 2026): the glance is a picture, the words stay plain, and
 * the picture never says more than the producer licensed.
 *
 * Every row binds by IDENTITY (option id, row id), and every "shows nothing" assertion is paired with a control that
 * shows the same thing present in the neighbouring state, so an empty render cannot pass it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { COMPARE_SUPPORT_TESTID, orderMovements } from '../CompareSupportFigures'
import { compareAskDraft } from '../ComparePairSections'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'
import type { RunDeltaInputRow, RunDeltaMovement } from '../../../components/results/analysisNew/runDeltaView'
import { movementVerdictText } from '../../../components/results/analysisNew/sections/WhatsChanged'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()
const originalAsk = useAskOlumiStore.getState()
const focus = vi.fn()
const highlight = vi.fn()
const lightOn = vi.fn()
const lightOff = vi.fn()

const LABELS = new Map([...RUN_CHANGE_LABELS, ['opt_a', 'Option A'], ['opt_b', 'Option B'], ['opt_c', 'Option C'], ['opt_d', 'Option D']])

function seed(delta: RunDelta, { nodeIds = [...LABELS.keys()], current = true, status = 'complete', band }: { nodeIds?: string[]; current?: boolean; status?: string; band?: 'clearly_ahead' } = {}): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.1, opt_49: 0.9 },
    // A producer separation band licenses designations; without one the verdict is `unknown` and they stay withheld.
    ...(band ? { enrichment: { decision_brief: { headline_banded: { band, leader_option_id: 'opt_49' } } } } : {}) })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: nodeIds.map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: LABELS.get(id) } })), edges: [],
    results: { status, progress: 100, report, hash },
    runDelta: { delta, analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }), analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: !current,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}
const mount = (delta: RunDelta, opts?: Parameters<typeof seed>[1]) => render(<CompareRunPairBody responseHash={seed(delta, opts)} />)
const headline = () => screen.getByRole('region', { name: 'What changed between runs' })
const optionRow = (id: string) => screen.getAllByTestId(`${COMPARE_SUPPORT_TESTID}-option`).find((el) => el.getAttribute('data-option-id') === id)!

beforeEach(() => {
  useCanvasStore.setState(original, true)
  useAskOlumiStore.setState(originalAsk, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus, highlight } : null))
  vi.mocked(useCanvasLight).mockReturnValue({ on: lightOn, off: lightOff })
  focus.mockClear(); lightOn.mockClear(); lightOff.mockClear(); vi.mocked(canvasLinkOfTarget).mockClear()
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useAskOlumiStore.setState(originalAsk, true) })

describe('the glance: a two-marker figure per option, plain words, no figures by default', () => {
  it('draws previous and latest markers for licensed movements and prints no share anywhere in the headline section', () => {
    mount(runChangeDelta())
    const raise = optionRow('opt_60')
    expect(within(raise).getByTestId(`${COMPARE_SUPPORT_TESTID}-figure`).querySelector('[data-marker="previous"]')!.getAttribute('style')).toContain('41%')
    expect(within(raise).getByTestId(`${COMPARE_SUPPORT_TESTID}-figure`).querySelector('[data-marker="latest"]')!.getAttribute('style')).toContain('44%')
    // Positions live in style only: no visible text in the section carries a percentage.
    expect(headline().textContent).not.toMatch(/\d+%/)
    expect(raise).toHaveTextContent('Scored higher than last time, beyond ordinary run-to-run variation.')
  })

  it('separates signal from within-noise on the connector itself: solid vs dashed, never a band', () => {
    mount(runChangeDelta())
    expect(within(optionRow('opt_60')).getByTestId(`${COMPARE_SUPPORT_TESTID}-figure`)).toHaveAttribute('data-connector', 'solid')
    expect(within(optionRow('opt_49')).getByTestId(`${COMPARE_SUPPORT_TESTID}-figure`)).toHaveAttribute('data-connector', 'dashed')
    expect(optionRow('opt_49')).toHaveTextContent('Scored lower than last time. Too small to tell apart from ordinary run-to-run movement.')
  })

  it('⛔ draws NO figure when the size is not qualified — the picture may not show what the words withhold (control: a qualified row in the same render keeps its figure)', () => {
    mount(runChangeDelta({ win_probabilities: [
      { option_id: 'opt_60', prior: 0.1, current: 0.9, noise_verdict: 'not_noise_qualified' },
      { option_id: 'opt_49', prior: 0.9, current: 0.1, noise_verdict: 'signal' },
    ] }))
    expect(within(optionRow('opt_60')).queryByTestId(`${COMPARE_SUPPORT_TESTID}-figure`)).toBeNull()
    expect(optionRow('opt_60')).toHaveTextContent('Scored higher than last time. This pair gives no basis for saying whether that is a real difference.')
    expect(within(optionRow('opt_49')).getByTestId(`${COMPARE_SUPPORT_TESTID}-figure`)).toBeInTheDocument()
  })

  it('withheld result permission draws no option figures at all (control: the same pair, permitted, draws them)', () => {
    const hash = seed(runChangeDelta())
    const results = useCanvasStore.getState().results
    useCanvasStore.setState({ results: { ...results, report: { ...results.report!, producer_leader_permission: { permitted: false, producer_cause: 'constraint_verdict_withheld' } } } })
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    cleanup()
    mount(runChangeDelta())
    expect(screen.getByTestId(COMPARE_SUPPORT_TESTID)).toBeInTheDocument()
  })
})

describe('Acceptance #87 5996584359: grammatical', () => {
  it('a level movement reads "the same AS last time", never "the same than" (control: up/down keep "than")', () => {
    expect(movementVerdictText({ direction: 'level', noiseVerdict: 'within_noise' })).toMatch(/^Scored the same as last time\. /)
    expect(movementVerdictText({ direction: 'level', noiseVerdict: 'within_noise' })).not.toContain('same than')
    expect(movementVerdictText({ direction: 'up', noiseVerdict: 'signal' })).toBe('Scored higher than last time, beyond ordinary run-to-run variation.')
  })
})

describe('options: the shared display order, three first, nothing silently dropped', () => {
  const four = runChangeDelta({ win_probabilities: [
    { option_id: 'opt_a', prior: 0.2, current: 0.1, noise_verdict: 'within_noise' },
    { option_id: 'opt_b', prior: 0.3, current: 0.4, noise_verdict: 'signal' },
    { option_id: 'opt_c', prior: 0.3, current: 0.3, noise_verdict: 'within_noise' },
    { option_id: 'opt_d', prior: 0.2, current: 0.05, noise_verdict: 'signal' },
  ] })

  it('orders by the latest share through sortOptionsForDisplay, and keeps the producer order when designations are withheld', () => {
    const m = (id: string, current: number) => ({ optionId: id, current }) as RunDeltaMovement
    const rows = [m('a', 0.1), m('b', 0.4), m('c', 0.3)]
    expect(orderMovements(rows, false).map((r) => r.optionId)).toEqual(['b', 'c', 'a'])
    expect(orderMovements(rows, true).map((r) => r.optionId)).toEqual(['a', 'b', 'c'])
  })

  it('shows three, and the disclosure counts the hidden options that moved beyond ordinary variation', () => {
    mount(four, { band: 'clearly_ahead' })
    expect(screen.getAllByTestId(`${COMPARE_SUPPORT_TESTID}-option`).map((el) => el.getAttribute('data-option-id'))).toEqual(['opt_b', 'opt_c', 'opt_a'])
    const more = screen.getByTestId(`${COMPARE_SUPPORT_TESTID}-more`)
    expect(more).toHaveTextContent('Show 1 more option (1 moved beyond ordinary run-to-run variation)')
    fireEvent.click(more)
    expect(screen.getAllByTestId(`${COMPARE_SUPPORT_TESTID}-option`)).toHaveLength(4)
  })

  it('a run that withholds designations keeps the producer order on screen (control for the ordered case above)', () => {
    mount(four)
    expect(screen.getAllByTestId(`${COMPARE_SUPPORT_TESTID}-option`).map((el) => el.getAttribute('data-option-id'))).toEqual(['opt_a', 'opt_b', 'opt_c'])
    expect(screen.getByTestId(`${COMPARE_SUPPORT_TESTID}-more`)).toHaveTextContent('Show 1 more option (1 moved beyond ordinary run-to-run variation)')
  })
})

describe('Canvas: option rows and change rows both reach the graph through the shared link, by id', () => {
  it('an option row lights and focuses its own node; an option with no node now offers no link', () => {
    mount(runChangeDelta(), { nodeIds: ['opt_60', 'fac_price'] })
    const raise = within(optionRow('opt_60')).getByRole('button', { name: 'Show on the canvas: Raise to £60' })
    expect(canvasLinkOfTarget).toHaveBeenCalledWith({ kind: 'node', id: 'opt_60' })
    fireEvent.mouseEnter(raise)
    expect(lightOn).toHaveBeenLastCalledWith(expect.objectContaining({ target: { kind: 'node', id: 'opt_60' } }))
    fireEvent.mouseLeave(raise)
    expect(lightOff).toHaveBeenCalledTimes(1)
    fireEvent.click(raise)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(within(optionRow('opt_49')).queryByRole('button')).toBeNull()
    expect(vi.mocked(canvasLinkOfTarget).mock.calls.some(([target]) => target?.id === 'opt_49')).toBe(false)
  })

  it('a change row is one keyboard-reachable control naming the whole change', () => {
    mount(runChangeDelta())
    const row = screen.getByTestId('analysis-new-whats-changed-input-row-focus')
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAccessibleName('Show on the canvas: Pro price, Raise to £60: £59 → £60')
  })
})

describe('Ask Olumi: offered only for the pair Olumi reads, with a capped editable draft', () => {
  it('is offered while the run is current (control) and withdrawn with a reason once the model has changed', () => {
    mount(runChangeDelta())
    expect(screen.getByRole('button', { name: 'Ask Olumi about this comparison' })).toBeInTheDocument()
    cleanup()
    mount(runChangeDelta(), { current: false })
    expect(screen.queryByRole('button', { name: 'Ask Olumi about this comparison' })).toBeNull()
    expect(screen.getByTestId('compare-ask-unavailable')).toHaveTextContent('You can ask Olumi about this comparison after the next run.')
  })

  it('says to wait while a run is in flight, never "after the next run"', () => {
    mount(runChangeDelta(), { status: 'streaming' })
    expect(screen.getByTestId('compare-ask-unavailable')).toHaveTextContent('You can ask Olumi about this comparison when the run finishes.')
  })

  it('says a Run is in progress above the pair it keeps showing, and only while the run is in flight', () => {
    mount(runChangeDelta(), { status: 'streaming' })
    const notice = screen.getByRole('status')
    expect(notice).toHaveAttribute('data-testid', 'compare-run-in-progress')
    expect(notice).toHaveTextContent('A Run is in progress. The comparison below is between the two runs before it.')
    // The notice leads: it sits above the headline section, and the previous pair stays on screen.
    const headline = document.querySelector('[data-compare-section="headline"]')!
    expect(notice.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByTestId('analysis-new-whats-changed-input-row').length).toBeGreaterThan(0)
    cleanup()
    mount(runChangeDelta())
    expect(screen.queryByTestId('compare-run-in-progress')).toBeNull()
  })

  it('quotes only the rows the panel shows, then counts the rest', () => {
    const row = (subject: string) => ({ key: subject, kind: 'factor_value', subject, before: '1', after: '2', change: 'changed', field: 'value', linkLabels: null, strength: null } as unknown as RunDeltaInputRow)
    expect(compareAskDraft([row('A'), row('B')], 3)).toBe(
      'Help me understand what changed between these runs and what to investigate next.\n\nChanges recorded between the two runs:\n- A: 1 → 2\n- B: 1 → 2\n- and 1 more recorded change',
    )
    expect(compareAskDraft([], 0)).toBe('Help me understand what changed between these runs and what to investigate next.')
  })
})
