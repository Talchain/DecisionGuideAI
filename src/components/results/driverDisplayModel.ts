/**
 * driverDisplayModel — the SINGLE source of truth for the "which number does a
 * driver display, and how is it ranked" policy, shared by every surface that
 * shows factor influence: the results Drivers panel (useResultsSectionData),
 * the analysis hero (via the panel model), and the canvas graph badge
 * (useNodeDisplayMetadata).
 *
 * Codex R2-B2 / R3-B1 doctrine: the surface says "Influence", so the order,
 * the rank-1 crown, and the bar must all follow the SAME number — and that
 * number must be on ONE comparable basis across the whole factor set. Producer
 * `influence_score` is adopted only when EVERY ranked factor carries a finite
 * one; under partial coverage every factor falls back to per-set normalised
 * |elasticity|. Mixing the two (a producer 0.9 ranked against a fallback 0.2)
 * is exactly the "#1 with a lower displayed influence" contradiction the
 * review caught — so the policy lives here, once, and both hooks import it
 * rather than keeping their own copy that can drift.
 *
 * `provenance` is returned so a surface can make the basis explicit (e.g. a
 * debug readout or a future "producer / derived" marker) without re-deriving
 * the decision.
 */

export type DriverDisplayProvenance = 'influence_score' | 'normalised_elasticity'

export interface DriverDisplayEntry {
  /** The 0-1 value the surface displays AND ranks by. */
  value: number
  /** Which basis produced `value` — explicit so no consumer re-decides it. */
  provenance: DriverDisplayProvenance
}

/**
 * Normalise raw elasticities to 0-1 relative to the largest magnitude in the
 * set (top = 1.0, others proportional). Degenerate sets (max |elasticity| <
 * 0.001) map every factor to 0 so a direction-only display is triggered
 * instead of misleading ~100% bars. Kept as a named export because several
 * surfaces consume the normalised value directly for semantic-label thresholds.
 */
export function computeNormalisedInfluences(
  factors: Array<{ key: string; rawElasticity: number }>,
): Map<string, number> {
  const result = new Map<string, number>()

  if (factors.length === 0) {
    return result
  }

  const absoluteValues = factors.map((f) => Math.abs(f.rawElasticity))
  const actualMax = Math.max(...absoluteValues)

  // No meaningful magnitude data → all zero (direction-only display upstream).
  if (actualMax < 0.001) {
    factors.forEach((f) => result.set(f.key, 0))
    return result
  }

  factors.forEach((f) => {
    const normalised = Math.min(1, Math.abs(f.rawElasticity) / actualMax)
    result.set(f.key, normalised)
  })

  return result
}

/**
 * Resolve the display value + provenance for every factor under the
 * complete-metric-set policy. This is THE policy — every driver surface must
 * render and rank by `value` from this map, never `influenceScore ??
 * normalisedInfluence` (which mixes bases under partial producer coverage).
 */
/**
 * Shared wire-row → policy-input extractor (Lane 2 review fold): the policy
 * FUNCTION being shared means nothing if each surface feeds it different
 * inputs — the coverage-complete verdict and the normalisation base must be
 * computed from the SAME fields everywhere.
 *
 * Field semantics mirror the drivers panel (useResultsSectionData
 * normaliseFactorSensitivity, the reference implementation):
 * - producer influence: snake_case `influence_score` ONLY (the panel never
 *   reads camelCase, so accepting it elsewhere flips the coverage verdict
 *   per surface);
 * - magnitude chain: `elasticity` → `sensitivity_score` → `sensitivity` →
 *   `importance_score` (the panel includes `sensitivity` third; feeders that
 *   omitted it ranked a different row-set).
 * Returns null when the row has no id or no finite metric at all (absence is
 * never defaulted).
 */
export function extractPolicyRow(
  raw: unknown,
): { key: string; influenceScore: number | null; rawElasticity: number } | null {
  if (raw == null || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  const key = (f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId) as string | undefined
  if (!key) return null
  const producer =
    typeof f.influence_score === 'number' && Number.isFinite(f.influence_score)
      ? f.influence_score
      : null
  const magnitude =
    typeof f.elasticity === 'number' ? f.elasticity
      : typeof f.sensitivity_score === 'number' ? f.sensitivity_score
        : typeof f.sensitivity === 'number' ? f.sensitivity
          : typeof f.importance_score === 'number' ? f.importance_score
            : null
  if (producer === null && magnitude === null) return null
  return {
    key,
    influenceScore: producer,
    rawElasticity: magnitude === null || !Number.isFinite(magnitude) ? 0 : Math.abs(magnitude),
  }
}

export function selectDriverDisplayModel(
  factors: ReadonlyArray<{ key: string; influenceScore?: number | null; rawElasticity: number }>,
): Map<string, DriverDisplayEntry> {
  const coverageComplete =
    factors.length > 0 &&
    factors.every((f) => typeof f.influenceScore === 'number' && Number.isFinite(f.influenceScore))

  const normalisedMap = computeNormalisedInfluences(
    factors.map((f) => ({ key: f.key, rawElasticity: f.rawElasticity })),
  )

  const out = new Map<string, DriverDisplayEntry>()
  for (const f of factors) {
    if (coverageComplete && typeof f.influenceScore === 'number') {
      out.set(f.key, { value: f.influenceScore, provenance: 'influence_score' })
    } else {
      out.set(f.key, { value: normalisedMap.get(f.key) ?? 0, provenance: 'normalised_elasticity' })
    }
  }
  return out
}

/**
 * Rank comparator on a resolved display model: value descending, then
 * |elasticity| as the tie-break, then key alphabetically for determinism.
 * The graph badge ranks with this so its order matches the panel's, both keyed
 * off the shared `value`.
 */
export function compareByDisplayModel(
  a: { value: number; elasticity: number; key: string },
  b: { value: number; elasticity: number; key: string },
): number {
  if (b.value !== a.value) return b.value - a.value
  if (b.elasticity !== a.elasticity) return b.elasticity - a.elasticity
  return a.key.localeCompare(b.key)
}
