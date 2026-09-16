/**
 * ⭐ THE ONE READER OF `robustness.display_verdict` — extracted so two surfaces
 * cannot answer one question differently.
 *
 * The token set and the fail-closed rule are `useAnalysisMetadata`'s, moved here
 * verbatim and imported back by it. They are NOT restated: a second spelling of
 * a four-token allowlist is the hand-maintained mirror this estate pays for
 * (CLAUDE.md trap 12), and a first attempt at `deriveRobustnessStatus` proved
 * the point by accepting ANY non-empty string — so `'not_assessed'`, the
 * producer's own token for "this run may claim nothing", was read as a verdict
 * and reported as `computed`. Caught in independent review, not by me.
 *
 * ⚠ `not_assessed` IS A REAL TOKEN, NOT AN ABSENCE. It is display-safe — the
 * producer minted it deliberately — and it means the opposite of a verdict. It
 * must never be folded in with `robust` / `moderate` / `fragile`.
 */

/**
 * FAIL-CLOSED, exactly as every consumer does it: only these four tokens count.
 * An absent field (older PLoT build) or an unrecognised token yields no verdict,
 * and no verdict means no claim.
 */
export const DISPLAY_SAFE_VERDICTS = ['robust', 'moderate', 'fragile', 'not_assessed'] as const
export type RobustnessDisplayVerdict = (typeof DISPLAY_SAFE_VERDICTS)[number]

export function readDisplayVerdict(raw: unknown): RobustnessDisplayVerdict | null {
  return (DISPLAY_SAFE_VERDICTS as readonly string[]).includes(raw as string)
    ? (raw as RobustnessDisplayVerdict)
    : null
}

/**
 * Did this run STATE a robustness verdict?
 *
 * `not_assessed` is a minted token and the answer is NO: the producer said it
 * did not assess. Absent and unrecognised are also no. Only the three verdicts
 * that make a claim count.
 */
export function statedARobustnessVerdict(raw: unknown): boolean {
  const v = readDisplayVerdict(raw)
  return v === 'robust' || v === 'moderate' || v === 'fragile'
}
