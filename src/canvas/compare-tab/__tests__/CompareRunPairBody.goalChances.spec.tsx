/**
 * Compare-chance (schemas 0.81.0 `run_delta.goal_chances`; lease #87 6035414740). The reader still carries the producer's
 * goal chances by identity (first block). ⭐ DL ruling, 20 Oct 2026 (superseding #2747 re-scope 2 (A)'s interim "Compare shows
 * no goal chance"): Compare shows each option's goal chance ONLY as the chance gate passes it (`pairChanceFigures`: this
 * run's side from the canonical view, the earlier run's from run_delta's own licensed side). No run share figure, and no
 * figure the gate did not pass (run_delta's own current side included), ever reaches the screen.
 *
 * Bound by IDENTITY (option ids, producer order); every "absent" row has a present control (the reader's own rows).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import type { RunDelta, RunDeltaGoalChanceDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import { pairChanceFigures, runViewOf } from '../../runView/runView'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { useCanonicalAnalysisViewStore } from '../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../runView/canonicalAnalysisView'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()

// Producer (model) order is opt_49 THEN opt_60, deliberately NOT descending latest chance (15% before 47%).
const GOAL_CHANCES: RunDeltaGoalChanceDelta[] = [
  { option_id: 'opt_49', prior: { kind: 'point', pct: 47, rounding: 'whole' }, current: { kind: 'point', pct: 15, rounding: 'whole' } },
  { option_id: 'opt_60', prior: { kind: 'not_recorded' }, current: { kind: 'range', low_pct: 20, high_pct: 40, low_rounding: 'whole', high_rounding: 'nearest_5' } },
]
const withGoal = (overrides: Partial<RunDelta> = {}) => runChangeDelta({ goal_chances: GOAL_CHANCES, ...overrides })
/** Every figure the pair holds: its goal chances (47, 15, 20–40) and both Runs' shares (41/44, 59/56). */
const PAIR_FIGURES = /\b(?:47|15|20|40|41|44|59|56)%/

describe('the view carries the producer\'s goal chances by identity', () => {
  const labelFor = (id: string) => RUN_CHANGE_LABELS.get(id) ?? null
  it('in producer order, with labels (control: a pre-0.81 delta carries none)', () => {
    expect(buildRunDeltaView(withGoal(), labelFor).goalChances).toEqual([
      { optionId: 'opt_49', label: 'Keep £49', prior: GOAL_CHANCES[0].prior, current: GOAL_CHANCES[0].current },
      { optionId: 'opt_60', label: 'Raise to £60', prior: GOAL_CHANCES[1].prior, current: GOAL_CHANCES[1].current },
    ])
    expect(buildRunDeltaView(runChangeDelta(), labelFor).goalChances).toBeUndefined()
  })

  it('withheld when the goal\'s direction changed between the Runs (control: the same pair without that row keeps them)', () => {
    const base = withGoal()
    const flipped = { ...base, input_changes: [...(base.input_changes ?? []), {
      entity_kind: 'goal', entity_id: 'goal_1', field: 'direction', label_before: 'Goal', label_after: 'Goal',
      before: { raw: 'maximise' }, after: { raw: 'minimise' }, change: 'changed',
    }] } as unknown as RunDelta
    expect(buildRunDeltaView(flipped, labelFor).goalChances).toBeUndefined()
    expect(buildRunDeltaView(base, labelFor).goalChances).toHaveLength(2)
  })
})

/**
 * #2747 (DL ruling (b)): the scenario's canonical view, for the pair's Latest Run (`run-b`, the fixture's current endpoint)
 * by default; `latest: 'stale'` / `'other'` / `'absent'` are the three ways its Latest Run is not the current one.
 */
type Latest = 'current' | 'stale' | 'other' | 'absent'
function adoptCanonical(latest: Latest): void {
  const view = latest === 'absent' ? null : parseCanonicalAnalysisView({
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts', leader_licence: 'withheld', options: [],
    run: { run_id: latest === 'other' ? 'run-after-b' : 'run-b', graph_hash_at_run: null, computed_at: null },
    staleness: { stale: latest === 'stale', revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
  })
  useCanonicalAnalysisViewStore.getState().adopt('scn-1', view)
}
function seed(delta: RunDelta, permission: { permitted: boolean; producer_cause?: string } = { permitted: true }, current = true, latest: Latest = 'current'): string {
  adoptCanonical(latest)
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.44, opt_49: 0.56 } })
  report.producer_leader_permission = permission
  const hash = report.model_card.response_hash
  useCanvasStore.setState({ currentScenarioId: 'scn-1',
    nodes: [...RUN_CHANGE_LABELS.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: RUN_CHANGE_LABELS.get(id) } })), edges: [],
    results: { status: 'complete', progress: 100, report, hash },
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
// The RESULT heading, by its section: the inputs section has its own level-3 heading (Compare v3 rows).
const heading = () => within(document.querySelector('[data-compare-section="headline"]') as HTMLElement).getByRole('heading', { level: 3 })
const headlineSection = () => document.querySelector('[data-compare-section="headline"]') as HTMLElement

beforeEach(() => {
  useCanvasStore.setState(original, true)
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus: vi.fn(), highlight: vi.fn() } : null))
  vi.mocked(useCanvasLight).mockReturnValue({ on: vi.fn(), off: vi.fn() })
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

/** What the gate passes for the seeded pair: read from `pairChanceFigures` itself, never from the screen. */
function gateWords(delta: RunDelta, hash: string): Map<string, string[]> {
  const view = buildRunDeltaView(delta, (id) => RUN_CHANGE_LABELS.get(id) ?? null)
  const state = useCanvasStore.getState()
  const report = state.results?.hash === hash ? state.results.report : null
  const out = new Map<string, string[]>()
  for (const row of pairChanceFigures(view, runViewOf(report, useCanonicalAnalysisViewStore.getState().view)).rows) {
    out.set(row.optionId, [row.earlier?.words, row.now?.words].filter((w): w is string => typeof w === 'string'))
  }
  return out
}
/** Figures the gate never passes here: run_delta's own CURRENT sides (15, 20–40) and both Runs' shares (41/44, 59/56). */
const NEVER = /\b(?:15|20|40|41|44|59|56)%/

describe("Compare's goal chances come only through the chance gate (DL ruling, 20 Oct 2026)", () => {
  it.each([
    ['current', true], ['stale', true], ['other', true], ['absent', true], ['current', false],
  ] as const)('Latest %s, results permitted %s: each option row says exactly what the gate passed; no share, no ungated figure', (latest, permitted) => {
    const delta = withGoal()
    // CONTROL: the reader holds both options' goal chances, so what is absent below is the gate's doing, not the fixture's.
    expect(buildRunDeltaView(delta, (id) => RUN_CHANGE_LABELS.get(id) ?? null).goalChances).toHaveLength(2)
    const hash = seed(delta, permitted ? { permitted: true } : { permitted: false, producer_cause: 'constraint_verdict_withheld' }, true, latest)
    render(<CompareRunPairBody responseHash={hash} />)
    const passed = gateWords(delta, hash)
    // Bound by option id: a row exists only for an option the gate passed a figure for, and says that figure.
    for (const id of ['opt_49', 'opt_60']) {
      const row = document.querySelector(`[data-testid="compare-pair-chance-slope"] [data-option-id="${id}"]`)
      const words = passed.get(id) ?? []
      if (words.length === 0) expect(row, `${id}: the gate passed nothing, so no row`).toBeNull()
      else for (const w of words) expect(row?.textContent ?? '', `${id} says the gate's words`).toContain(w)
    }
    expect(headlineSection().textContent).not.toMatch(NEVER)
    expect(screen.queryByTestId('compare-share-results')).toBeNull()
    expect(screen.queryByTestId('compare-result-details-toggle')).toBeNull()
    if (!permitted) expect(screen.getByTestId('compare-withheld-reason')).toBeInTheDocument()
  })

  it("the earlier run's licensed 47% is shown because the gate passed it (contrast: its 15% current side never is)", () => {
    const hash = seed(withGoal())
    render(<CompareRunPairBody responseHash={hash} />)
    expect(gateWords(withGoal(), hash).get('opt_49')).toContain('about 47%')
    expect(document.querySelector('[data-testid="compare-pair-chance-slope"] [data-option-id="opt_49"]')?.textContent).toContain('from about 47% on the earlier run')
    expect(headlineSection().textContent).not.toMatch(/\b15%/)
  })

  it("a pair that is not the current model's says no ungated figure either (control: its inputs still list)", () => {
    render(<CompareRunPairBody responseHash={seed(withGoal(), { permitted: true }, false)} />)
    expect(headlineSection().textContent).not.toMatch(NEVER)
    expect(document.querySelector('[data-compare-section="inputs"]')).not.toBeNull()
  })
})
