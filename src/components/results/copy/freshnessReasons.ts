/**
 * Curated user-facing copy for analysis freshness and result-completeness
 * reason codes (P0 V5 golden-path repair, Wave 4).
 *
 * Two tables, one resolver:
 *   - FRESHNESS_REASON_COPY  — codes from `analysis_ready.freshness_reason`
 *     (CEE) plus the local fallback codes emitted by
 *     `analysisFreshnessState.ts` (Wave 3).
 *   - COMPLETENESS_REASON_COPY — codes emitted by `useResultCompleteness`
 *     (Wave 4) when the source data was incomplete.
 *
 * Rules per the brief:
 *   - British English, sentence case, no em dashes.
 *   - Calm and action-oriented; no internal terms (Zod, noop, patch,
 *     graph_hash, normalised, fact_type, raw IDs, BUDGET_TARGET, etc.).
 *   - Unknown codes fall through to a safe generic line. The raw code
 *     NEVER reaches the DOM.
 *
 * Related: `src/lib/analysisFreshnessState.ts` (Wave 3) emits the
 * freshness reason codes consumed here.
 */

export const FRESHNESS_REASON_COPY: Readonly<Record<string, string>> = {
  // From CEE — `analysis_ready.freshness_reason`
  graph_hash_match:
    'Your analysis still matches the current model.',
  graph_hash_diverged:
    'The model has changed since the last analysis, so the previous results may be out of date.',
  legacy_fact_missing_hash:
    'Your previous analysis was run before freshness tracking. Re-run to confirm it still applies.',
  current_graph_hash_unavailable:
    "We can't confirm whether your changes affect the analysis. Re-run to be sure.",
  no_successful_run_analysis_fact:
    "Analysis hasn't been run yet.",
  derivation_failed:
    "We couldn't verify analysis freshness for this view.",
  invariant_failed:
    "We couldn't verify analysis freshness for this view.",

  // From the Wave 3 local-fallback selector
  local_graph_edited:
    'You have made changes since the last analysis. Re-run to refresh the recommendation.',
  local_results_match:
    'Your analysis matches the current model.',
  no_options_yet:
    'Add at least two options to your model before running analysis.',
  no_successful_run_yet:
    "Analysis hasn't been run yet.",
  cee_freshness_unknown:
    "We couldn't verify analysis freshness for this view.",
}

export const COMPLETENESS_REASON_COPY: Readonly<Record<string, string>> = {
  win_probability_missing:
    "Likelihood scores aren't available, so we're comparing options by expected outcome.",
  sensitivity_missing:
    "Factor sensitivity isn't available for this analysis. Showing direction only.",
  robustness_unavailable:
    'Robustness assessment is pending for this analysis.',
  decision_review_unavailable:
    'Decision coaching is still being prepared for this analysis.',
  expected_outcome_missing:
    "Expected outcome values aren't available for one or more options.",
  insufficient_evidence:
    "There isn't enough evidence to estimate this yet.",
  single_dominant_factor:
    "One factor is so dominant that sensitivity comparisons aren't informative here.",
  analysis_partial:
    'Analysis returned partial results, so some details are missing.',
}

const GENERIC_FALLBACK_FRESHNESS =
  "We couldn't determine analysis freshness for this view."
const GENERIC_FALLBACK_COMPLETENESS =
  "Some details aren't available for this analysis."

/**
 * Resolve a freshness reason code to user-facing copy. Unknown codes
 * fall through to a generic line. The raw code is never returned.
 */
export function freshnessReasonCopy(code: string | null | undefined): string {
  if (!code) return GENERIC_FALLBACK_FRESHNESS
  return FRESHNESS_REASON_COPY[code] ?? GENERIC_FALLBACK_FRESHNESS
}

/**
 * Resolve a completeness reason code to user-facing copy. Unknown
 * codes fall through to a generic line.
 */
export function completenessReasonCopy(code: string | null | undefined): string {
  if (!code) return GENERIC_FALLBACK_COMPLETENESS
  return COMPLETENESS_REASON_COPY[code] ?? GENERIC_FALLBACK_COMPLETENESS
}

/**
 * Stable enum of completeness reason codes. Anything outside this set
 * routes through `GENERIC_FALLBACK_COMPLETENESS` when surfaced.
 */
export type CompletenessReasonCode = keyof typeof COMPLETENESS_REASON_COPY
