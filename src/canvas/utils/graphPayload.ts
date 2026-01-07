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
 * P0 Fix: Get interventions for the recommended option
 *
 * When making conformal predictions, we need to use the RECOMMENDED option's
 * interventions (values set to 1) rather than baseline (all 0s).
 *
 * This finds the winner option from results and extracts its intervention values.
 *
 * @param ceeAnalysisReady - CEE analysis ready payload with options
 * @param report - Analysis results with ranking/winner info
 * @returns Record<factorId, value> for the recommended option, or null if not found
 */
export function getRecommendedOptionInterventions(
  ceeAnalysisReady: {
    options: Array<{
      id: string
      label: string
      interventions: Record<string, { value: number }>
    }>
  } | null,
  report: {
    ranking?: { winner?: string }
    option_probabilities?: Record<string, { win_probability?: number }>
  } | null
): Record<string, number> | null {
  if (!ceeAnalysisReady?.options || ceeAnalysisReady.options.length === 0) {
    return null
  }

  // Strategy 1: Use ranking.winner label to find matching option
  let winnerOption = null
  if (report?.ranking?.winner) {
    winnerOption = ceeAnalysisReady.options.find(
      (opt) => opt.label === report.ranking!.winner
    )
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
      winnerOption = ceeAnalysisReady.options.find((opt) => opt.id === winnerId)
    }
  }

  // Strategy 3: Default to first option if no winner found
  if (!winnerOption) {
    winnerOption = ceeAnalysisReady.options[0]
  }

  if (!winnerOption) {
    return null
  }

  // Extract intervention values: { factorId: value }
  const interventions: Record<string, number> = {}
  for (const [factorId, intervention] of Object.entries(winnerOption.interventions)) {
    interventions[factorId] = intervention.value
  }

  if (import.meta.env.DEV) {
    console.log('[getRecommendedOptionInterventions] Winner option:', winnerOption.label)
    console.log('[getRecommendedOptionInterventions] Interventions:', interventions)
  }

  return Object.keys(interventions).length > 0 ? interventions : null
}
