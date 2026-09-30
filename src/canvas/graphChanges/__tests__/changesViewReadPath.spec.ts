/**
 * THE CHANGES VIEW ON THE READ PATH — a cold reload marks the same elements the turn did (J6), because the marks are
 * reached THROUGH the path a served read takes, never seeded: `applyScenarioAnalysisRead` (the served read shape) →
 * the stored pair → `displayedRunDeltaView` (the one reader, with its identity gate) → `buildGraphChangesView`.
 *
 *   P1  a served read's pair marks the option whose setting changed
 *   P2  the same pair read for ANOTHER analysis (a later run on screen) marks nothing — never a foreign pair
 *   P3  a malformed served delta is refused whole → no comparison → nothing marked
 */
import { describe, expect, it, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyScenarioAnalysisRead, type ScenarioAnalysisApplyStore } from '../../hydrate/applyScenarioAnalysisRead'
import { displayedRunDeltaView } from '../../../components/results/analysisNew/displayedRunDeltaView'
import type { StoredRunDelta } from '../../state/storedRunDelta'
import { buildGraphChangesView, type CurrentGraph } from '../graphChangesView'

const CURRENT = {
  run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true, separation: 'separated' },
  robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
} as unknown as AnalysisStateV1

const BLOCK = {
  type: 'analysis_result', summary: 'Comparison on the current model.', leading_option_id: null,
  win_probabilities: { opt_60: 0.44, opt_49: 0.56 }, computed_against_hash: 'b1a2c3d4e5f60718',
  enrichment: { analysis_status: 'ok', option_comparison: [
    { option_id: 'opt_60', option_label: 'Raise to £60', win_probability: 0.44, outcome_mean: 0.5 },
    { option_id: 'opt_49', option_label: 'Keep £49', win_probability: 0.56, outcome_mean: 0.52 },
  ] },
}

// The served wire shape of a factor-value edit → rerun (R3 5920656318: seed moved → C2, builds equal).
const DELTA = {
  attribution_case: 'C2_unpaired',
  pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [], flip_thresholds: [],
  endpoints: { prior: { run_id: 'run-a' }, current: { run_id: 'run-b' } },
  input_coverage: 'complete',
  input_changes: [{ entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
    before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed' }],
}

const GRAPH: CurrentGraph = {
  nodes: [{ id: 'opt_60', kind: 'option' }, { id: 'opt_49', kind: 'option' }, { id: 'fac_price', kind: 'factor' }],
  edges: [],
}

/** The served read, through the real applicator; returns what it stored and the hash it put on screen. */
function servedRead(runDelta: unknown): { stored: StoredRunDelta | null; hash: string } {
  const setRunDelta = vi.fn()
  const store = {
    setAnalysisStateV1: vi.fn(), resultsComplete: vi.fn(), setLimitVerdicts: vi.fn(), setRunDelta,
    currentResultsHash: null, currentScenarioId: 'scn-sc24',
  } as unknown as ScenarioAnalysisApplyStore
  applyScenarioAnalysisRead({ analysisState: CURRENT, analysisResult: BLOCK, runDelta, store })
  const hash = (store.resultsComplete as ReturnType<typeof vi.fn>).mock.calls[0][0].hash as string
  return { stored: setRunDelta.mock.calls.at(-1)![0] as StoredRunDelta | null, hash }
}

describe('the Changes view on a cold read', () => {
  it('P1 a served read\'s pair marks the option whose setting changed', () => {
    const { stored, hash } = servedRead(DELTA)
    const v = buildGraphChangesView(displayedRunDeltaView(stored, hash, 'scn-sc24', new Map()), GRAPH, false)
    expect(v.nodeMarks.get('opt_60')).toBe('changed')
    expect([...v.nodeMarks.keys()]).toEqual(['opt_60'])
  })

  it('P2 the pair read for another analysis on screen marks nothing', () => {
    const { stored } = servedRead(DELTA)
    const v = buildGraphChangesView(displayedRunDeltaView(stored, 'a-later-analysis', 'scn-sc24', new Map()), GRAPH, false)
    expect(v.empty).toBe(true)
  })

  it('P3 a malformed served delta is refused whole — nothing marked', () => {
    const { endpoints: _drop, ...broken } = DELTA
    const { stored, hash } = servedRead(broken)
    expect(stored).toBeNull()
    expect(buildGraphChangesView(displayedRunDeltaView(stored, hash, 'scn-sc24', new Map()), GRAPH, false).empty).toBe(true)
  })
})
