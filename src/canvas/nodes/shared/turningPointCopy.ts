/**
 * ⭐ THE TURNING-POINT WORDS — Paul 23 Sep contract feedback point 3:
 *
 *   · "Say direction: 'Below 6.5%, the current model comparison changes.'"
 *   · "Show option scope where relevant."
 *   · "State what the displayed range/domain represents."
 *   · "Make 'no turning point available' the normal fallback, not an edge case."
 *     ⭐ RESTORED ON THE RESTING CARD by contract v3.1 point 3 (DESIGN-GAP-v31
 *     #38): "'No turning point in this run' is the normal fallback for an
 *     analysed factor, never a blank". ED #63 5806207128 had removed it from
 *     the resting face ("Absence of a turning point = no mini-visual"); the
 *     lane brief applies v3.1, and the conflict is named in its report. It
 *     shows at Normal zoom under a RANKED factor's driver line only — never on
 *     an unranked factor (ED 5810951997's checklist), never as an error style.
 *
 * Every sentence here is MODEL-RELATIVE ("the current model comparison"), never
 * advice. The option name, when present, is the producer's own
 * `alternative_winner_label`, in the register's withheld form ("shifts towards",
 * `FLIP_THRESHOLD_COPY.flipRiskWithAlternative`) — ROADMAP 1.267: the name is
 * data and survives a withheld run; no leader or "best" verb is ever used.
 *
 * ⚠ THE TRACK'S DOMAIN IS THE TWO PRODUCER VALUES, AND IT SAYS SO. A PLoT
 * `flip_thresholds[]` row carries `current_value` and `flip_value` and nothing
 * about the range it searched (plot-lite-service `flip-thresholds.ts` probes the
 * NORMALISED [0,1] bounds; `flip-threshold-denormaliser.ts` emits no bounds on
 * the row, read at `staging`, 23 Sep 2026). So the track cannot honestly claim a
 * "modelled range" — it marks the run's value and the turning point, in order,
 * with fixed spacing, and the domain sentence says exactly that.
 */
import { LAST_RUN_PREFIX, TURNING_POINT_COPY } from './metricVocabulary'

/**
 * Which side of the turning point changes the comparison — from the producer's
 * two values only (`flip_value` against `current_value`). `at` is v3.1 point
 * 3's neutral form, "when direction cannot be established" (the two values are
 * equal, or one is not a finite number).
 */
export type TurningPointSide = 'below' | 'above' | 'at'

/** The side, read off the producer's two values and nothing else. */
export function turningPointSide(flipValue: number, currentValue: number): TurningPointSide {
  if (!Number.isFinite(flipValue) || !Number.isFinite(currentValue)) return 'at'
  return flipValue < currentValue ? 'below' : flipValue > currentValue ? 'above' : 'at'
}

export const TURNING_POINT_TRACK_COPY = {
  /**
   * The visible sentence. `value` is null when no number may be printed (not on
   * the display scale, or a unit that does not match the factor's).
   */
  sentence: ({
    side,
    value,
    alternative,
    fromLastRun,
  }: {
    side: TurningPointSide
    value: string | null
    alternative: string | null
    fromLastRun: boolean
  }): string => {
    const where = `${side === 'below' ? 'Below' : side === 'above' ? 'Above' : 'At'} ${value ?? 'a turning point'}`
    // A known-changed model's figure describes the LAST run's model, so
    // "current" would be false there; the `Last run · ` prefix scopes it.
    const subject = fromLastRun ? 'the model comparison' : 'the current model comparison'
    const verb = alternative ? `shifts towards ${alternative}` : 'changes'
    return `${fromLastRun ? LAST_RUN_PREFIX : ''}${where}, ${subject} ${verb}.`
  },
  /*
   * ⛔ `restCaption` ("Model comparison changes" + a floated number) IS RETIRED
   * — contract v3.1 point 3 and its fixture `flipPlot` caption: the RESTING card
   * says the direction in words, "Below 6.5%, the current model comparison
   * changes." (DESIGN-GAP-v31 #38). `sentence` above is now the resting caption
   * too, so the card and the detail say one sentence.
   */
  /** The label beside the run's own value on the track. */
  runValue: (value: string, fromLastRun: boolean): string =>
    fromLastRun ? `${value} in last run` : `${value} in this run`,
  /** What the track's domain represents (spoken, and on hover/focus). */
  domain: (flipValue: string, runValueLabel: string): string =>
    `The track marks the turning point (${flipValue}) and ${runValueLabel}, in order of value; spacing is not to scale and shows no uncertainty.`,
  /** Why no number is shown: the row is on the model's internal scale. */
  internalScale: TURNING_POINT_COPY.internalScale,
  /** Why no number is shown: the row's unit is not this factor's unit. */
  unitMismatch: 'The turning point is in a different unit from this factor’s value, so no number or track is shown.',
  /**
   * The fallback — quiet, never an error style, never a blank (v3.1 point 3).
   * v3.1's own words, "No turning point in this run", are said ONLY where the
   * run ATTESTED it (the producer searched and found no flip). A probe that
   * established nothing keeps "No turning point available": saying "in this
   * run" there would promote an absence of evidence into an attested finding
   * (⛔ pinned in `FactorTurningPointTrack.spec.tsx` (d)) — truth outranks the
   * one-sentence wording, and the difference is named in the WS4 report.
   */
  none: {
    /** The producer ran the search and attested no flip (`isAttestedNoFlipReason`). */
    attested: (fromLastRun: boolean): string =>
      fromLastRun ? `${LAST_RUN_PREFIX}No turning point in that run` : 'No turning point in this run',
    /** No row, a probe that established nothing, or an unknown token. */
    unavailable: (fromLastRun: boolean): string =>
      `${fromLastRun ? LAST_RUN_PREFIX : ''}No turning point available`,
    attestedExplanation:
      'Across the range the run tested, moving this factor did not change the model comparison.',
    unavailableExplanation: 'The run did not establish a turning point for this factor.',
  },
} as const
