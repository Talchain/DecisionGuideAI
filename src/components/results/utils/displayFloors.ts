import {
  SUB_ONE_PERCENT_FLOOR,
  SUB_ONE_PERCENT_READOUT,
  formatPercent,
  formatProbabilityWithResolution,
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
 * sibling goal surface". FALSE. `GoalNode.tsx` carried its own
 * `> 0 && < 0.01` carve-out and renders an exact zero as "0% chance of reaching
 * target" — live, and the opposite convention. The divergence is real, rowed,
 * and NOT fixed here; do not read this as a claim that the canvas agrees.
 *
 * ⭐ CLOSED 2026-08-03 (ROADMAP 2.333). The canvas carve-out is GONE:
 * `GoalNode` now calls this function, so an exact zero reads "< 1%" on the node
 * and on the card beside it. The paragraph above is kept as the record of what
 * was true, not as a live warning.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⭐ THE RESOLUTION ARM (ROADMAP 2.334) — WHY THIS DELEGATES
 * ─────────────────────────────────────────────────────────────────────────
 * Floor-only formatting is honest about ONE value and blind about five. The
 * walk's run scored five options at 0.0007 / 0.0001 / 0.0004 / 0 / 0.0002 and
 * printed "< 1%" five times: a correct ordering, rendered unreadable, with the
 * status-quo-lowest signature invisible. The COMPARATIVE register had already
 * solved this — `formatProbabilityWithResolution` derives its precision from
 * `n_valid_samples`, which IS on the wire (10000 per option on that run).
 *
 * So when a sample count is available this DELEGATES to that primitive rather
 * than growing a second precision ladder here. A parallel implementation is
 * precisely the hand-maintained divergence UI-SEM-057 exists to abolish, and
 * the two registers would drift the first time either was tuned.
 *
 * THE HONESTY BOUND, so a later reader can check it: printed digits are
 * supported iff the rendering never distinguishes values finer than `1/n`. At
 * n=10000 that is 0.01 percentage points; 0.0007 renders "0.1%" (COARSER than
 * the resolution, which never overclaims) and an exact zero renders "<0.01%"
 * (a bound, which is what "no hits in 10000 runs" actually licenses). Fixed
 * significant-figures is rejected: it would print "0.070%", a digit the wire
 * cannot carry.
 *
 * WITHOUT a sample count the behaviour is BYTE-IDENTICAL to before, and that
 * is deliberate rather than merely conservative: the fallback must NOT acquire
 * the comparative register's exact-zero rule (`0` → "0%"), because the goal
 * register floors an exact zero to "< 1%" so the canvas and the dock agree.
 * The register difference stays confined to the no-resolution arm, which is
 * where it always lived.
 *
 * Display only: the value itself is untouched and every bar still draws from
 * the raw number. Above the floor the fallback is exactly
 * `formatPercent(v, { fromDecimal: true })` — the siblings' formatter, with no
 * ceiling rule they do not have (0.995 renders "100%", as it does there).
 *
 * @param value - Raw goal probability in [0, 1]
 * @param nSamples - Per-option `n_valid_samples` when the surface has it;
 *   omit / null / undefined on surfaces the wire does not reach, and the
 *   floor arm applies unchanged. A non-positive or non-finite count is
 *   treated as absent — `0` would make the resolution threshold infinite.
 */
export function formatGoalProbability(value: number, nSamples?: number | null): string {
  if (nSamples != null && Number.isFinite(nSamples) && nSamples > 0) {
    return formatProbabilityWithResolution(value, nSamples)
  }
  return value < SUB_ONE_PERCENT_FLOOR
    ? SUB_ONE_PERCENT_READOUT
    : formatPercent(value, { fromDecimal: true })
}
