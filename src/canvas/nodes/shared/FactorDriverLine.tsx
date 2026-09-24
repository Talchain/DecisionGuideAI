/**
 * ⭐ THE FACTOR'S TINY RELATIVE DRIVER VISUAL (locked spec §3 "Tiny driver visual
 * — restore"; ED 02:31Z D1a; ED 11:52Z point 3).
 *
 *   `Driver 1 of 3 ranked in this run  ▬▬`   a published rank (contract v3.1 pt 5)
 *   (nothing on the card)                     unranked — contract v3.1 pt 5: "A
 *                                             factor the run did not rank shows no
 *                                             rank"; `FactorDriverNotRanked` says
 *                                             "Not ranked in this run" to AT only
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────
 *
 *   · No `% influence` on the face (ED 11:52Z). The percentage moves into the
 *     tooltip and the accessible name, beside the words that say what it is
 *     relative to — moved, not deleted.
 *   · No `#` (ED 02:31Z: "`Driver N of M`, not `Driver #N of M`").
 *   · No second vocabulary for the rank: the reduced line and the "Worth
 *     reviewing" reason read the same `DRIVER_LINE_COPY.rank`, and the corner
 *     "Key driver" badge is retired (ED 02:31Z).
 *   · No bar without a noun (purpose audit, #1899 finding 3). Contract v3.1
 *     pt 5 goes further: an unranked factor gets NO line and NO bar (the
 *     "Structural influence" arm is retired; its figure stays in the inspector).
 *
 * ── WHEN IT SHOWS ───────────────────────────────────────────────────────────
 *
 * The CALLER decides. Design integration (23 Sep 2026) applies #1891's rule
 * (Paul's Ruling 3, ROADMAP 2.651: "labelled, not withheld"; ED 02:31Z Q2;
 * visual contract v3 "Last run · Driver N of M"):
 *   · current run → the line, unlabelled;
 *   · model KNOWN to have changed since the run (`useModelChangedSinceRun`) →
 *     the line, with `fromLastRun` set: caption AND accessible name open with
 *     `LAST_RUN_PREFIX`, so the visible string stays a prefix of the name;
 *   · never-run / cannot-confirm → no line (no past analysis is invented).
 *
 * ── WHAT THE TOOLTIP SAYS ───────────────────────────────────────────────────
 *
 * Basis-aware: the rank is ordered by how strongly the comparison RESPONDS to
 * each factor; the bar shows the displayed quantity — structural influence or
 * outcome sensitivity — and on the structural basis `influenceScaleCopy`
 * (#1221) forbids attributing it to "this analysis", so the spec's
 * "in this analysis" becomes "in this model". The spec's "not an absolute causal
 * percentage" is kept word for word.
 *
 * ── WHAT THE `of M` MEANS ───────────────────────────────────────────────────
 *
 * ⛔ SUPERSEDED BY CONTRACT v3.1 pt 5: "Driver N of M ranked in this run, where
 * M is the number of factors the run ranked. Show every one of the M ranks on
 * its card; its hover and detail define the denominator." `M` is now
 * `rankedSetSize` (via `driverRankFor`), so no published rank is off-card and
 * the note below is the contract's definition. The v3 record follows.
 *
 * "If it says `1 of 3`, users must understand what the 3 means … never imply a
 * missing rank is accidentally omitted." `M` is `rank.setSize`, the distinct
 * factors in the last analysis's driver feed (`rankFactor.ts`) — the SAME
 * licensed reader that publishes the rank, never a count of cards on the board.
 * Ranks are named for at most `MAX_BADGED_RANK` of them, and only where the
 * order is clear (`determinedRankDepth`), so a board can show factors with a
 * bar and no rank. `driverLineDenominatorNote` says exactly that, in the
 * tooltip and as the line's accessible DESCRIPTION (`aria-description`), on the
 * ranked AND the unranked arm. It is a description, not part of the name, so
 * the name stays the disclosure it was and still opens with the caption.
 *
 * ── THE BAR IS NEUTRAL (Paul 23 Sep contract feedback point 9) ──────────────
 *
 * Contract v3.1 pt 9 adds "thinner": the track is the fixture's 30 × 3px, which
 * also leaves the longer v3.1 caption its room on a 248px card.
 *
 * "Make the driver bar neutral, so it does not compete with attention." Info
 * blue is the attention marker's channel; the fill is the design system's
 * neutral muted token (`text-light`, the one `AnalysisFreshnessNotice` and
 * `AnalysisRefusalNotice` already paint as a fill). This overrides DS v5 §11.6
 * "Driver influence bars (stay `var(--info)`)" for the canvas card only; the
 * panel's driver chart is not this component. No new colour.
 */
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import {
  influenceBasisNoun,
  influenceQuantity,
  influenceStructuralBasisNote,
} from '../../../components/results/influenceScaleCopy'
import type { DriverDisplayProvenance } from '../../../components/results/driverDisplayModel'
import { DRIVER_LINE_COPY, LAST_RUN_PREFIX } from './metricVocabulary'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'

export interface FactorDriverLineProps {
  nodeId: string
  /**
   * A published rank and the RANKED count (contract v3.1 pt 5). Never null: an
   * unranked factor renders no line (`FactorDriverNotRanked` instead).
   */
  rank: { rank: number; setSize: number }
  /** The displayed relative quantity, 0..1 (1 = the strongest factor). */
  value: number
  provenance: DriverDisplayProvenance
  importanceBasis: string | null
  /**
   * The model is KNOWN to have changed since the run this line reads (the
   * card's `useModelChangedSinceRun()`). Labels the caption and the accessible
   * name `Last run · `; it never decides whether the line shows.
   */
  fromLastRun?: boolean
  testId?: string
}

/** Contract v3.1 pt 5 — the caption, without the caller's `Last run · ` prefix. */
export function driverLineCaption(rank: FactorDriverLineProps['rank'], fromLastRun = false): string {
  return DRIVER_LINE_COPY.rank(rank.rank, rank.setSize, fromLastRun)
}

export function driverLineExplanation({
  rank,
  value,
  provenance,
  importanceBasis,
  fromLastRun = false,
}: Pick<FactorDriverLineProps, 'rank' | 'value' | 'provenance' | 'importanceBasis' | 'fromLastRun'>): string {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const quantity = influenceQuantity(provenance)
  const noun = quantity?.noun ?? influenceBasisNoun(provenance)
  const parts: string[] = []
  parts.push(`${driverLineCaption(rank, fromLastRun)}. ${DRIVER_LINE_COPY.rankBasis}`)
  parts.push(`Bar: ${noun.toLowerCase()}, ${pct}% of the strongest factor. ${DRIVER_LINE_COPY.relativeDisclosure}`)
  if (quantity) parts.push(quantity.gloss)
  const note = influenceStructuralBasisNote(provenance, importanceBasis)
  if (note) parts.push(note)
  parts.push(DRIVER_LINE_COPY.question)
  return parts.join(' ')
}

/**
 * Contract v3.1 pt 5 — "its hover and detail define the denominator", in the
 * contract's own words: "This run ranked M factors by relative sensitivity;
 * each shows its own rank." (stale: "The last run …"). `M` is the caption's own
 * `rank.setSize`; no other number is stated.
 */
export function driverLineDenominatorNote(rank: FactorDriverLineProps['rank'], fromLastRun = false): string {
  const run = fromLastRun ? 'The last run' : 'This run'
  return rank.setSize === 1
    ? `${run} ranked 1 factor by relative sensitivity.`
    : `${run} ranked ${rank.setSize} factors by relative sensitivity; each shows its own rank.`
}

/**
 * Contract v3.1 pt 5 — an unranked factor "shows no rank, and its detail says
 * 'Not ranked in this run', so a missing rank never reads as an omission".
 * Nothing on the card face; one out-of-flow statement for AT (the settled
 * `sr-only` pattern `OptionNode` uses), labelled `Last run · ` on the same
 * licence as the ranked line.
 */
export function FactorDriverNotRanked({
  fromLastRun = false,
  testId = 'factor-driver-not-ranked',
}: {
  fromLastRun?: boolean
  testId?: string
}) {
  return (
    <span data-testid={testId} className="sr-only">
      {`${fromLastRun ? LAST_RUN_PREFIX : ''}${DRIVER_LINE_COPY.notRanked(fromLastRun)}`}
    </span>
  )
}

export function FactorDriverLine({
  nodeId,
  rank,
  value,
  provenance,
  importanceBasis,
  fromLastRun = false,
  testId = 'factor-driver-line',
}: FactorDriverLineProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const lastRun = fromLastRun ? LAST_RUN_PREFIX : ''
  const caption = `${lastRun}${driverLineCaption(rank, fromLastRun)}`
  const explanation = `${lastRun}${driverLineExplanation({ rank, value, provenance, importanceBasis, fromLastRun })}`
  const denominatorNote = driverLineDenominatorNote(rank, fromLastRun)
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={`${explanation} ${denominatorNote}`}>
      <button
        type="button"
        data-testid={testId}
        data-node-tooltip="true"
        aria-label={explanation}
        aria-description={denominatorNote}
        className="nodrag nopan mt-1 flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
        onClick={(e) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span
          data-testid={`${testId}-caption`}
          className={`${typography.edgeLabel} min-w-0 font-medium text-text-body`}
        >
          {caption}
        </span>
        <span
          aria-hidden="true"
          data-testid={`${testId}-bar`}
          className="h-[3px] w-[30px] shrink-0 overflow-hidden rounded-full bg-panel-border"
        >
          <span
            data-testid={`${testId}-bar-fill`}
            className="block h-full rounded-full bg-text-light"
            style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0%' }}
          />
        </span>
      </button>
    </Tooltip>
  )
}
