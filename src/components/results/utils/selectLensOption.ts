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
 *
 * ⚠ NOT DELEGATED to `getExpectedValue.ts`'s `getPessimistic` / `getMedian` /
 * `getOptimistic`, and the reason is a BEHAVIOUR difference, not a type one.
 * Those three read `option.outcome?.pNN` and nothing else; this one falls back
 * to the DEPRECATED FLAT fields (`option.p10` / `p50` / `p90`) that "some
 * mappers still populate" — the same fallback `ResultsBody` uses to decide
 * whether to render the lens control at all (`(o.outcome?.p10 ?? o.p10) !=
 * null`). Delegating would therefore make the lens silently uncomparable on
 * exactly the option shapes the control was shown for. Widening the parameter
 * type would not close that gap, so the local metric stays.
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

/**
 * ONE LINEAR PASS. This was a filter, then a spread, then a sort whose
 * comparator re-derived `lensMetric` twice per comparison — so a metric that
 * is read once per option here was previously read O(n log n) times, and the
 * only value the sort produced was its first element.
 *
 * The semantics are unchanged and deliberately so: the metric is derived
 * ONCE per option (never defaulted to 0 — Codex R3-SF3), fewer than two
 * options carrying it reports `comparable: false` rather than crowning
 * anyone, and ties keep the CALLER'S order because the accumulator only
 * changes on a strict improvement — the same tie-break `Array.prototype.sort`
 * gave by being stable.
 */
export function selectLensOption(
  options: readonly LensOption[],
  appetite: LensAppetite,
): LensSelection {
  const { id, count } = options.reduce<{ id: string | undefined; best: number; count: number }>(
    (acc, option) => {
      const metric = lensMetric(option, appetite)
      if (metric == null) return acc
      acc.count += 1
      if (acc.id === undefined || metric > acc.best) {
        acc.id = option.id
        acc.best = metric
      }
      return acc
    },
    { id: undefined, best: -Infinity, count: 0 },
  )
  if (count < 2) return { id: undefined, comparable: false }
  return { id, comparable: true }
}
