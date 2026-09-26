/**
 * ⭐ THE RUN GATE'S INPUTS, AS THE GATE READ THEM, IN THE DEBUG BUNDLE.
 *
 * Paul's manual test `1a298d6d` (25 Sep): the Run control was closed and the
 * bundle could not say why. Its top-level `analysis_ready` is the turn whose
 * result is on screen (`cee_capture_selection: hash_matched`), which said
 * `may_run: true`, while the live gate had moved on. No field recorded the
 * carriers the gate actually composed, so the first diagnosis read the wrong
 * one (Panel's hand-off, #69 5840542820).
 *
 * This records each carrier at export time, the revision-bound admission the
 * gate decides on (`selectBoundAdmission`), and WHICH carrier decided, using
 * the gate's own predicate (`readinessObjectsToRun`) and its own precedence:
 *   the turn's `analysis_state.readiness` when it speaks, then the bound
 *   admission, then the legacy `/graph-readiness` side-car.
 * Nothing here decides anything; it reads the same selectors the gate reads.
 *
 * FAIL-OPEN TO NULL: a bundle that cannot read a store must still export.
 */
import { useCanvasStore } from '../../../canvas/store'
import { useReadinessStore } from '../../../canvas/stores/readinessStore'
import { selectAnalysisReadinessAuthority } from '../../../canvas/state/analysisStateSelector'
import { selectBoundAdmission, type AdmissionRefusalWording } from '../../../canvas/hooks/useAnalysisReady'
import { readinessObjectsToRun } from '../../../canvas/utils/canRunAnalysis'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

export interface RunGateInputs {
  /**
   * The branch the gate's readiness predicate took. With the turn's readiness
   * speaking, a bound admission still folds in (`may_run: false` refuses,
   * `true` lifts non-blocked blockers), so that case is named as both.
   */
  decided_by: 'analysis_state' | 'analysis_state+bound_admission' | 'bound_admission' | 'legacy_side_car' | 'none'
  /** `readinessObjectsToRun` over exactly the inputs below: true = the readiness carriers refuse a run. */
  readiness_objects_to_run: boolean
  /** The revision-bound admission, or null when no verdict describes the revision on screen. */
  bound_admission: { may_run: boolean; wording: AdmissionRefusalWording } | null
  cee_analysis_ready: { status: string | null; may_run: boolean | null; current_graph_hash: string | null } | null
  last_server_graph_hash: string | null
  analysis_freshness_dirty: boolean
  /** `analysis_state.readiness` as the gate's authority selector reads it (null = silent, incl. `unknown`). */
  analysis_state_readiness: { status: string; blocker_codes: string[] } | null
  legacy_graph_readiness: {
    can_run_analysis: boolean | null
    readiness_level: string | null
    blocker_reason: string | null
    stale: boolean
  } | null
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export function captureRunGateInputs(): RunGateInputs | null {
  try {
    const s = useCanvasStore.getState() as unknown as {
      ceeAnalysisReady?: unknown
      lastServerGraphHash?: string | null
      analysisFreshnessDirty?: boolean
      analysisStateV1?: AnalysisStateV1 | null
    }
    const r = useReadinessStore.getState()
    const bound = selectBoundAdmission(s)
    const authority = selectAnalysisReadinessAuthority(s.analysisStateV1 ?? null)
    const legacy = r.readiness ?? null
    const carrier =
      s.ceeAnalysisReady !== null && typeof s.ceeAnalysisReady === 'object'
        ? (s.ceeAnalysisReady as Record<string, unknown>)
        : null
    return {
      decided_by: authority
        ? bound !== undefined
          ? 'analysis_state+bound_admission'
          : 'analysis_state'
        : bound !== undefined
          ? 'bound_admission'
          : legacy
            ? 'legacy_side_car'
            : 'none',
      readiness_objects_to_run: readinessObjectsToRun(legacy, authority, bound?.mayRun),
      bound_admission: bound ? { may_run: bound.mayRun, wording: bound.wording } : null,
      cee_analysis_ready: carrier
        ? {
            status: str(carrier.status),
            may_run: typeof carrier.may_run === 'boolean' ? carrier.may_run : null,
            current_graph_hash: str(carrier.current_graph_hash),
          }
        : null,
      last_server_graph_hash: str(s.lastServerGraphHash),
      analysis_freshness_dirty: s.analysisFreshnessDirty === true,
      analysis_state_readiness: authority
        ? {
            status: String(authority.status),
            blocker_codes: (authority.blockers ?? []).map((b) => String((b as { code?: unknown }).code ?? '')),
          }
        : null,
      legacy_graph_readiness: legacy
        ? {
            can_run_analysis: typeof legacy.can_run_analysis === 'boolean' ? legacy.can_run_analysis : null,
            readiness_level: str(legacy.readiness_level),
            blocker_reason: str((legacy as { blocker_reason?: unknown }).blocker_reason),
            stale: r.stale === true,
          }
        : null,
    }
  } catch {
    return null
  }
}
