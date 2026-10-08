/**
 * Compare's "not shown" line names the unsized links and says "Set them" (Paul on prod, 7 Oct: the tab gave no way to).
 * Each link it names is one checklist row, one click to that link's own inspector, ticked when the user has set it
 * (Paul's 8 Oct test, DL GO "A": the line alone was a dead end; it was inline presses, 7 Oct).
 *
 * Bound by IDENTITY: the sentence under test is the shared one (`goalPathUnsizedCause`), never retyped here, and each
 * pressable phrase is checked against the link ends it opens. Every "pressable" row has a control that is not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { goalPathUnsizedCause } from '../../../components/results/analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE } from '../../state/winShareGate'
import { openLinkInspector } from '../../utils/openEdgeStrengthEditor'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { withheldReasonSegments } from '../withheldReasonSegments'
import { SIZING_ALL_SET_TEXT, SIZING_NEXT_TEXT, SIZING_NOT_SET_TEXT, SIZING_SET_TEXT } from '../CompareSizingChecklist'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../utils/openEdgeStrengthEditor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/openEdgeStrengthEditor')>()),
  openLinkInspector: vi.fn(() => true),
}))
const original = useCanvasStore.getState()

const LINK_LABELS = new Map([
  ['f_cap', 'Feature Delivery Capacity'], ['g_launch', 'meet our next feature-launch deadline'],
  ['f_onb', 'New-hire Onboarding Disruption'], ['f_hires', 'Tech Lead Hires'], ['f_cost', 'Overlapping costs'],
])
const labelOf = (id: string): string | null => LINK_LABELS.get(id) ?? null
const placeholderWarning = (links: Array<{ from: string; to: string }>) =>
  [{ code: 'GOAL_FIGURES_PLACEHOLDER_PATH', node_ids: [links[0].from, links[0].to], links }]
const FOUR = [
  { from: 'f_cap', to: 'g_launch' }, { from: 'f_onb', to: 'f_cap' }, { from: 'f_hires', to: 'f_onb' }, { from: 'f_cost', to: 'g_launch' },
]
const joined = (segments: ReadonlyArray<{ text: string }>) => segments.map((s) => s.text).join('')
const linked = (segments: ReadonlyArray<{ link?: { fromId: string; toId: string } }>) => segments.flatMap((s) => (s.link ? [s.link] : []))

describe('withheldReasonSegments: the shared sentence, cut at the links it names', () => {
  it.each([
    ['one link', FOUR.slice(0, 1), FOUR.slice(0, 1)],
    ['two links', FOUR.slice(0, 2), FOUR.slice(0, 2)],
    ['four links: three named, "and 1 more" stays text', FOUR, FOUR.slice(0, 3)],
  ])('%s: rejoins to the sentence exactly, and each named link carries its own ends', (_name, links, named) => {
    const warnings = placeholderWarning(links)
    const sentence = goalPathUnsizedCause(warnings, labelOf)!
    expect(sentence).toContain('nobody has set yet')
    const segments = withheldReasonSegments(sentence, warnings, labelOf)
    expect(joined(segments)).toBe(sentence)
    expect(linked(segments)).toEqual(named.map((l) => ({ fromId: l.from, toId: l.to })))
  })

  it('the count form (only the first link has both labels) presses the first link only', () => {
    const links = [FOUR[0], { from: 'unlabelled_a', to: 'unlabelled_b' }, FOUR[2]]
    const warnings = placeholderWarning(links)
    const sentence = goalPathUnsizedCause(warnings, labelOf)!
    expect(sentence).toContain('and 2 other links on the way')
    const segments = withheldReasonSegments(sentence, warnings, labelOf)
    expect(joined(segments)).toBe(sentence)
    expect(linked(segments)).toEqual([{ fromId: 'f_cap', toId: 'g_launch' }])
  })

  it('a reason that names no link stays one plain segment (control: the same warnings with the unsized sentence press)', () => {
    const warnings = placeholderWarning(FOUR.slice(0, 1))
    expect(withheldReasonSegments(EXPLORATORY_REASON_LINE, warnings, labelOf)).toEqual([{ text: EXPLORATORY_REASON_LINE }])
    expect(linked(withheldReasonSegments(goalPathUnsizedCause(warnings, labelOf)!, warnings, labelOf))).toHaveLength(1)
  })
})

type EdgeSeed = { from: string; to: string; data?: Record<string, unknown> }
/** `links` = the Run's warning list; `edges` = the canvas now (default: those links, no sizing recorded). */
function seed(permission: { permitted: boolean; producer_cause?: string }, links = FOUR.slice(0, 2), edges: EdgeSeed[] = links): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.1, opt_49: 0.9 } })
  report.producer_leader_permission = permission
  ;(report as { inference_warnings?: unknown }).inference_warnings = placeholderWarning(links)
  const hash = report.model_card.response_hash
  const labels = new Map([...RUN_CHANGE_LABELS, ...LINK_LABELS])
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...labels.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: labels.get(id) } })),
    edges: edges.map((l) => ({ id: `e_${l.from}_${l.to}`, source: l.from, target: l.to, ...(l.data ? { data: l.data } : {}) })),
    results: { status: 'complete', progress: 100, report, hash },
    runDelta: { delta: runChangeDelta(), analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }), analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}

beforeEach(() => { useCanvasStore.setState(original, true); vi.mocked(openLinkInspector).mockClear() })
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

const USER_SET = { weight: 0.6, weightSource: 'user' }
/** The control for USER_SET: the same number, but CEE's. A value predicate would tick it; provenance must not. */
const CEE_SAME_VALUE = { weight: 0.6, weightSource: 'cee' }
const PLACEHOLDER = { weight: 0.5, weightSource: 'cee', strengthPlaceholder: 0.5 }
const STATED = { weight: 0.6, weightSource: 'cee', strengthStated: 0.6 }
const UNSIZED = { permitted: false, producer_cause: 'goal_path_unsized' }
const rowsOf = () => screen.queryAllByTestId('compare-sizing-row')
const endsOf = (rows: HTMLElement[]) => rows.map((r) => `${r.dataset.from}->${r.dataset.to}`)

describe('Compare: "Set them" comes with a way to', () => {
  it('each named link is a row whose press opens THAT link\'s inspector; the line is the shared sentence, with no press of its own', () => {
    render(<CompareRunPairBody responseHash={seed(UNSIZED)} />)
    const line = screen.getByTestId('compare-withheld-reason')
    expect(line.textContent).toBe(goalPathUnsizedCause(placeholderWarning(FOUR.slice(0, 2)), labelOf))
    expect(within(line).queryAllByRole('button')).toHaveLength(0)
    const presses = rowsOf().map((r) => within(r).getByRole('button'))
    expect(presses.map((b) => b.textContent)).toEqual([
      'Set strength: from ‘Feature Delivery Capacity’ to ‘meet our next feature-launch deadline’',
      'Set strength: from ‘New-hire Onboarding Disruption’ to ‘Feature Delivery Capacity’',
    ])
    fireEvent.click(presses[1])
    expect(vi.mocked(openLinkInspector)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openLinkInspector)).toHaveBeenCalledWith('f_onb', 'f_cap')
  })

  it('a not-shown line that names no link has no checklist (control: the unsized cause on the same pair has two rows)', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: false, producer_cause: 'constraint_verdict_withheld' })} />)
    const line = screen.getByTestId('compare-withheld-reason')
    expect(line.textContent).toBe(EXPLORATORY_REASON_LINE)
    expect(within(line).queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryByTestId('compare-sizing')).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed(UNSIZED)} />)
    expect(rowsOf()).toHaveLength(2)
  })

  it('a placeholder link CEE did not name gets no row (control: the same link in the warning gets one)', () => {
    const named = FOUR.slice(0, 2)
    const extra = { ...FOUR[3], data: PLACEHOLDER }
    render(<CompareRunPairBody responseHash={seed(UNSIZED, named, [...named, extra])} />)
    expect(endsOf(rowsOf())).toEqual(['f_cap->g_launch', 'f_onb->f_cap'])
    cleanup()
    render(<CompareRunPairBody responseHash={seed(UNSIZED, [...named, FOUR[3]], [...named, extra])} />)
    expect(endsOf(rowsOf())).toEqual(['f_cap->g_launch', 'f_onb->f_cap', 'f_cost->g_launch'])
  })

  it('the tick is the stored provenance: the user\'s own strength or their stated figure (control: the same number, CEE\'s, stays unset)', () => {
    const [a, b] = FOUR
    render(<CompareRunPairBody responseHash={seed(UNSIZED, [a, b], [{ ...a, data: USER_SET }, { ...b, data: CEE_SAME_VALUE }])} />)
    expect(rowsOf().map((r) => r.dataset.state)).toEqual(['set', 'not_set'])
    expect(rowsOf().map((r) => within(r).getByTestId('compare-sizing-state').textContent)).toEqual([SIZING_SET_TEXT, SIZING_NOT_SET_TEXT])
    expect(screen.getByTestId('compare-sizing-count').textContent).toBe('1 of 2 set')
    cleanup()
    render(<CompareRunPairBody responseHash={seed(UNSIZED, [a, b], [{ ...a, data: STATED }, { ...b, data: PLACEHOLDER }])} />)
    expect(rowsOf().map((r) => r.dataset.state)).toEqual(['set', 'not_set'])
  })

  it('a sizing edit after the Run ticks its row; when every listed link is set it says to re-run', () => {
    const [a, b] = FOUR
    render(<CompareRunPairBody responseHash={seed(UNSIZED, [a, b])} />)
    expect(screen.queryByTestId('compare-sizing-all-set')).toBeNull()
    act(() => { useCanvasStore.setState({ edges: [a, b].map((l) => ({ id: `e_${l.from}_${l.to}`, source: l.from, target: l.to, data: USER_SET })) } as never) })
    expect(rowsOf().map((r) => r.dataset.state)).toEqual(['set', 'set'])
    expect(screen.getByTestId('compare-sizing-all-set').textContent).toBe(SIZING_ALL_SET_TEXT)
  })

  it('a link the sentence only counts is counted, not listed: "All set" waits for it (control: set it too)', () => {
    // Four listed, three named, "and 1 more" (Science's cap): the fourth has no row but is in the count.
    const sized = (data: Record<string, unknown> | undefined) => FOUR.map((l, i) => ({ ...l, data: i < 3 ? USER_SET : data }))
    render(<CompareRunPairBody responseHash={seed(UNSIZED, FOUR, sized(undefined))} />)
    expect(endsOf(rowsOf())).toEqual(['f_cap->g_launch', 'f_onb->f_cap', 'f_hires->f_onb'])
    expect(screen.getByTestId('compare-sizing-count').textContent).toBe('3 of 4 set')
    expect(screen.queryByTestId('compare-sizing-all-set')).toBeNull()
    expect(screen.getByTestId('compare-sizing-next').textContent).toBe(SIZING_NEXT_TEXT)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(UNSIZED, FOUR, sized(USER_SET))} />)
    expect(screen.getByTestId('compare-sizing-count').textContent).toBe('4 of 4 set')
    expect(screen.getByTestId('compare-sizing-all-set').textContent).toBe(SIZING_ALL_SET_TEXT)
  })

  it('a named link no longer on the canvas says so and has no press (control: the one still there has one)', () => {
    const [a, b] = FOUR
    render(<CompareRunPairBody responseHash={seed(UNSIZED, [a, b], [a])} />)
    const [here, gone] = rowsOf()
    expect(gone.dataset.state).toBe('off_canvas')
    expect(within(gone).queryByRole('button')).toBeNull()
    expect(within(here).getByRole('button')).toBeTruthy()
  })

  it('a permitted pair shows no not-shown line and no checklist (control: withheld shows both)', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: true })} />)
    expect(screen.queryByTestId('compare-withheld-reason')).toBeNull()
    expect(screen.queryByTestId('compare-sizing')).toBeNull()
  })
})
