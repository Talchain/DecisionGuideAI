/**
 * Pipeline status derivation for the V5 debug bundle (P0 V5 golden-path
 * repair, Wave 5).
 *
 * Replaces ad-hoc "global success" booleans in the debug bundle with a
 * scoped enum that distinguishes:
 *
 *   - `ui_render_success`         — full success path
 *   - `cee_response_received`     — CEE responded but the result wasn't
 *                                    actionable (e.g. recoverable error)
 *   - `analysis_not_run`          — no analysis fact yet on the path
 *   - `analysis_failed`           — analysis run completed unsuccessfully
 *   - `proxy_or_network_failure`  — request never reached CEE or the
 *                                    response was a 5xx / network error
 *   - `payload_capture_disabled`  — request succeeded but payload was
 *                                    not captured (privacy / sampling)
 *
 * The brief is explicit: pipeline status MUST be scoped. A debug bundle
 * with a missing CEE payload, a failed run gate, or only a UI render
 * success must NEVER report a global "success".
 *
 * Pure function, no side effects. Consumed by the bundle assembly site
 * (`src/components/debug/utils/exportBundle.ts`) once the trace and
 * freshness inputs are gathered. Tests are table-driven.
 */

import type { AnalysisRunStateKind } from '@talchain/schemas/boundary'

import type { RequestTrace } from './debug-state'
import type { CEEAnalysisReady } from '../adapters/cee/types'

export type PipelineStatus =
  | 'ui_render_success'
  | 'cee_response_received'
  | 'analysis_not_run'
  | 'analysis_failed'
  | 'proxy_or_network_failure'
  | 'payload_capture_disabled'

export type RecoverableEnvelope = {
  retryable?: boolean
  /**
   * Best-effort categorisation of the recoverable error. Recognised
   * values that indicate analysis failure: `analysis_failed`,
   * `analysis_partial`, `analysis_blocked`, `plot_unavailable`. All
   * other categories are treated as `cee_response_received` (the
   * response landed but the user couldn't act on it).
   */
  category?: string | null
}

export type DerivePipelineStatusInputs = {
  /**
   * The request trace. Must carry at minimum `status`, `error`,
   * `completed`, `elapsedMs`, and ideally `responseHash`. Absent
   * fields are tolerated.
   */
  trace: Pick<
    RequestTrace,
    'status' | 'error' | 'completed' | 'responseHash' | 'service' | 'serviceBuild'
  >
  /**
   * Whether this turn was an analysis-bearing turn (run_analysis or
   * post-analysis explanation). The status enum distinguishes
   * `analysis_not_run` from `cee_response_received` based on whether
   * analysis was expected.
   */
  isAnalysisTurn: boolean
  /**
   * The wire `analysis_ready` block from the response, if any.
   */
  ceeAnalysisReady: CEEAnalysisReady | null | undefined
  /**
   * Recoverable rejection envelope from the response error block, if
   * any. Non-null indicates a typed CEE error rather than a network
   * failure — the response landed.
   */
  recoverableEnvelope?: RecoverableEnvelope | null | undefined
  /**
   * True when payload capture was explicitly disabled for this trace
   * (e.g. privacy filter, sampling). When true and the response was
   * otherwise successful, status flips to `payload_capture_disabled`.
   */
  payloadCaptureDisabled?: boolean
  /**
   * Analysis-state authority, step 5 — the composed run-state verdict for this
   * turn, when CEE stated one (`AnalysisStateV1.run_state.kind`, read via
   * `canvas/state/analysisStateSelector.ts`).
   *
   * PRECEDENCE: when present, this OUTRANKS the `analysis_ready`-derived
   * inference at branches 5a/5b/6 below. Those branches infer "did an analysis
   * run" from the SHAPE of `analysis_ready` — an absent block, a non-'ready'
   * status — which is a Q1 answer read off a Q2 signal, and it is one of the
   * six vocabularies this migration collapses. When CEE has stated the run
   * state outright there is nothing left to infer.
   *
   * OPTIONAL, and absence changes nothing: every existing caller omits it and
   * every existing bundle therefore derives exactly as before. That is
   * deliberate — this train adds an authority, it does not re-cut the debug
   * bundle's enum.
   */
  analysisRunStateKind?: AnalysisRunStateKind | null
}

/**
 * The wire run-state kinds that mean "no analysis result came out of this
 * turn". Derived from the contract's own semantics, not from our reading of
 * what the names ought to mean: `never_run` is stated as no analysis ever
 * having been run, and `blocked` is stated as no run having been ATTEMPTED
 * because attempting one could not have produced a meaningful result.
 *
 * `refused` is deliberately NOT here. A refusal is a statement that THIS TURN
 * declined to vouch for currency — a prior result may well be on screen — so it
 * is not the same fact as "analysis did not run", and mapping it here would
 * make the bundle assert something the producer did not.
 */
const WIRE_KINDS_MEANING_NOT_RUN: ReadonlySet<AnalysisRunStateKind> = new Set([
  'never_run',
  'blocked',
])

const ANALYSIS_FAILURE_CATEGORIES = new Set([
  'analysis_failed',
  'analysis_partial',
  'analysis_blocked',
  'plot_unavailable',
  'plot_timeout',
])

/**
 * Resolve the pipeline status for a single trace + freshness pair.
 *
 * Decision tree (in order):
 *   1. No status / no completion → proxy_or_network_failure.
 *   2. Network or 5xx status → proxy_or_network_failure.
 *   3. 4xx with recoverable envelope and analysis-failure category →
 *      analysis_failed.
 *   4. 4xx without analysis-failure category → cee_response_received.
 *   5a. 200 + analysis turn + ceeAnalysisReady absent entirely →
 *       analysis_not_run. The brief flagged this as a real bug
 *       (third-round review): pre-fix, an analysis turn missing
 *       analysis_ready fell through to ui_render_success because
 *       `readyStatus !== undefined && readyStatus !== 'ready'`
 *       evaluated false on `undefined`. The structured source field
 *       captured the absence but the enum still claimed success.
 *   5b. 200 + analysis turn + analysis_ready.status !== 'ready' →
 *       analysis_failed.
 *   6. 200 + non-analysis turn + freshness === 'none' → analysis_not_run.
 *   7. 200 + payload capture disabled → payload_capture_disabled.
 *   8. 200 + everything else → ui_render_success.
 */
export function derivePipelineStatus(
  inputs: DerivePipelineStatusInputs,
): PipelineStatus {
  const { trace } = inputs
  const status = trace.status

  // 1 — never completed (network failure mid-flight).
  if (!trace.completed) {
    return 'proxy_or_network_failure'
  }

  // 2 — no status code OR 5xx.
  if (typeof status !== 'number' || status === 0 || status >= 500) {
    return 'proxy_or_network_failure'
  }

  // 3 + 4 — 4xx with or without recoverable envelope.
  if (status >= 400 && status < 500) {
    const cat = inputs.recoverableEnvelope?.category
    if (cat && ANALYSIS_FAILURE_CATEGORIES.has(cat)) {
      return 'analysis_failed'
    }
    return 'cee_response_received'
  }

  // 5-WIRE — the composed verdict, when CEE stated one, OUTRANKS the
  // analysis_ready-shape inference below. Placed here rather than at the top of
  // the function on purpose: the transport branches above (1-4) answer a
  // question CEE cannot answer for us — whether the response arrived at all —
  // and a run-state verdict says nothing about a request that never landed.
  const wireKind = inputs.analysisRunStateKind
  if (wireKind != null) {
    if (WIRE_KINDS_MEANING_NOT_RUN.has(wireKind)) {
      return 'analysis_not_run'
    }
    if (wireKind === 'unknown_degraded') {
      // The producer says it cannot determine the run state. Reporting
      // ui_render_success here would manufacture a certainty CEE explicitly
      // withheld; `analysis_failed` would invent a failure it never claimed.
      // The bundle's honest cell is the one that says no analysis is attested.
      return 'analysis_not_run'
    }
    if (inputs.payloadCaptureDisabled) {
      return 'payload_capture_disabled'
    }
    // running / refused / complete_current / complete_stale all describe a turn
    // whose response landed and rendered.
    return 'ui_render_success'
  }

  // 5a — 200 + analysis turn + analysis_ready ABSENT entirely.
  // Third-round review: this case used to fall through to
  // ui_render_success because the next branch checks `readyStatus !==
  // undefined && readyStatus !== 'ready'`. An analysis turn whose
  // response carries no analysis_ready cannot honestly report success
  // — analysis didn't run (or the response was incomplete capture).
  if (inputs.isAnalysisTurn && inputs.ceeAnalysisReady == null) {
    return 'analysis_not_run'
  }

  // 5b — 200 + analysis turn + analysis_ready not in 'ready' state.
  if (inputs.isAnalysisTurn) {
    const readyStatus = inputs.ceeAnalysisReady?.status
    if (readyStatus !== undefined && readyStatus !== 'ready') {
      return 'analysis_failed'
    }
  }

  // 6 — 200 + non-analysis turn carrying freshness 'none' is
  // information about state, but the run gate didn't fire on this turn.
  // Surface this so the bundle reflects the user-visible state.
  if (
    !inputs.isAnalysisTurn &&
    inputs.ceeAnalysisReady?.freshness === 'none'
  ) {
    return 'analysis_not_run'
  }

  // 7 — payload capture disabled (privacy / sampling).
  if (inputs.payloadCaptureDisabled) {
    return 'payload_capture_disabled'
  }

  // 8 — happy path.
  return 'ui_render_success'
}
