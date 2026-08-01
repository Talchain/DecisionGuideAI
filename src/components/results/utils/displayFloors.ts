import { formatPercent } from '../../../utils/formatPercent'

/**
 * UI-SEM-057: the sub-1% display-honesty floor, shared by OptionCards
 * ("< 1% likely to reach target") and the analysis hero (the "< 1%" goal
 * readout floor, the goal-fit leader-claim gate, and the
 * no-option-on-track headline switch). ONE constant so the surfaces can
 * never disagree about what "meaningfully on track" means.
 */
export const SUB_ONE_PERCENT_FLOOR = 0.01

/**
 * The rendered form of a probability below the floor.
 *
 * The same two characters already ship as `HERO_COPY.readout.subOnePercent`
 * and `V7_LENS_COPY.goal.subOnePercent`. Those are not moved here: they live
 * in their surfaces' own copy registers, and the analysis-hero module is
 * under a mount guard that permits exactly two importers repo-wide, so it
 * cannot be the shared home. This constant is the home for the goal surfaces
 * that have no copy register of their own.
 */
export const SUB_ONE_PERCENT_READOUT = '< 1%'

/**
 * Format a goal-attainment probability for display, applying the floor.
 *
 * THE FLOOR AND THE FORMATTER IN ONE FUNCTION, because splitting them is how
 * the gauge came to disagree with the card beside it: `WinGauge` and
 * `buildV7Headline` printed `Math.round(v * 100)%` while OptionCards, the V7
 * goal lens and the analysis hero applied `SUB_ONE_PERCENT_FLOOR` first — so
 * one computed non-zero probability rendered "< 1%" on one surface and a bare
 * "0%" on another, in the same panel, about the same option.
 *
 * The predicate is `value < SUB_ONE_PERCENT_FLOOR`, byte-for-byte the
 * siblings' own test — deliberately WITHOUT a `value > 0` carve-out. A floor
 * rule that only one caller has is the hand-maintained divergence this
 * function exists to remove; an exact zero therefore reads "< 1%" here as it
 * already does on every sibling goal surface.
 *
 * Display only: the value itself is untouched and every bar still draws from
 * the raw number. Above the floor this is exactly
 * `formatPercent(v, { fromDecimal: true })` — the siblings' formatter, with no
 * ceiling rule they do not have (0.995 renders "100%", as it does there).
 */
export function formatGoalProbability(value: number): string {
  return value < SUB_ONE_PERCENT_FLOOR
    ? SUB_ONE_PERCENT_READOUT
    : formatPercent(value, { fromDecimal: true })
}
