/**
 * Compare v2 visual pass (Compare tab design review, 5 Oct 2026): the words stay plain and the panel never says more than
 * the producer licensed. ⭐ #2747 re-scope 2 (DL ruling (A)): in C, Compare draws NO per-option share figure or row (the
 * glance's two-marker figures, their order and their canvas links went with it): CEE serves no share string or Run
 * licence. Interim limit; restore trigger: a CEE-served share string with its own Run licence (post-C), never worded as a
 * chance. The leader headline (in words), endpoints, reading note, input rows and Ask Olumi stay.
 *
 * Every row binds by IDENTITY (option id, row id), and every "shows nothing" assertion is paired with a control that
 * shows the same thing present in the neighbouring state, so an empty render cannot pass it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { compareAskDraft } from '../ComparePairSections'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'
import { buildRunDeltaView, type RunDeltaInputRow } from '../../../components/results/analysisNew/runDeltaView'
import { directionWords } from '../../../components/results/analysisNew/sections/WhatsChanged'

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
/** The removed figure block's own test id (`CompareSupportFigures`, deleted in #2747 re-scope 2). */
const COMPARE_SUPPORT_TESTID = 'compare-support'

beforeEach(() => {
  useCanvasStore.setState(original, true)
  useAskOlumiStore.setState(originalAsk, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus, highlight } : null))
  vi.mocked(useCanvasLight).mockReturnValue({ on: lightOn, off: lightOff })
  focus.mockClear(); lightOn.mockClear(); lightOff.mockClear(); vi.mocked(canvasLinkOfTarget).mockClear()
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useAskOlumiStore.setState(originalAsk, true) })

describe('C (DL ruling (A)): Compare draws no per-option share figure or row', () => {
  it.each([[undefined], ['clearly_ahead' as const]])('no figure block, marker, share or option row (band %s)', (band) => {
    const delta = runChangeDelta()
    // CONTROL: the pair carries both options' shares, so the absence is the surface's, not the fixture's.
    expect(buildRunDeltaView(delta, (id) => LABELS.get(id) ?? null).movements.map((m) => m.optionId)).toEqual(['opt_60', 'opt_49'])
    mount(delta, { band })
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    expect(screen.queryAllByTestId(`${COMPARE_SUPPORT_TESTID}-option`)).toEqual([])
    expect(document.querySelector('[data-marker]')).toBeNull()
    expect(screen.getByTestId('compare-run-pair').textContent).not.toMatch(/\b(?:41|44|59|56)%/)
    expect(headline().textContent).not.toMatch(/\d+%/)
  })
})

describe('Acceptance #87 5996584359: grammatical', () => {
  // #2747 re-scope 2 (DL ruling (A)): movementVerdictText went with its last caller (CompareSupportFigures); the grammar is
  // pinned on `directionWords`, the words `movementText` still says.
  it('a level movement reads "the same AS last time", never "the same than" (control: up/down keep "than")', () => {
    expect(directionWords({ direction: 'level' })).toBe('scored the same as last time')
    expect(directionWords({ direction: 'level' })).not.toContain('same than')
    expect(directionWords({ direction: 'up' })).toBe('scored higher than last time')
    expect(directionWords({ direction: 'down' })).toBe('scored lower than last time')
  })
})

describe('Canvas: change rows reach the graph through the shared link, by id', () => {
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

  it('leads with the two endpoints, then the headline, then the reading note (v3 artefact; no figures below it in C)', () => {
    mount(runChangeDelta())
    const times = screen.getByTestId('compare-run-times')
    // The RESULT heading (the inputs section has its own heading, Compare v3 rows).
    const heading = within(document.querySelector('[data-compare-section="headline"]') as HTMLElement).getByRole('heading')
    const note = screen.getByTestId('compare-comparability')
    const follows = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    expect(follows(times, heading)).toBe(true)
    expect(follows(heading, note)).toBe(true)
    // The panel's one note style: the reading note carries its ⓘ, like the inputs section's coverage note.
    expect(note.querySelector('svg[class*="lucide-info"]')).not.toBeNull()
    expect(times.querySelectorAll('[data-run-id]')[0]).toHaveTextContent(/^Earlier/)
    expect(times.querySelectorAll('[data-run-id]')[1]).toHaveTextContent(/^Latest/)
  })

  it('quotes only the rows the panel shows, then counts the rest', () => {
    const row = (subject: string) => ({ key: subject, kind: 'factor_value', subject, before: '1', after: '2', change: 'changed', field: 'value', linkLabels: null, strength: null } as unknown as RunDeltaInputRow)
    expect(compareAskDraft([row('A'), row('B')], 3)).toBe(
      'Help me understand what changed between these runs and what to investigate next.\n\nChanges recorded between the two runs:\n- A: 1 → 2\n- B: 1 → 2\n- and 1 more recorded change',
    )
    expect(compareAskDraft([], 0)).toBe('Help me understand what changed between these runs and what to investigate next.')
  })
})
