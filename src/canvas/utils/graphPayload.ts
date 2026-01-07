export function buildBasicGraphPayload(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data?.label || '',
      type: n.type || 'decision',
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
    })),
  }
}

export function buildRichGraphPayload(nodes: any[], edges: any[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      label: n.data?.label || '',
      type: n.type || 'decision',
      // CEE stores values in observedState.value, legacy stores in value
      value: n.data?.value ?? n.data?.observedState?.value,
    })),
    edges: edges.map((e) => ({
      from: e.source,
      to: e.target,
      weight: e.data?.weight,
    })),
  }
}

/**
 * Normalize an intervention value to a number.
 *
 * Handles various formats:
 * - number → use as-is
 * - boolean → coerce to 1/0
 * - { value: number | boolean } → extract and coerce
 * - Otherwise → null (invalid)
 */
function normalizeInterventionValue(
  raw: unknown,
  factorId: string,
  requestId?: string
): number | null {
  // Handle null/undefined
  if (raw === null || raw === undefined) {
    return null
  }

  // Handle number directly
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw
  }

  // Handle boolean → 1/0
  if (typeof raw === 'boolean') {
    return raw ? 1 : 0
  }

  // Handle object with value property
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    const val = (raw as { value: unknown }).value
    if (typeof val === 'number') {
      return isNaN(val) ? null : val
    }
    if (typeof val === 'boolean') {
      return val ? 1 : 0
    }
  }

  // Unhandled type - log anomaly
  if (import.meta.env.DEV) {
    console.warn('[normalizeInterventionValue] Unhandled intervention format', {
      factorId,
      rawType: typeof raw,
      raw,
      requestId,
    })
  }

  return null
}

/**
 * Extract interventions from an option object.
 *
 * Handles multiple storage shapes in priority order:
 * A) option.data?.interventions
 * B) option.interventions
 */
function extractInterventionsFromOption(
  option: Record<string, unknown>,
  requestId?: string
): Record<string, number> {
  const result: Record<string, number> = {}

  // Try option.data?.interventions first
  let rawInterventions: Record<string, unknown> | undefined
  if (option.data && typeof option.data === 'object' && 'interventions' in (option.data as object)) {
    rawInterventions = (option.data as { interventions?: Record<string, unknown> }).interventions
  }

  // Fallback to option.interventions
  if (!rawInterventions && option.interventions && typeof option.interventions === 'object') {
    rawInterventions = option.interventions as Record<string, unknown>
  }

  if (!rawInterventions || typeof rawInterventions !== 'object') {
    return result
  }

  const rawKeysCount = Object.keys(rawInterventions).length

  for (const [factorId, rawValue] of Object.entries(rawInterventions)) {
    const normalized = normalizeInterventionValue(rawValue, factorId, requestId)
    if (normalized !== null) {
      result[factorId] = normalized
    }
  }

  if (import.meta.env.DEV) {
    console.log('[extractInterventionsFromOption] Extraction result', {
      winner_option_id: option.id || option.label,
      raw_intervention_keys_count: rawKeysCount,
      normalised_intervention_keys_count: Object.keys(result).length,
    })
  }

  return result
}

/**
 * P0 Fix: Get interventions for the recommended option
 *
 * When making conformal predictions, we need to use the RECOMMENDED option's
 * interventions (values set to 1) rather than baseline (all 0s).
 *
 * This finds the winner option from results and extracts its intervention values.
 * Supports multiple data shapes:
 * - option.data?.interventions (nested)
 * - option.interventions (flat)
 * - analysis_ready.options[i]?.interventions (CEE format)
 *
 * Intervention values can be:
 * - number → use as-is
 * - boolean → coerce to 1/0
 * - { value: number | boolean } → extract and coerce
 *
 * @param ceeAnalysisReady - CEE analysis ready payload with options
 * @param report - Analysis results with ranking/winner info
 * @param requestId - Optional request ID for logging anomalies
 * @returns Record<factorId, value> for the recommended option, or null if empty/invalid
 */
export function getRecommendedOptionInterventions(
  ceeAnalysisReady: {
    options: Array<Record<string, unknown>>
  } | null,
  report: {
    ranking?: { winner?: string }
    option_probabilities?: Record<string, { win_probability?: number }>
  } | null,
  requestId?: string
): Record<string, number> | null {
  if (!ceeAnalysisReady?.options || ceeAnalysisReady.options.length === 0) {
    if (import.meta.env.DEV) {
      console.log('[getRecommendedOptionInterventions] No options available', { requestId })
    }
    return null
  }

  // Strategy 1: Use ranking.winner label to find matching option
  let winnerOption: Record<string, unknown> | null = null
  if (report?.ranking?.winner) {
    winnerOption = ceeAnalysisReady.options.find(
      (opt) => opt.label === report.ranking!.winner
    ) ?? null
  }

  // Strategy 2: Find option with highest win_probability
  if (!winnerOption && report?.option_probabilities) {
    let maxWinProb = -1
    let winnerId: string | null = null
    for (const [optId, prob] of Object.entries(report.option_probabilities)) {
      if (prob.win_probability !== undefined && prob.win_probability > maxWinProb) {
        maxWinProb = prob.win_probability
        winnerId = optId
      }
    }
    if (winnerId) {
      winnerOption = ceeAnalysisReady.options.find((opt) => opt.id === winnerId) ?? null
    }
  }

  // Strategy 3: Default to first option if no winner found
  if (!winnerOption) {
    winnerOption = ceeAnalysisReady.options[0] ?? null
  }

  if (!winnerOption) {
    if (import.meta.env.DEV) {
      console.log('[getRecommendedOptionInterventions] No winner option found', { requestId })
    }
    return null
  }

  // Extract and normalize interventions
  const interventions = extractInterventionsFromOption(winnerOption, requestId)

  if (import.meta.env.DEV) {
    console.log('[getRecommendedOptionInterventions] Final result', {
      winner_option_label: winnerOption.label,
      interventions,
      requestId,
    })
  }

  // Guardrail: Return null if empty (caller should skip conformal)
  if (Object.keys(interventions).length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[getRecommendedOptionInterventions] Conformal skipped: no valid interventions available', {
        winner_option_id: winnerOption.id,
        winner_option_label: winnerOption.label,
        requestId,
      })
    }
    return null
  }

  // Guardrail: Check all values are numeric
  for (const [key, val] of Object.entries(interventions)) {
    if (typeof val !== 'number' || isNaN(val)) {
      if (import.meta.env.DEV) {
        console.warn('[getRecommendedOptionInterventions] Non-numeric value after normalization', {
          key,
          val,
          requestId,
        })
      }
      return null
    }
  }

  return interventions
}
