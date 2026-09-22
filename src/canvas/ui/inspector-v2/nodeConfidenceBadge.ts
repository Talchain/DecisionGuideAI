/**
 * ⭐⭐⭐ AN AVERAGE OF ONE REPEATED NUMBER IS NOT EVIDENCE.
 *
 * ## The defect, and it was PREDICTED IN WRITING at the call site
 *
 * `InspectorRouter`'s own comment, written when the provenance gate went in:
 *
 *   *"PROVENANCE-GATED, and this one is worse than the edge case: an AVERAGE
 *   reads as far more evidentiary than a single field. On a freshly drawn graph
 *   every inbound edge returned the same `0.8`, so the goal node showed
 *   "high · 80%" — a synthetic aggregate of a constant."*
 *
 * The repair excluded UNSET edges from the mean. It did not close the case the
 * sentence actually describes, because the values are not unset — CEE stamps
 * `belief_exists_source: "cee"`, which is real provenance — they are simply
 * **the same number every time**.
 *
 * ## Measured on Paul's own run, bundle `482ec9e0`, served UI `1f77130d`
 *
 * Both inbound edges to the goal `b4014d90`:
 *
 *     e-11  MRR Growth  → goal   belief_exists: 0.8   source: "cee"
 *     e-14  Churn Spike → goal   belief_exists: 0.8   source: "cee"
 *
 * and in fact **every causal edge on the board carries exactly `0.8`**. The goal
 * panel rendered **`✓ 80%`** — the exact string the comment calls a synthetic
 * aggregate, live on the served build, on the panel header where it reads as
 * the model's confidence in the goal.
 *
 * ## The rule
 *
 * An average is an aggregate only if the values VARY. With zero spread the mean
 * is the constant restated, and presenting it as a figure derived from N links
 * asserts corroboration that does not exist. So this withholds rather than
 * qualifies: a badge is a claim, and the honest move is not to make it.
 *
 * ⚠ WITHHOLDING IS THE PRECEDENT, NOT A REGRESSION. The sibling repair to the
 * `Key driver` badge settled the same question in the same direction — *"Fewer
 * badges is the correct outcome, not a regression"* — and the per-edge figure
 * is still on every edge for a reader who wants it.
 *
 * ⚠ SCOPE: this decides the BADGE only. It reads no provenance of its own; the
 * caller has already applied the set-vs-defaulted gate, and this is the second,
 * independent question of whether what survived that gate says anything.
 */

export type NodeConfidenceLevel = 'high' | 'medium' | 'low'

export interface NodeConfidenceBadgeReadout {
  level: NodeConfidenceLevel
  /** Whole percentage points, as the badge renders them. */
  value: number
}

/**
 * @param confidences the inbound edge values that PASSED the caller's
 * set-vs-defaulted gate. Order is irrelevant.
 */
export function nodeConfidenceBadgeReadout(
  confidences: readonly number[],
): NodeConfidenceBadgeReadout | null {
  if (confidences.length === 0) return null
  // Non-finite input would produce a NaN badge; refuse rather than render one.
  if (!confidences.every((c) => Number.isFinite(c))) return null

  // ⛔ THE ZERO-SPREAD GATE. `Math.min === Math.max` covers the single-edge case
  // too, and deliberately: one number shown beneath a node is the same claim
  // made with a sample of one.
  const min = Math.min(...confidences)
  const max = Math.max(...confidences)
  if (min === max) return null

  const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length
  const level: NodeConfidenceLevel = avg >= 0.7 ? 'high' : avg >= 0.4 ? 'medium' : 'low'
  return { level, value: Math.round(avg * 100) }
}
