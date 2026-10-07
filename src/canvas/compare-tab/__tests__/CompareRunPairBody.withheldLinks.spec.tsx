/**
 * Compare's "not shown" line names the unsized links and says "Set them" (Paul on prod, 7 Oct: the tab gave no way to).
 * Each link it names is one click to that link's own inspector (DL 7 Oct, interim before the goal-chance Compare).
 *
 * Bound by IDENTITY: the sentence under test is the shared one (`goalPathUnsizedCause`), never retyped here, and each
 * pressable phrase is checked against the link ends it opens. Every "pressable" row has a control that is not.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { goalPathUnsizedCause } from '../../../components/results/analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE } from '../../state/winShareGate'
import { openLinkInspector } from '../../utils/openEdgeStrengthEditor'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { withheldReasonSegments } from '../withheldReasonSegments'
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

function seed(permission: { permitted: boolean; producer_cause?: string }, links = FOUR.slice(0, 2)): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.1, opt_49: 0.9 } })
  report.producer_leader_permission = permission
  ;(report as { inference_warnings?: unknown }).inference_warnings = placeholderWarning(links)
  const hash = report.model_card.response_hash
  const labels = new Map([...RUN_CHANGE_LABELS, ...LINK_LABELS])
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...labels.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: labels.get(id) } })),
    edges: links.map((l) => ({ id: `e_${l.from}_${l.to}`, source: l.from, target: l.to })),
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

describe('Compare: "Set them" comes with a way to', () => {
  it('each named link in the not-shown line opens THAT link\'s inspector; the words are the shared sentence', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: false, producer_cause: 'goal_path_unsized' })} />)
    const line = screen.getByTestId('compare-withheld-reason')
    expect(line.textContent).toBe(goalPathUnsizedCause(placeholderWarning(FOUR.slice(0, 2)), labelOf))
    const buttons = within(line).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      'from ‘Feature Delivery Capacity’ to ‘meet our next feature-launch deadline’',
      'from ‘New-hire Onboarding Disruption’ to ‘Feature Delivery Capacity’',
    ])
    fireEvent.click(buttons[1])
    expect(vi.mocked(openLinkInspector)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openLinkInspector)).toHaveBeenCalledWith('f_onb', 'f_cap')
  })

  it('a not-shown line that names no link has no button (control: the unsized cause on the same pair has two)', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: false, producer_cause: 'constraint_verdict_withheld' })} />)
    const line = screen.getByTestId('compare-withheld-reason')
    expect(line.textContent).toBe(EXPLORATORY_REASON_LINE)
    expect(within(line).queryAllByRole('button')).toHaveLength(0)
    cleanup()
    render(<CompareRunPairBody responseHash={seed({ permitted: false, producer_cause: 'goal_path_unsized' })} />)
    expect(within(screen.getByTestId('compare-withheld-reason')).getAllByRole('button')).toHaveLength(2)
  })

  it('a permitted pair shows no not-shown line at all (control: withheld shows it)', () => {
    render(<CompareRunPairBody responseHash={seed({ permitted: true })} />)
    expect(screen.queryByTestId('compare-withheld-reason')).toBeNull()
  })
})
