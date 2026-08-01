import {
  SUB_ONE_PERCENT_FLOOR,
  SUB_ONE_PERCENT_READOUT,
  formatPercent,
} from '../../../utils/formatPercent'

/**
 * UI-SEM-057: the sub-1% display-honesty floor, shared by OptionCards
 * ("< 1% likely to reach target") and the analysis hero (the "< 1%" goal
 * readout floor, the goal-fit leader-claim gate, and the
 * no-option-on-track headline switch). ONE constant so the surfaces can
 * never disagree about what "meaningfully on track" means.
 */
// ⭐ RELOCATED 2026-08-01 (ROADMAP 2.236) — the two constants now live in
// `src/utils/formatPercent.ts` and are RE-EXPORTED here, so every importer of
// this module is unchanged. They moved because `formatProbabilityWithResolution`
// (the shared COMPARATIVE formatter) needed the threshold and could not import
// it from here without a cycle — and the workaround for that cycle was a third
// hand-written `0.01` in `canvas/utils/labelUtils.ts`. That duplicate is what
// let the floor ship on the canvas and not in the dock: one option, one instant,
// "< 1%" on the canvas node and "0%" on the option card beside it.
//
// This file remains the home of the GOAL register's formatter below.
// The readout string ("< 1%") also ships as `HERO_COPY.readout.subOnePercent`
// and `V7_LENS_COPY.goal.subOnePercent`. Those stay in their surfaces' own copy
// registers — the analysis-hero module is under a mount guard permitting
// exactly two importers repo-wide, so it could never be the shared home.
export { SUB_ONE_PERCENT_FLOOR, SUB_ONE_PERCENT_READOUT }

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
 * function exists to remove; an exact zero therefore reads "< 1%" here.
 *
 * ⚠ CORRECTED (2.236 review): this used to end "as it already does on every
 * sibling goal surface". FALSE. `GoalNode.tsx:336-338` carries its own
 * `> 0 && < 0.01` carve-out and renders an exact zero as "0% chance of reaching
 * target" — live, and the opposite convention. The divergence is real, rowed,
 * and NOT fixed here; do not read this as a claim that the canvas agrees.
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
