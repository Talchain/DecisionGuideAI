/**
 * directionStroke — the single source of truth for a causal edge's polarity
 * colour (F.2). Extracted from StyledEdge so the rule can be unit-tested
 * without a ReactFlow render and so the E1 recolour lives in one place (the
 * spec previously kept a hand-copied duplicate that had to be edited in
 * lockstep).
 *
 * E1 (graph-visuals 2026-07-11) — CVD-aware polarity palette. The +/− glyph is
 * the second cue; these hues are the primary. Positive → the #62B290 green
 * Paul selected. Negative → rose #D6336C, chosen over the pack's amber #FFA656
 * (Paul's C2 ruling reserves amber for the warning/fragility family). ΔE-
 * validated: rose sits ΔE 99.7 from the positive green, 66.9 from the amber
 * warning family, and 48.4 from the risk-node border (#EA7B4B) — the old
 * #ef4444 negative was only ΔE 27.6 from that border, the collision this
 * fixes. Dark negative is likewise distinct from the dark risk border.
 * The hue VALUES live in brand.css (--edge-positive/--edge-negative/
 * --edge-neutral + -dark variants) with the full ΔE rationale — this module
 * owns the RULE, the token file owns the colours. Yellow (var(--goal)) stays reserved for truly uninitialised
 * edges (no direction AND no weight); grey for weight-set-but-no-direction and
 * for the neutral weight === 0 choice.
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
