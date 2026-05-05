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
}

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
