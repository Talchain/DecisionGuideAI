/**
 * Scientific validation orchestrator.
 *
 * Runs the seven validators and emits the bundle's
 * `scientific_validation` section. Pure function over a slim
 * `ValidatorInputs` shape; tests can drive it without React/Zustand.
 *
 * Overall status rules (from the brief):
 *   - complete                     — ≥3 validators with claim_strength
 *                                    ∈ {observed, derived} AND no
 *                                    `partial`/`fail` results
 *   - partial                      — some derived but < 3 total
 *   - insufficient_raw_evidence    — < 3 validators with observed/derived
 *                                    evidence
 *   - unavailable                  — no live raw payloads at all
 *
 * Order matters less than honesty: the goal is "do not overclaim".
 */

import { runAutoNoiseValidation } from './autoNoiseValidation'
import { runConfidenceValidation } from './confidenceValidation'
import { runEvidenceGapValidation } from './evidenceGapValidation'
import { runEvpiValidation } from './evpiValidation'
import { runFlipThresholdValidation } from './flipThresholdValidation'
import { runResponseShapeValidation } from './responseShapeValidation'
import { runUserStdPropagation } from './userStdPropagation'
import type {
  ScientificValidation,
  ScientificValidationOverallStatus,
  ValidatorInputs,
  ValidatorName,
  ValidatorResult,
} from './types'

export type {
  ClaimStrength,
  ScientificValidation,
  ScientificValidationOverallStatus,
  ValidationStatus,
  ValidatorInputs,
  ValidatorName,
  ValidatorResult,
} from './types'

const RAW_PAYLOAD_INDICATIVE_KEYS = [
  'option_comparison',
  'factor_sensitivity',
  'm1_coaching',
  'flip_thresholds',
  'robustness',
] as const

function classifySource(
  inputs: ValidatorInputs,
): ScientificValidation['source'] {
  // live_raw_payloads — any of the indicative keys exists on the
  // captured PLoT response.
  //
  // PR #156 round-4 (reviewer P0): ALSO require the selected PLoT
  // trace to be usable live evidence (completed-2xx with body). The
  // top-level `analysis_evidence_source` already enforces this; the
  // validator source classifier now mirrors that contract so a
  // FAILED PLoT response carrying `factor_sensitivity` in its error
  // body can't mislabel here as live_raw_payloads while the bundle
  // headline label says `hydrated_report`.
  //
  // The flag defaults to `false` for legacy / sync-path callers; on
  // that branch the classifier behaves as it did pre-round-4 (still
  // gated by `plotResponse` having a real indicative key). Real
  // runtime via `buildDebugBundleAsync` always passes the live
  // value.
  if (
    inputs.plotResponse &&
    typeof inputs.plotResponse === 'object' &&
    !Array.isArray(inputs.plotResponse)
  ) {
    const obj = inputs.plotResponse as Record<string, unknown>
    const hasIndicativeKey = RAW_PAYLOAD_INDICATIVE_KEYS.some(
      (k) => obj[k] !== undefined && obj[k] !== null,
    )
    if (hasIndicativeKey) {
      // PR #156 round-4 gate. When the caller did not thread the
      // usability flag (undefined), preserve PR #150 behaviour and
      // return `live_raw_payloads`. When the caller threaded `false`
      // explicitly, we know the selected trace is NOT usable —
      // refuse to label as live evidence regardless of body shape.
      if (inputs.selectedPlotTraceIsUsableLiveEvidence === false) {
        // Fall through — body has the shape but the source isn't
        // trustworthy. The bundle's evidence-source rollup will
        // settle on `hydrated_report` or `debug_fallback`.
      } else {
        // Evidence-resolver follow-up (post-PR #162): when the
        // resolved `plotResponse` came from CEE V5 embedded
        // enrichment, emit a distinct label so reviewers can
        // discriminate "top-level captured raw" vs "lifted from
        // CEE V5 turn enrichment". Both are live raw evidence;
        // the label is an informational source discriminator.
        // The indicative-keys gate above + the usability gate
        // above STILL apply — no relaxation of honesty here.
        //
        // Reviewer R-2 Blocker 2: when source is `'cee_embedded'`,
        // we ADDITIONALLY require `ceeCaptureIsSelectedV5Turn` to
        // be `true`. That signal comes from the CEE-side
        // analysis-producing selector's provenance — only an
        // `'analysis_producing_v5_turn'` or `'fallback_v5_turn'`
        // capture qualifies. A legacy / stale / non-selected CEE
        // response with `analysis_result.enrichment` MUST NOT
        // be labelled live, regardless of body shape.
        if (inputs.plotResponseSource === 'cee_embedded') {
          if (inputs.ceeCaptureIsSelectedV5Turn === true) {
            return 'live_v5_cee_embedded'
          }
          // Not a selected V5 turn — fall through to the non-live
          // labels below. The body had indicative-key shape but
          // the capture provenance is wrong; we refuse to label
          // as live evidence.
        } else {
          return 'live_raw_payloads'
        }
      }
    }
  }
  // hydrated_report — capture-pipeline says hydrated_only AND we still
  // have results derived from the canvas store.
  if (inputs.capturePipelineStatus === 'hydrated_only' && inputs.resultsReport) {
    return 'hydrated_report'
  }
  if (inputs.capturePipelineStatus === 'results_rendered_from_store_without_capture') {
    return 'debug_fallback'
  }
  return 'unavailable'
}

function classifyOverall(
  validators: Record<ValidatorName, ValidatorResult>,
  source: ScientificValidation['source'],
): ScientificValidationOverallStatus {
  if (source === 'unavailable') return 'unavailable'
  const derivedCount = Object.values(validators).filter(
    (v) => v.claim_strength === 'observed' || v.claim_strength === 'derived',
  ).length
  const failCount = Object.values(validators).filter((v) => v.status === 'fail').length
  const partialCount = Object.values(validators).filter(
    (v) => v.status === 'partial',
  ).length
  // Final acceptance honesty rule: `complete` is impossible if ANY
  // validator is partial, fail, OR unavailable. The bundle must not
  // claim a complete picture when some evidence couldn't be reached
  // (e.g. user_std_propagation reports `unavailable` until DGAI
  // captures the ISL request). Each unreachable validator is a real
  // gap; surface it via `partial` so reviewers see the cost.
  const unavailableCount = Object.values(validators).filter(
    (v) => v.status === 'unavailable',
  ).length
  if (derivedCount < 3) return 'insufficient_raw_evidence'
  if (failCount > 0 || partialCount > 0 || unavailableCount > 0) return 'partial'
  return 'complete'
}

export function runScientificValidation(
  inputs: ValidatorInputs,
): ScientificValidation {
  const validators: Record<ValidatorName, ValidatorResult> = {
    user_std_propagation: runUserStdPropagation(inputs),
    confidence_validation: runConfidenceValidation(inputs),
    evidence_gap_validation: runEvidenceGapValidation(inputs),
    evpi_validation: runEvpiValidation(inputs),
    flip_threshold_validation: runFlipThresholdValidation(inputs),
    auto_noise_validation: runAutoNoiseValidation(inputs),
    response_shape_validation: runResponseShapeValidation(inputs),
  }

  const source = classifySource(inputs)
  const overall_status = classifyOverall(validators, source)
  const evidence_limitations = buildEvidenceLimitations(inputs, source)

  return {
    overall_status,
    source,
    validators,
    evidence_limitations,
  }
}

/**
 * Build orchestrator-level evidence limitations. Cross-cutting
 * concerns about the evidence itself — not per-validator findings.
 *
 * Only fires when the validators actually consumed LIVE evidence
 * (`live_raw_payloads` / `live_v5_cee_embedded`); on
 * `hydrated_report` / `debug_fallback` / `unavailable` the evidence
 * trace split is moot.
 *
 * Honesty contract:
 *   - Limitations are ADDITIVE warnings; they do NOT downgrade
 *     per-validator statuses. The orchestrator surfaces them so
 *     reviewers see the recovered-evidence context without claiming
 *     the validators failed.
 *   - Recovered-from-earlier-trace fires only when the source is
 *     `'recovered_earlier_cee_turn'`. `'selected_cee_turn'` means
 *     conversational == evidence, no special note needed.
 *   - Hash-mismatch fires regardless of recovery as long as live
 *     evidence was consumed.
 */
function buildEvidenceLimitations(
  inputs: ValidatorInputs,
  source: ScientificValidation['source'],
): string[] {
  const limitations: string[] = []
  const liveEvidence =
    source === 'live_raw_payloads' || source === 'live_v5_cee_embedded'
  if (!liveEvidence) return limitations
  if (inputs.evidenceTraceSource === 'recovered_earlier_cee_turn') {
    limitations.push(
      'Scientific evidence was recovered from an earlier CEE turn ' +
        '(analysis_evidence_trace.source = recovered_earlier_cee_turn) ' +
        'because the latest conversational turn carried no analysis ' +
        'evidence. The recovered body is surfaced on the bundle as ' +
        '`analysis_evidence_trace.response_body` and the evidence-' +
        'resolution paths point at that location.',
    )
  }
  if (inputs.evidenceHashMismatchObserved === true) {
    limitations.push(
      "Recovered CEE evidence trace's captured response_hash " +
        'disagrees with the current results.hash. The recovered ' +
        'evidence may not match the currently-rendered analysis. ' +
        'See `analysis_evidence_trace.hash_mismatch_observed` and ' +
        '`analysis_evidence_trace.response_hash` for the captured ' +
        'hash.',
    )
  }
  return limitations
}
