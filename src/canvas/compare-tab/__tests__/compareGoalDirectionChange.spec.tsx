/**
 * ⛔ A PAIR WHOSE GOAL CHANGED DIRECTION OR COMPARISON COMPARES TWO DIFFERENT QUESTIONS (red team #87 6003625586,
 * 5 Oct 2026, UI 4fdc6233 · CEE ba4759a).
 *
 * After the user set the goal to "at most" and re-ran, Compare kept Run 1 (maximise) beside Run 2 (minimise) and said
 * "Scored higher than last time, beyond ordinary run-to-run variation" per option. Run 1's support is "which option
 * scored highest", Run 2's is "which came out lowest": the producer still pairs them by option id, but a higher/lower
 * or beyond-variation verdict across the two is a direction artefact. So no option has a comparable pair, the
 * per-option movements are withheld, ONE line says why, and the goal's own input row still says what changed.
 *
 * Bound by identity: `entity_kind: 'goal'` with `field` `direction` or `operator` (schemas 0.77 `RunInputField`).
 * Controls: a goal TARGET change and a LIMIT's comparison change keep every verdict.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { useAskOlumiStore } from '../../../components/results/coaching/askOlumiStore'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { noPairsText, WHATS_CHANGED_GOAL_FRAMING_CHANGED } from '../../../components/results/analysisNew/sections/WhatsChanged'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()
const originalAsk = useAskOlumiStore.getState()

function seed(delta: RunDelta): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.1, opt_49: 0.9 } })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS].map(([id, label]) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label } })), edges: [],
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
const mount = (delta: RunDelta) => render(<CompareRunPairBody responseHash={seed(delta)} />)
const hero = () => screen.getByRole('region', { name: 'What changed between runs' })

/** The red team's served pair: "at most 400" sent both the comparison and the direction. */
const GOAL_DIRECTION_ROW = {
  entity_kind: 'goal', entity_id: 'goal_1', field: 'direction', label_before: 'Monthly cancellations', label_after: 'Monthly cancellations',
  before: { raw: 'maximise' }, after: { raw: 'minimise' }, change: 'changed',
} as const
const GOAL_OPERATOR_ROW = {
  entity_kind: 'goal', entity_id: 'goal_1', field: 'operator', label_before: 'Monthly cancellations', label_after: 'Monthly cancellations',
  before: { raw: '>=' }, after: { raw: '<=' }, change: 'changed',
} as const
const flipped = (rows: RunDelta['input_changes']) => runChangeDelta({ input_changes: rows })

// The fixture's default pair: opt_60 0.41 → 0.44 `signal`, opt_49 0.59 → 0.56 `within_noise`.
const SIGNAL_VERDICT = 'Scored higher than last time, beyond ordinary run-to-run variation.'

beforeEach(() => {
  useCanvasStore.setState(original, true)
  useAskOlumiStore.setState(originalAsk, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation(target => target ? { target, focus: vi.fn(), highlight: vi.fn() } : null)
  vi.mocked(useCanvasLight).mockReturnValue({ on: vi.fn(), off: vi.fn() })
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline Compare spec'))
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useAskOlumiStore.setState(originalAsk, true) })

describe('Compare across a goal that changed direction or comparison', () => {
  it('the line is real words, so an assertion on it can fail', () => {
    expect(WHATS_CHANGED_GOAL_FRAMING_CHANGED.length).toBeGreaterThan(20)
    expect(WHATS_CHANGED_GOAL_FRAMING_CHANGED).not.toMatch(/beyond ordinary run-to-run variation|higher|lower/i)
  })

  it.each([
    ['direction + comparison (the served "at most" pair)', [GOAL_OPERATOR_ROW, GOAL_DIRECTION_ROW]],
    ['direction only', [GOAL_DIRECTION_ROW]],
    ['comparison only', [GOAL_OPERATOR_ROW]],
  ] as const)('%s: no per-option verdict, marker or figure; ONE line; the goal row still says what changed', (_case, rows) => {
    mount(flipped([...rows]))
    expect(hero()).not.toHaveTextContent('beyond ordinary run-to-run variation')
    expect(hero()).not.toHaveTextContent(/Scored (higher|lower|the same)/)
    expect(screen.queryByTestId('compare-support')).toBeNull()
    expect(screen.queryByTestId('compare-result-details')).toBeNull()
    expect(hero()).toHaveTextContent(WHATS_CHANGED_GOAL_FRAMING_CHANGED)
    expect(screen.getAllByText(WHATS_CHANGED_GOAL_FRAMING_CHANGED)).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'What you changed' })).toHaveTextContent(rows.some(r => r.field === 'direction') ? 'Goal direction' : 'Goal comparison')
  })

  it.each([
    ['same direction, goal TARGET changed', { ...GOAL_DIRECTION_ROW, field: 'target', before: { raw: 400 }, after: { raw: 350 } }],
    ['same direction, a LIMIT\'s comparison changed', { ...GOAL_OPERATOR_ROW, entity_kind: 'constraint', entity_id: 'lim_1' }],
  ] as const)('CONTROL %s: the per-option verdicts stand and the line is absent', (_case, row) => {
    mount(flipped([row]))
    expect(screen.getByTestId('compare-support')).toBeInTheDocument()
    expect(hero()).toHaveTextContent(SIGNAL_VERDICT)
    expect(hero()).not.toHaveTextContent(WHATS_CHANGED_GOAL_FRAMING_CHANGED)
  })

  it('the view every surface reads withholds the pairs, so the canvas strip and the Analysis tab say the same line', () => {
    const view = buildRunDeltaView(flipped([GOAL_DIRECTION_ROW]), id => RUN_CHANGE_LABELS.get(id) ?? null)
    expect(view.movements).toEqual([])
    expect(view.movementsUnavailable).toBe(true)
    expect(view.goalFramingChanged).toBe(true)
    expect(noPairsText(view)).toBe(WHATS_CHANGED_GOAL_FRAMING_CHANGED)
    // Control: the same builder on a same-direction pair keeps the producer's two movements.
    const same = buildRunDeltaView(runChangeDelta(), id => RUN_CHANGE_LABELS.get(id) ?? null)
    expect(same.movements.map(m => m.optionId)).toEqual(['opt_60', 'opt_49'])
    expect(same.goalFramingChanged).toBeUndefined()
  })
})
