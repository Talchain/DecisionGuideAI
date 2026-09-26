/**
 * ⭐ ONE AUTHORITY FOR "ARE THESE OUTCOME VALUES ON THE MODEL'S OWN SCALE?" (R&C #2133 review B1).
 *
 * The results hook (`useResultsSectionData.ts`, the denormalisation pre-scan) and the Reasoning tab's axis
 * (`OptionsComparison.tsx`) used to answer this with different thresholds (|v| > 2 vs a ±1 domain). So one run
 * could be "model scale" to the hook while the axis still printed its bare ticks (e.g. a propagated domain of
 * p10 -1.3 … p90 0.4). Both now read this predicate.
 *
 * ⚠ A MAGNITUDE TEST, NAMED AS SUCH: an outcome carries no unit and no scale flag, so this cannot tell a
 * model-scale value from a real reading of the same size. Non-finite and non-numeric entries count as 0,
 * exactly as the hook's original pre-scan did. The threshold is unchanged from that pre-scan; one authority is
 * the point, not a new threshold.
 */
export const MODEL_SCALE_MAX_ABS = 2

export function outcomeValuesAreModelScale(values: readonly unknown[]): boolean {
  const maxAbs = Math.max(0, ...values.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.abs(v) : 0)))
  return maxAbs <= MODEL_SCALE_MAX_ABS
}
