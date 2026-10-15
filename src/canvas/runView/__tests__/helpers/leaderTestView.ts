/**
 * ⭐ FAIL CLOSED (DL #2800 follow-up 3, 15 Oct): a leader is designated only on CEE's word about THAT Run — a canonical view
 * matched to the Run by identity, with a positive `leader_licence` and a `leader.option_id` naming the option. Synthetic
 * fixtures that predate the canonical view held none, so their leader positives now (correctly) name no leader.
 *
 * These helpers give such a fixture what CEE serves (the 15 Oct capacity capture's shape: `leader_licence`, `leader`
 * {licence, option_id, …}, `run.run_id`), so a positive keeps testing what it was written to test. The licence and the
 * leader are STATED by the caller: a helper that inferred them would decide the very thing CEE now decides.
 *
 * If a view is already held for the scenario (e.g. `licensedTestReportHeld`'s chance cells), it is kept and only the
 * leader fields are set on it, so cell assertions are untouched.
 */
import { useCanvasStore } from '../../../store'
import { useCanonicalAnalysisViewStore } from '../../../stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView, type CanonicalAnalysisView } from '../../canonicalAnalysisView'

export const LEADER_TEST_RUN_ID = 'leader-test-run'
type Licence = CanonicalAnalysisView['leader_licence']
type Rec = Record<string, unknown>

/** A served-shape view for one Run: current, no option cells, CEE's licence and leader as stated. */
export function leaderTestView(
  run: { run_id: string; graph_hash_at_run?: string | null },
  licence: Licence,
  leaderOptionId: string | null,
  base: CanonicalAnalysisView | null = null,
): CanonicalAnalysisView {
  const view = parseCanonicalAnalysisView({
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null,
      limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    options: [],
    ...(base ?? {}),
    run: { run_id: run.run_id, graph_hash_at_run: run.graph_hash_at_run ?? base?.run?.graph_hash_at_run ?? null,
      computed_at: base?.run?.computed_at ?? null },
    leader_licence: licence,
    leader: { licence, option_id: licence === 'withheld' ? null : leaderOptionId,
      goal_chance_leader: null, similar_option_ids: [], near_tie: false, robustness: null },
  })
  if (view === null) throw new Error('leaderTestView: the served shape did not parse')
  return view
}

type MaybeStore = { getState?: () => { currentScenarioId?: string | null } | undefined; setState?: (s: unknown) => void }
function currentScenarioId(): string {
  const store = useCanvasStore as unknown as MaybeStore
  const id = store.getState?.()?.currentScenarioId
  if (typeof id === 'string' && id !== '') return id
  // A real store with no scenario gets one; a mocked store (no setState) must carry `currentScenarioId` itself.
  store.setState?.({ currentScenarioId: 'leader-test-scenario' })
  return 'leader-test-scenario'
}

/**
 * The Results/option-card Run (`runViewOf`, matched by `report.run_id`): stamps the report's Run id when it has none and
 * adopts CEE's view for the store's current scenario (set as current when the store has none). Returns the report.
 */
export function holdLeaderForReport<T>(report: T, licence: Licence, leaderOptionId: string | null): T {
  const record = report as unknown as Rec
  const runId = typeof record.run_id === 'string' && record.run_id !== '' ? record.run_id : LEADER_TEST_RUN_ID
  const stamped = { ...record, run_id: runId } as unknown as T
  const scenarioId = currentScenarioId()
  const held = useCanonicalAnalysisViewStore.getState()
  const base = held.scenarioId === scenarioId ? held.view : null
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId, leaderTestView({ run_id: runId }, licence, leaderOptionId, base))
  return stamped
}

/**
 * A chat card's Run (`chatCardRunViewOf`, matched by the card's stamped `run_id` AND `computed_against_hash`): stamps the
 * block and adopts CEE's view for the current scenario. Returns the block.
 */
export function holdLeaderForCard<T>(block: T, licence: Licence, leaderOptionId: string | null): T {
  const record = block as unknown as Rec
  const runId = typeof record.run_id === 'string' && record.run_id !== '' ? record.run_id : LEADER_TEST_RUN_ID
  const hash = typeof record.computed_against_hash === 'string' && record.computed_against_hash !== ''
    ? record.computed_against_hash : 'leader-test-graph-hash'
  const scenarioId = currentScenarioId()
  useCanonicalAnalysisViewStore.getState().adopt(scenarioId,
    leaderTestView({ run_id: runId, graph_hash_at_run: hash }, licence, leaderOptionId))
  return { ...record, run_id: runId, computed_against_hash: hash } as unknown as T
}
