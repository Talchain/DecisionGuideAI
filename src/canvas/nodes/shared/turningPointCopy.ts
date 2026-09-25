/**
 * ⭐ THE TURNING-POINT WORDS — Paul 23 Sep contract feedback point 3:
 *
 *   · "Say direction: 'Below 6.5%, the current model comparison changes.'"
 *   · "Show option scope where relevant."
 *   · "State what the displayed range/domain represents."
 *   · "Make 'no turning point available' the normal fallback, not an edge case."
 *     ⛔ SUPERSEDED ON THE RESTING CARD by ED #63 5806207128 ("No `No turning
 *     point available/in this run` line at rest. Absence of a turning point =
 *     no mini-visual"). The `none` copy below now speaks only where a view
 *     adds detail (Detailed, under a ranked driver line — `FactorNode`'s
 *     `turningPointShown`); the resting face shows a FOUND threshold or nothing.
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

/** Which side of the turning point changes the comparison. */
export type TurningPointSide = 'below' | 'above'

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
    const where = `${side === 'below' ? 'Below' : 'Above'} ${value ?? 'a turning point'}`
    // A known-changed model's figure describes the LAST run's model, so
    // "current" would be false there; the `Last run · ` prefix scopes it.
    const subject = fromLastRun ? 'the model comparison' : 'the current model comparison'
    const verb = alternative ? `shifts towards ${alternative}` : 'changes'
    return `${fromLastRun ? LAST_RUN_PREFIX : ''}${where}, ${subject} ${verb}.`
  },
  /**
   * ⭐ THE RESTING CARD'S CAPTION — the prototype's words, verbatim
   * (`olumi-canvas-visual-contract.html` `flipPlot`: `Model comparison changes`,
   * stale `Last run · comparison changes`), printed beside the number on ONE
   * line. Paul, 25 Sep 2026: the canvas matches the prototype. The direction
   * sentence above (point 3(a)) is moved, not deleted — it follows these words in the track's
   * accessible name and its tooltip. Never printed without its number.
   */
  restCaption: (fromLastRun: boolean): string =>
    fromLastRun ? `${LAST_RUN_PREFIX}comparison changes` : 'Model comparison changes',
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
   * The fallback — quiet, and distinct for what the run established. Detailed
   * only (ED 5806207128: never on the resting card).
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
