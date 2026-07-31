/**
 * selectLensOption — the outcome-view lens pick, one quantity family for
 * all three arms (Paul's consistency ruling, §6.5 item 5; the behaviour
 * change is accepted).
 *
 * THE DEFECT THIS REMOVES. The control offered three arms under one label,
 * and they did not measure the same thing: the cautious arm ranked p10, the
 * bold arm ranked p90, and the middle arm featured whichever option led on
 * the COMPARATIVE quantity (share of Monte-Carlo runs an option out-ranked
 * the others). Stepping through the arms therefore stepped through three
 * quantities while the control said it was one view of one thing.
 *
 * All three arms now read the outcome distribution — p10 / p50 / p90.
 *
 * ⚠ THIS SILENTLY CHANGES WHICH OPTION THE MIDDLE ARM FEATURES on any run
 * where the p50 leader is not the comparative leader. That is the accepted
 * change, and `__tests__/selectLensOption.spec.ts` pins it on a fixture
 * built to make the two disagree.
 *
 * Extracted out of `ResultsBody`'s inline memo so the pick is a pure
 * function with its own tests rather than a closure only reachable through
 * a full panel render.
 */

export type LensAppetite = 'cautious' | 'middle' | 'optimistic'

/**
 * The shape the lens needs. Structural, not `OptionResult`, so the pick can
 * be tested without building a whole results bundle — and so a caller
 * holding a different option shape cannot be tempted to re-derive it.
 */
export interface LensOption {
  id: string
  outcome?: { p10?: number | null; p50?: number | null; p90?: number | null } | null
  /** Deprecated flat fields, still populated by some mappers. */
  p10?: number | null
  p50?: number | null
  p90?: number | null
}

/**
 * The one quantity each arm reads. Returns null — never 0 — when the option
 * does not carry it, because a zero default let a data-less option place in
 * the ranking (Codex R3-SF3, the reason the original memo filtered first).
 */
export function lensMetric(option: LensOption, appetite: LensAppetite): number | null {
  const raw =
    appetite === 'cautious'
      ? (option.outcome?.p10 ?? option.p10)
      : appetite === 'middle'
        ? (option.outcome?.p50 ?? option.p50)
        : (option.outcome?.p90 ?? option.p90)
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

export interface LensSelection {
  /** The featured option, or undefined when no honest comparison exists. */
  id: string | undefined
  /**
   * False when fewer than two options carry the arm's metric. The surface
   * states that the comparison is unavailable rather than crowning anyone —
   * an absence, never a fallback to a different quantity.
   */
  comparable: boolean
}

export function selectLensOption(
  options: readonly LensOption[],
  appetite: LensAppetite,
): LensSelection {
  const withData = options.filter((o) => lensMetric(o, appetite) != null)
  if (withData.length < 2) return { id: undefined, comparable: false }
  const best = [...withData].sort(
    (a, b) => (lensMetric(b, appetite) as number) - (lensMetric(a, appetite) as number),
  )[0]
  return { id: best?.id, comparable: true }
}
