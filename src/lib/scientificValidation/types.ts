/**
 * Shared types for scientific validation. Every validator returns the
 * same shape so reviewers can scan the section uniformly.
 *
 * Honesty rules (enforced by the orchestrator + per-validator tests):
 *   - `observed`     — raw captured payload present in bundle.payloads.*
 *   - `derived`      — computed directly from captured raw payloads
 *   - `inferred`     — reconstructed from canvas/store/report state;
 *                      NEVER pairs with status='pass'
 *   - `unavailable`  — required evidence missing; required_upstream_support
 *                      populated
 *
 * `details` is a per-validator opaque object documented inline below.
 */

export type ValidationStatus = 'pass' | 'fail' | 'unavailable' | 'partial'

export type ClaimStrength = 'observed' | 'derived' | 'inferred' | 'unavailable'

export interface ValidatorResult {
  status: ValidationStatus
  claim_strength: ClaimStrength
  /** Bundle-relative dot/bracket paths the validator read from. */
  source_paths: string[]
  /** Free-form notes that explain limitations or context. */
  limitations: string[]
  /** Required upstream fields the validator could not find. */
  required_upstream_support: string[]
  /** Per-validator opaque details object. Documented per validator. */
  details: Record<string, unknown>
}

export type ValidatorName =
  | 'user_std_propagation'
  | 'confidence_validation'
  | 'evidence_gap_validation'
  | 'evpi_validation'
  | 'flip_threshold_validation'
  | 'auto_noise_validation'
  | 'response_shape_validation'

export type ScientificValidationOverallStatus =
  | 'complete'
  | 'partial'
  | 'insufficient_raw_evidence'
  | 'unavailable'

export interface ScientificValidation {
  overall_status: ScientificValidationOverallStatus
  /**
   * Source of the evidence the validators actually consumed.
   *
   *   - `'live_raw_payloads'`     — top-level `bundle.payloads.plot_response`
   *     was non-null AND carried at least one indicative key. The
   *     classical "dev/local PLoT captured directly" path.
   *   - `'live_v5_cee_embedded'`  — evidence resolver lifted the
   *     analysis enrichment out of the CEE V5 turn response
   *     (`bundle.payloads.cee_response.blocks[type==='analysis_result'].enrichment`)
   *     because the top-level PLoT payload was null. Same indicative-keys
   *     gate applies — empty or placeholder enrichment does NOT promote
   *     to this label. Informational discriminator vs `'live_raw_payloads'`;
   *     both are live raw evidence.
   *   - `'hydrated_report'`       — no live capture or embedded
   *     enrichment; canvas-store results.report carried derived
   *     evidence.
   *   - `'debug_fallback'`        — capture pipeline reported
   *     `results_rendered_from_store_without_capture`.
   *   - `'unavailable'`           — none of the above; honest fallback.
   */
  source:
    | 'live_raw_payloads'
    | 'live_v5_cee_embedded'
    | 'hydrated_report'
    | 'debug_fallback'
    | 'unavailable'
  /** Validators keyed by name for easy lookup. */
  validators: Record<ValidatorName, ValidatorResult>
  /**
   * Orchestrator-level limitations / informational notes that span
   * all validators. Distinct from per-validator
   * `validators[*].limitations` — those describe what a single
   * validator could or could not conclude, while these describe
   * cross-cutting concerns about the EVIDENCE itself.
   *
   * Examples:
   *   - "Scientific evidence was recovered from an earlier CEE
   *      turn (analysis_evidence_trace.source =
   *      recovered_earlier_cee_turn) because the latest conversational
   *      turn carried no analysis evidence."
   *   - "Recovered CEE evidence trace's response_hash disagrees with
   *      the current results.hash; the recovered evidence may not
   *      match the currently-rendered analysis."
   *
   * Always present (defaults to `[]`) so consumers don't have to
   * undefined-check. The orchestrator NEVER alters per-validator
   * statuses to communicate these — limitations are an additive
   * warning channel, not a status downgrade.
   */
  evidence_limitations: string[]
}

/**
 * Inputs the orchestrator passes to every validator. Each validator
 * picks what it needs — types stay loose because the underlying payloads
 * are `unknown` and we validate shapes at read time.
 */
export interface ValidatorInputs {
  plotRequest: unknown
  plotResponse: unknown
  ceeRequest: unknown
  ceeResponse: unknown
  islRequest: unknown
  islResponse: unknown
  /** Canvas store results.report (from the canvas store at export time). */
  resultsReport: unknown
  /** Canvas store ceeAnalysisReady.options[*].interventions key set. */
  ceeAnalysisReady: unknown
  /** capture_pipeline_status — drives response_shape_validation source. */
  capturePipelineStatus: string | null
  /**
   * PR #156 round-4 (reviewer P0): the analysis-producing PLoT
   * selector's usability signal. `true` only when the SELECTED PLoT
   * trace matched an analysis-class tier, completed with 2xx, AND
   * has a non-empty response body.
   *
   * `classifySource` reads `plotResponse` directly for live-evidence
   * indicative keys — pre-fix a FAILED PLoT response carrying
   * `factor_sensitivity` in its error body would mislabel as
   * `live_raw_payloads`. This boolean gates the `live_raw_payloads`
   * return so the validator source honestly reflects the selected
   * trace's usability, not just the body shape.
   *
   * Defaults to `false` for legacy / sync-path callers — preserves
   * prior PR #150 behaviour when the new signal isn't threaded
   * through. Round-4: the bundle assembler always sets the real
   * value.
   */
  selectedPlotTraceIsUsableLiveEvidence?: boolean
  /**
   * Evidence-resolver follow-up (post-PR #162): tells `classifySource`
   * WHERE the resolved `plotResponse` came from so it can emit the
   * appropriate `source` label:
   *
   *   - `'top_level'`    → `'live_raw_payloads'` (existing behaviour)
   *   - `'cee_embedded'` → `'live_v5_cee_embedded'` (new label —
   *     informational discriminator; same indicative-keys gate
   *     applies, so an empty/placeholder embedded body cannot
   *     promote to this label)
   *   - `'unavailable'`  → falls through to `'hydrated_report'` /
   *     `'debug_fallback'` / `'unavailable'` as before
   *
   * Optional — when undefined (legacy / sync-path callers), the
   * classifier behaves exactly as it did before this field
   * existed: top-level body shape alone determines the live label.
   *
   * Honesty boundary: this field is a label discriminator. It does
   * NOT relax the indicative-keys gate or the
   * `selectedPlotTraceIsUsableLiveEvidence` gate.
   */
  plotResponseSource?: 'top_level' | 'cee_embedded' | 'unavailable'
  /**
   * Reviewer R-2 Blocker 2 gate: when the resolver's
   * `plotResponseSource` is `'cee_embedded'`, the classifier must
   * ALSO verify that `bundle.payloads.cee_response` was the
   * SELECTED analysis-producing V5 turn — NOT a legacy / stale /
   * fallback-legacy capture that happens to carry an
   * `analysis_result` block.
   *
   * The bundle assembler computes this from
   * `data.cee_capture_provenance` (`'analysis_producing_v5_turn'`
   * OR `'fallback_v5_turn'` → true; anything else → false).
   *
   * `true`  → `classifySource` may emit `'live_v5_cee_embedded'`.
   * `false` → classifier falls through to non-live source labels
   *           (`'hydrated_report'` / `'unavailable'`) regardless
   *           of body shape, preserving live-evidence honesty.
   *
   * Optional — defaults to `false` for legacy / sync-path callers
   * (those callers don't supply embedded evidence either, so the
   * default doesn't change behaviour for them).
   */
  ceeCaptureIsSelectedV5Turn?: boolean
  /**
   * Evidence-trace split (workstream: DGAI debug output, 2026-05-23).
   *
   * The bundle now distinguishes the CONVERSATIONAL CEE turn
   * (`bundle.payloads.cee_response`) from the ANALYSIS-EVIDENCE CEE
   * turn (the body fed into `resolveScientificEvidence`). When the
   * conversational turn is prose-only (e.g. a `what_would_flip`
   * follow-up chip), the bundle may recover scientific evidence from
   * an earlier `run_analysis` trace. These optional flags let the
   * orchestrator surface that situation honestly in
   * `evidence_limitations` without altering per-validator statuses:
   *
   *   - `evidenceTraceSource === 'recovered_earlier_cee_turn'` →
   *     append an informational note recording that the validators
   *     consumed RECOVERED evidence, not the conversational turn's
   *     body.
   *   - `evidenceHashMismatchObserved === true` →
   *     append a warning that the recovered evidence trace's
   *     captured `response_hash` disagrees with the canvas store's
   *     `results.hash`; the recovered evidence may not match the
   *     currently-rendered analysis.
   *
   * Both default to undefined / false; legacy callers see no change.
   */
  evidenceTraceSource?:
    | 'selected_cee_turn'
    | 'recovered_earlier_cee_turn'
    | 'unavailable'
  evidenceHashMismatchObserved?: boolean
}

/**
 * Tiny helper: assert that `inferred` never pairs with `pass`. Validators
 * call this before returning; tests cover the rule.
 */
export function assertHonestyRules(result: ValidatorResult): ValidatorResult {
  if (result.claim_strength === 'inferred' && result.status === 'pass') {
    return {
      ...result,
      status: 'partial',
      limitations: [
        ...result.limitations,
        'status downgraded from pass to partial: inferred evidence cannot prove a pass',
      ],
    }
  }
  return result
}
