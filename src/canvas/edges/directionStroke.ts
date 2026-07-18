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
 * Yellow (var(--goal)) stays reserved for truly uninitialised edges (no
 * direction AND no weight); grey for weight-set-but-no-direction and for the
 * neutral weight === 0 choice.
 */
export function computeDirectionStroke(
  direction: 'positive' | 'negative' | undefined,
  weight: number,
  rawWeight: number | undefined,
  isDark: boolean,
): string {
  // Truly uninitialised: no direction AND weight is undefined → yellow
  if (direction === undefined && rawWeight === undefined) {
    return 'var(--goal)'
  }
  // Weight defined but direction not yet set → grey (not yellow)
  if (direction === undefined) {
    return isDark ? 'var(--edge-neutral-dark)' : 'var(--edge-neutral)'
  }
  // Direction set with positive weight → green
  if (direction === 'positive' && weight > 0) {
    return isDark ? 'var(--edge-positive-dark)' : 'var(--edge-positive)'
  }
  // Direction set with negative weight → rose (E1: distinct from amber warning)
  if (direction === 'negative' && weight > 0) {
    return isDark ? 'var(--edge-negative-dark)' : 'var(--edge-negative)'
  }
  // Neutral: weight === 0 (valid user choice)
  return isDark ? 'var(--edge-neutral-dark)' : 'var(--edge-neutral)'
}
