import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { LAST_RUN_PREFIX } from './metricVocabulary'

/**
 * ⭐⭐ THE FACTOR CARD'S DRIVER LINE — THE AT-REST HOME OF THE RANK.
 *
 * Locked Experience Design, D1a (Paul-approved 23 Sep 2026): below the value, a
 * factor card carries ONE tiny relative line — `Driver #N of M` where the
 * analysis publishes a rank, and a small bar from the value it already has.
 * It replaces the Standard-view `NodeMetricRow` (`factor-influence-row`) that
 * printed `Relative influence ▬ 62%`.
 *
 * ⛔ NO PERCENTAGE ON THE FACE OF THE CARD. On both stamped bases the figure is
 * normalised against the strongest factor, so the leader reads 100% BY
 * CONSTRUCTION (`influenceScaleCopy.ts`, module header). A bare `62%` at rest
 * is read as a causal share of the outcome; the bar carries the same magnitude
 * without printing a number that invites that reading.
 *
 * ⭐ AND THE FIGURE IS DEMOTED, NOT DELETED — the estate's NO-HIDING ruling as
 * `influenceRankExplanation` records it (`influenceScaleCopy.ts:476-478`):
 * "taking the figure away from a reader who wants it would be hiding a
 * finding". So the tooltip and the accessible name carry it, stated WITH the
 * scale that makes it relative (`At 62% of the strongest factor.`), and the
 * Detailed view and the inspector's `ImportanceBar` keep printing it exactly as
 * before.
 *
 * ⚠ NOTHING HERE DECIDES A RANK OR A NORMALISATION.
 *   · `rank` is `useInfluenceRank`'s licensed readout (ties withheld, capped at
 *     `MAX_BADGED_RANK`, set size from the producer) — never recomputed.
 *   · `value` is the EXISTING display value (`useNodeDisplayMetadata().
 *     influence`), already relative to the strongest factor in
 *     `driverDisplayModel.ts`. The bar draws it; it is not re-scaled.
 *   · `fromLastRun` is `useModelChangedSinceRun()` — the composed `'changed'`,
 *     never `!current` (Ruling 3, ROADMAP 2.651: labelled, not withheld).
 */

/** The disclosure the locked design specifies, verbatim. */
export const DRIVER_LINE_DISCLOSURE =
  'Relative model sensitivity in this analysis, not an absolute causal percentage.'

/**
 * `Driver #1 of 5`. The set-size half is the readout's own `setSizeText`
 * (`of 5`), so the denominator is never re-derived here.
 */
export const driverRankText = (rank: number, setSizeText: string): string =>
  `Driver #${rank} ${setSizeText}`

export interface FactorDriverLineProps {
  /** The published rank and the readout's set-size text; `null` when no rank is published. */
  rank: { rank: number; setSizeText: string } | null
  /** `useModelChangedSinceRun()` — opens the line with `LAST_RUN_PREFIX`. */
  fromLastRun: boolean
  /** The existing normalised display value, 0..1, relative to the strongest factor. */
  value: number
  /** The tooltip's basis sentence — `influenceExplanation(…)`, appended verbatim. */
  basisExplanation: string
  /**
   * The accessible name's basis sentence — `influenceBarAriaLabel(…)`, the SAME
   * string the Detailed-view influence bar announces, so one number is not
   * described two ways to a screen-reader user one view apart (the choice the
   * row this replaces had already made; `FactorNode.spec`, C4).
   */
  basisAccessibleName: string
  testId?: string
}

export function FactorDriverLine({
  rank,
  fromLastRun,
  value,
  basisExplanation,
  basisAccessibleName,
  testId = 'factor-driver-line',
}: FactorDriverLineProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const visible = `${fromLastRun ? LAST_RUN_PREFIX : ''}${rank ? driverRankText(rank.rank, rank.setSizeText) : ''}`
  // The spoken lead is the visible words, minus a dangling separator when the
  // stale label stands alone (no rank published): "Last run", not "Last run ·".
  const lead = visible.replace(/\s*·\s*$/, '').trim()
  const figure = `At ${pct}% of the strongest factor.`
  const tooltip = `${DRIVER_LINE_DISCLOSURE} ${figure} ${basisExplanation}`
  const spoken = `${DRIVER_LINE_DISCLOSURE} ${figure} ${basisAccessibleName}`

  return (
    <Tooltip asChild content={tooltip} delay={NODE_TOOLTIP_DELAY_MS}>
      <div
        className="mt-1 flex items-center gap-1.5"
        data-testid={testId}
        role="img"
        /* Label in Name: the visible words OPEN the accessible name. */
        aria-label={lead ? `${lead}. ${spoken}` : spoken}
        tabIndex={0}
        data-node-tooltip
      >
        {visible ? (
          <span className={`${typography.edgeLabel} min-w-0 text-text-light`} aria-hidden="true">
            {visible}
          </span>
        ) : null}
        {/* ≈54px, fixed: a RELATIVE mark, not a measuring scale. `max(4px, …)`
            as `NodeMetricRow` does, so a small-but-real value stays visible. */}
        <div
          className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full bg-panel-border"
          aria-hidden="true"
          data-testid="factor-driver-bar"
        >
          <div
            className="h-full rounded-full bg-info"
            style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0%' }}
          />
        </div>
      </div>
    </Tooltip>
  )
}
