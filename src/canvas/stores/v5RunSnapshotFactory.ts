/**
 * V5 session-capture snapshot factory — build an `AnalysisSnapshot` from a
 * LIVE `analysis_result` block's own enrichment.
 *
 * ROADMAP 2.350. This is the sibling of `persistedRunSnapshotFactory`, and the
 * two share their whole envelope reader (`analysisEnrichmentShape.ts`) because
 * they read the SAME bytes at two different moments: a persisted
 * `v5_handler_facts` `run_analysis` row IS this enrichment after CEE wrote it.
 *
 * ⚠ WHY THIS PATH HAD TO EXIST — the defect it closes.
 * The Compare tab's in-session capture (`canvas/store.ts` `resultsComplete`)
 * was gated on `rawV2Response`, and the deployed V5 applicator passes that as
 * `null` EXPLICITLY ("V5 carries no V2 envelope", `v5/applyV5State.ts`). So the
 * gate never opened on the live wire — for ANY tier — and Compare's only other
 * feed (`useCompareHistoryHydration`) skips guests by design. Staging serves
 * every session as guest, so a guest with two completed runs saw
 * `compare-empty-state` and zero run-pickers: witnessed on the 2026-08-04b
 * walk (`p3b/P3b-compare-before.json`, `runPickerCount: 0`). Diagnosis of
 * record: `PHASE0-EVIDENCE-2026-07-28/diagnosis-2350-compare-pickers.md`.
 *
 * ⚠ SCOPE — WITHIN-SESSION ONLY. This revives the SESSION feed. It writes
 * nothing to localStorage or Supabase, so the journey still does NOT survive a
 * reload at guest tier: that half is the run list arriving over the
 * CEE-mediated scenario-addressed read route (ROADMAP 2.312 / Track 2) and is
 * deliberately untouched here. `useCompareHistoryHydration`'s guest skip is
 * unchanged.
 *
 * ⚠ RUN IDENTITY IS DERIVED, NOT PRODUCER-SUPPLIED. Neither `analysis_result`
 * block captured off the live guest wire carries a `model_card`, so
 * `mapV5AnalysisToReport` derives `response_hash` itself (fnv1a-64 over
 * summary + leading_option_id + win_probabilities + canonical-serialised
 * enrichment). That derived value is what the applicator ALREADY uses to
 * decide "is this a new analysis" (`hash !== prevHash`), and reusing it here
 * is what makes the Compare tab and the Results panel agree on what "the same
 * run" means — and what lets a later sign-in merge dedupe a session run
 * against its own persisted row (`analysisSnapshotStore.runIdentity`).
 */
import type { Node, Edge } from '@xyflow/react'
import type { ScenarioEvent } from '../../types/scenario'
import type { AnalysisSnapshot } from '../compare-tab/types'
import { buildAnalysisSnapshot } from './analysisSnapshotFactory'
import { parseAnalysisEnrichment, enrichmentToV2ResponseShape } from './analysisEnrichmentShape'

export interface BuildV5SessionSnapshotParams {
  /** The `analysis_result` block's own `enrichment` record, untrusted. */
  enrichment: unknown
  /**
   * The analysis response hash the applicator computed for this run — the same
   * value it wrote to `results.hash`.
   */
  responseHash: string
  /** The graph the analysis was computed over. Present on this path, unlike
   *  the persisted rebuild, so graphHash / counts / evidence coverage are real. */
  nodes: Node[] | null
  edges: Edge[] | null
  runNumber: number
  events: ScenarioEvent[]
  previousSnapshotTimestamp: string | null
}

/**
 * Build one session snapshot. Returns null when the block cannot be read as a
 * completed analysis — the caller omits it from the journey rather than
 * publishing a run of zeros nobody measured.
 */
export function buildSnapshotFromV5Analysis(
  params: BuildV5SessionSnapshotParams,
): AnalysisSnapshot | null {
  const { enrichment, responseHash, nodes, edges, runNumber, events, previousSnapshotTimestamp } =
    params

  const parsed = parseAnalysisEnrichment(enrichment)
  if (!parsed) return null

  // `source` stays the factory's default `'session'`, and `graphHash` stays the
  // UI's own `generateGraphHash` regime — which is exactly right and is what
  // stops `detectStructureChange` comparing it against a persisted snapshot's
  // CEE `aag_v1` hash. See `compare-tab/types.ts` `SnapshotSource`.
  return buildAnalysisSnapshot({
    rawV2Response: enrichmentToV2ResponseShape(parsed, responseHash),
    nodes,
    edges,
    runNumber,
    events,
    previousSnapshotTimestamp,
  })
}
