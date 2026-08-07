import type { EdgeValueDisplay } from '../domain/edgeValueProvenance'

/**
 * directionStroke — the single source of truth for a causal edge's polarity
 * colour (F.2). Extracted from StyledEdge so the rule can be unit-tested
 * without a ReactFlow render and so the E1 recolour lives in one place (the
 * spec previously kept a hand-copied duplicate that had to be edited in
 * lockstep).
 *
 * E1 (graph-visuals 2026-07-11) — polarity palette. The +/− glyph is the
 * second cue; these hues are the primary. Positive → the #62B290 green Paul
 * selected. Negative → rose #D6336C, chosen over the pack's amber #FFA656
 * (Paul's C2 ruling reserves amber for the warning/fragility family).
 * The hue VALUES live in brand.css (--edge-positive/--edge-negative/
 * --edge-neutral + -dark variants) — this module owns the RULE, the token
 * file owns the colours.
 *
 * Separation in NORMAL vision (CIE76): rose sits ΔE 99.7 from the positive
 * green, 66.9 from the amber warning family, and 48.4 from the risk-node
 * border (#EA7B4B) — the old #ef4444 negative was only ΔE 27.6 from that
 * border, the collision this fixes.
 *
 * Those figures are normal-vision only. This palette was described as
 * "CVD-aware" when it shipped, but no deficiency was ever simulated; the
 * later measurement (cvdContrast.ts, polarityContrast.spec) found the pair
 * separates WORSE for a dichromat than the green/red it replaced — ΔE2000
 * 11.7 under deuteranopia versus the old pair's 28.3. The cause is lightness,
 * not hue: the old green sat at L* 90.3, this one at L* 66.9. Paul's amber
 * would have been no better (13.8 under protanopia). The hues stand — they
 * are Paul's ruling — but the +/− glyph, not the colour, is what carries
 * polarity for a red-green dichromat here. Do not remove it, and do not let
 * a future change lean on these hues alone.
 *
 * Grey (--edge-neutral) is the NO-VERDICT colour: weight-set-but-no-direction,
 * the neutral weight === 0 choice, and — since the provenance gate below —
 * every edge whose strength nobody has set.
 *
 * ⛔ PROVENANCE GATE (canvas/domain/edgeValueProvenance.ts).
 * ------------------------------------------------------------------
 * This function used to take `weight: number, rawWeight: number | undefined`
 * and carried a branch commented "truly uninitialised: no direction AND weight
 * is undefined → yellow". That branch COULD NOT FIRE. `USER_EDGE_DEFAULTS`
 * defines `weight: 0.3` AND `direction: 'positive'`, `DEFAULT_EDGE_DATA`
 * defines `weight: 0.5` — so `rawWeight === undefined` never happened in the
 * product, and every freshly drawn edge, strength unset, was painted the
 * positive green. Colour is read pre-attentively: it delivered "this is a
 * confirmed positive influence" about a connection the user had merely drawn.
 * Same tautological-dead-branch shape as the defects fixed in `OutcomeNode`
 * and `RelationshipsSection`, and the same shape the yellow branch's own
 * comment claimed to handle.
 *
 * Taking `EdgeValueDisplay` rather than a `number` is the fix: there is no
 * argument that means "0.3, source unknown", so the unset case cannot be
 * reached by accident and cannot be forgotten — it is the first branch.
 *
 * WHY GREY AND NOT THE YELLOW THE OLD BRANCH INTENDED — a deliberate exception,
 * stated rather than quietly taken. `var(--goal)` is the goal ENTITY colour;
 * the design system's rule is that no channel duplicates another, and painting
 * a large share of a fresh graph's edges in the goal hue would say something
 * about goals, not about missing data. Grey already means "we have no verdict"
 * here (it is what an edge with no direction gets), which is exactly the claim
 * we are entitled to make. Minting a new "unset" edge hue is a design-system
 * change and belongs to a design owner, not to this lane.
 */
export function computeDirectionStroke(
  direction: 'positive' | 'negative' | undefined,
  strength: EdgeValueDisplay,
  isDark: boolean,
): string {
  const neutral = isDark ? 'var(--edge-neutral-dark)' : 'var(--edge-neutral)'
  // Nobody set this strength → no verdict. Must come FIRST: a defaulted
  // `direction: 'positive'` would otherwise paint it green below.
  if (!strength.show) return neutral
  const weight = Math.abs(strength.value)
  // Weight defined but direction not yet set → grey (not yellow)
  if (direction === undefined) return neutral
  // Direction set with positive weight → green
  if (direction === 'positive' && weight > 0) {
    return isDark ? 'var(--edge-positive-dark)' : 'var(--edge-positive)'
  }
  // Direction set with negative weight → rose (E1: distinct from amber warning)
  if (direction === 'negative' && weight > 0) {
    return isDark ? 'var(--edge-negative-dark)' : 'var(--edge-negative)'
  }
  // Neutral: weight === 0 (valid user choice)
  return neutral
}
