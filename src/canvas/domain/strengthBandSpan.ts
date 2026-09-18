/**
 * HOW MUCH OF THIS ANSWER IS STILL OPEN — the band a stated strength could
 * plausibly fall in, once its stated spread is allowed for.
 *
 * ⭐ WHY THIS EXISTS. Selecting a connection showed a single confident-looking
 * adjective: "Strong". The edge also carries a spread (`strengthStd`), and CEE
 * states one on the overwhelming majority of the edges it drafts — but nothing
 * ever asked the one question that changes a decision: *does that spread reach
 * far enough to make the adjective a different adjective?*
 *
 * A strength of 0.45 with a spread of 0.10 runs from 0.35 to 0.55. Those two
 * numbers sit in DIFFERENT bands — "Moderate" and "Strong" — so the product's
 * own headline word is a coin-flip dressed as a finding. Saying so is the
 * difference between a tool that answers and a tool that helps a team think.
 *
 * ⛔ IT TAKES TWO PROVENANCE UNIONS, NEVER TWO NUMBERS, and that is the whole
 * safety argument. `USER_EDGE_DEFAULTS` fabricates BOTH inputs — `weight: 0.3`
 * and `strengthStd: 0.15` — with no source stamp, so a signature taking
 * `(number, number)` could be handed two defaults and would emit a confident
 * sentence about a connection nobody has characterised at all. There is no
 * argument that can be constructed here meaning "0.15, source unknown". Same
 * property `uncertaintyBandHalfWidth` and `edgeValueBand` were built for, and
 * the same reason: a guard can be bypassed, a union member that does not exist
 * cannot.
 *
 * ⚠ BOTH INPUTS MUST BE STATED, NOT JUST THE SPREAD. The sentence names a band
 * for the low end and a band for the high end, and both are functions of the
 * MAGNITUDE as well as the spread — so an unstamped weight makes the band words
 * fabrications even when the spread is a genuine CEE estimate. The two refusals
 * are reported apart (`strength_not_stated` / `spread_not_stated`) because they
 * are different facts about the edge and a surface may want to say different
 * things about them.
 *
 * ⚠ IT IS MAGNITUDE-ONLY, like `getStrengthLabel` which it delegates to. The
 * sign is direction and is not a strength claim (ROADMAP 2.263); a "Strong"
 * negative effect and a "Strong" positive one are equally strong. The magnitude
 * is taken with `Math.abs` here so no caller has to remember.
 */

import {
  getStrengthLabel,
  STRENGTH_BAND_LADDER,
  type StrengthBandLabel,
} from './vocabulary'
import type { EdgeValueDisplay } from './edgeValueProvenance'

/**
 * What can honestly be said about the range this effect could take.
 *
 * `known: false` is NOT "the spread is zero" — it is "nobody stated the numbers
 * this sentence would be about". A surface meeting it must say nothing about
 * spread, never print a tight range.
 */
export type StrengthSpread =
  | {
      known: false
      /**
       * `strength_not_stated` — no source proves the magnitude; it is a UI default.
       * `spread_not_stated`   — no source proves the spread; it is a UI default.
       * `not_a_spread`        — a stated spread that is negative, which is not a
       *                         wider or a tighter spread but a value outside the
       *                         definition of the quantity. `EDGE_VALUE_DOMAINS`
       *                         declares `strengthStd` OPEN, so the read gate does
       *                         not catch this one — the same refusal
       *                         `uncertaintyBandHalfWidth` makes, for the same reason.
       */
      reason: 'strength_not_stated' | 'spread_not_stated' | 'not_a_spread'
    }
  | {
      known: true
      /** |weight| — the stated magnitude, sign discarded. */
      magnitude: number
      /** The stated spread, one standard deviation. */
      spread: number
      /** magnitude − spread, floored at 0: a magnitude cannot be negative. */
      low: number
      /** magnitude + spread. Deliberately NOT clamped — see the note below. */
      high: number
      lowLabel: StrengthBandLabel
      highLabel: StrengthBandLabel
      /**
       * ⭐ THE DELIVERABLE. True exactly when `low` and `high` fall in different
       * bands — i.e. the interval crosses a cut point, and the single adjective
       * the product prints is doing work the numbers cannot support.
       *
       * Derived by COMPARING THE TWO LABELS rather than by testing the cuts
       * directly, so it cannot drift from `getStrengthLabel`: if the ladder gains
       * a band or moves a cut, this answer moves with it. The alternative — a
       * hand-written `low < 0.4 && high >= 0.4` — is the mirror that already made
       * two surfaces disagree about one edge (see `vocabulary.ts`).
       */
      crossesBand: boolean
    }

/**
 * ⛔ BINARY FLOATING POINT LANDS ON THE WRONG SIDE OF A CUT, AND IT IS NOT
 * THEORETICAL — it was caught in this module before it shipped.
 *
 * `0.3 - 0.1` is `0.19999999999999998` in IEEE 754, which is BELOW the 0.20 cut.
 * So a strength of 0.30 with a spread of 0.10 banded its low end as "Slight"
 * when the arithmetic a reader does in their head gives exactly 0.20,
 * "Moderate" — and the panel prints `0.30 ± 0.10` right beside the sentence, so
 * the reader can do that arithmetic and catch the product being wrong. The
 * error is one WHOLE BAND on the surface whose entire job is to be trustworthy
 * about uncertainty.
 *
 * Six decimal places is chosen, not picked: the stated values are estimates
 * carried at two to four decimals (`toFixed(2)` on screen, and the widest
 * captured census value has 17 digits of float noise on a 2-dp intent), so 1e-6
 * is orders of magnitude finer than any real distinction and orders of
 * magnitude coarser than the ~1e-16 error being corrected. Nothing a producer
 * can legitimately state is moved by it.
 *
 * ⚠ APPLIED TO THE DERIVED ENDPOINTS ONLY. `magnitude` and `spread` are what
 * somebody STATED and are reported back untouched — rounding a stated value
 * would be this module editing its inputs. Only `low` and `high`, which this
 * module computes, are snapped.
 */
const CUT_COMPARISON_DECIMALS = 6
function snapToCut(value: number): number {
  const factor = 10 ** CUT_COMPARISON_DECIMALS
  return Math.round(value * factor) / factor
}

/**
 * ⚠ `high` IS NOT CLAMPED TO 1, and that is deliberate rather than an omission.
 * `EDGE_VALUE_DOMAINS.weight` is declared OPEN and ingestion clamps the wire
 * value to [0, 2], so a magnitude of 0.9 with a spread of 0.2 legitimately
 * reaches 1.1. Clamping it would silently narrow a stated range, which is the
 * opposite of this module's job. Nothing renders `high` as a number — the
 * sentence names BANDS — so an out-of-[0,1] high costs a reader nothing, while
 * a clamp would cost them the truth.
 */
export function resolveStrengthSpread(
  strength: EdgeValueDisplay,
  spread: EdgeValueDisplay,
): StrengthSpread {
  if (!strength.show) return { known: false, reason: 'strength_not_stated' }
  if (!spread.show) return { known: false, reason: 'spread_not_stated' }
  if (spread.value < 0) return { known: false, reason: 'not_a_spread' }

  const magnitude = Math.abs(strength.value)
  const low = Math.max(0, snapToCut(magnitude - spread.value))
  const high = snapToCut(magnitude + spread.value)

  const lowLabel = getStrengthLabel(low)
  const highLabel = getStrengthLabel(high)

  return {
    known: true,
    magnitude,
    spread: spread.value,
    low,
    high,
    lowLabel,
    highLabel,
    crossesBand: lowLabel !== highLabel,
  }
}

/**
 * The band words as they read INSIDE a sentence — "moderate to very strong",
 * not "Moderate to Very strong".
 *
 * Only the first character is lowered, which is correct for all four labels
 * because none of them contains a proper noun. Same transformation, and the
 * same reason, as `METRIC_UNSET.inline`.
 *
 * ⚠ DERIVED FROM THE LABEL, never a second lowercase table beside the ladder.
 * A fifth band added to `STRENGTH_BAND_LADDER` gets its inline form for free.
 */
export function inlineStrengthLabel(label: StrengthBandLabel): string {
  return `${label.charAt(0).toLowerCase()}${label.slice(1)}`
}

/**
 * How many cut points the stated interval crosses.
 *
 * Not consumed by the panel today — `crossesBand` is the question the sentence
 * asks. It is exported because it is the honest way to answer "how much worse
 * than one band is this?" without re-deriving the ladder at a call site, and
 * because a spread wide enough to cross two cuts (Moderate through to Very
 * strong) is a materially different statement from one that crosses one.
 *
 * ⚠ SCOPE: counts INTERIOR cuts only. `STRENGTH_BAND_LADDER`'s last entry is the
 * floor at 0, which every non-negative value clears, so it is not a crossing
 * and is excluded rather than silently counted.
 */
export function strengthCutsCrossed(spread: StrengthSpread): number {
  if (!spread.known) return 0
  return STRENGTH_BAND_LADDER.filter(
    band => band.min > 0 && spread.low < band.min && spread.high >= band.min,
  ).length
}
