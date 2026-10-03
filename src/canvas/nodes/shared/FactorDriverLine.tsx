/**
 * ⭐ THE FACTOR'S TINY RELATIVE DRIVER VISUAL (locked spec §3 "Tiny driver visual
 * — restore"; ED 02:31Z D1a; ED 11:52Z point 3).
 *
 *   `Driver 1 of 3 ranked in this run  ▬▬`   a published rank (NODE-ANATOMY
 *                                   v3.2; contract v3.1 pt 5)
 *   `Last run · Driver 1 of 3 ranked  ▬▬`    the same rank, model changed since
 *   (in the card's one-line slot, the longest form that fits at the landing
 *   bound — `Driver 1 of 3 ranked`, `Last run · Driver 1 of 3` at 1.64; see
 *   `inSlot` and `driverCaptionFit.ts`)
 *   `Driver 2 · no value yet  ▬▬`   the same rank for a factor the run held NO
 *                                   value for (PJ-B3, Canvas owner 28 Sep 2026;
 *                                   see `noValueYet`) — the rank stays, the
 *                                   words say it is not from the user's figures
 *   (nothing on the card)           unranked — "If the producer withholds a
 *                                   rank, render no substitute" (ED 5806207128);
 *                                   `FactorDriverNotRanked` says "Not ranked in
 *                                   this run" to AT only
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
 * The rank is ordered by how strongly the comparison RESPONDS to each factor
 * (|elasticity|, `rankFactor`), and the bar is THAT quantity relative to rank 1
 * — "relative sensitivity, NN% of the top-ranked driver" — so rank 1 is 100%
 * and the bars fall with the rank (contract `driver()`: "Bar length is relative
 * to the strongest ranked factor in the same model"; "not a causal contribution
 * percentage").
 *
 * ⛔ IT WAS THE DISPLAYED `influence_score` over the max of ALL factors, named
 * "structural influence, NN% of the strongest factor". On Paul's MRR run
 * (side-by-side DIFF item 4, 27 Sep 2026) that max was `pro_plan_price` — a
 * factor this card calls unranked — so Driver 1 drew 81% and the bar
 * contradicted the rank beside it. The structural figure stays in the inspector.
 *
 * ── WHAT THE `of M` MEANS ───────────────────────────────────────────────────
 *
 * NODE-ANATOMY v3.2 and contract v3.1 pt 5 (ACCEPTED by Paul): "M is the number
 * of factors the run ranked. Show every one of the M ranks on its card; its
 * hover and detail define the denominator." `M` is `rank.setSize`, the RANKED
 * count (`driverRankFor`), so a reader can check it by counting the cards that
 * show a rank. It replaced ED #63 5806207128's analysed count, which on the
 * same run printed `Driver 1 of 5 analysed` beside three silent cards (DIFF
 * item 3) — the omission Paul pt 5 forbids. `driverLineDenominatorNote` defines
 * M, and says a factor outside it has not been left out, in the tooltip and as
 * the line's accessible DESCRIPTION (`aria-description`). It is a description,
 * not part of the name, so the name still opens with the caption.
 *
 * ── THE BAR IS NEUTRAL (Paul 23 Sep contract feedback point 9) ──────────────
 *
 * Contract v3.1 pt 9 adds "thinner": the track is the fixture's 30 × 3px. On
 * the card it is drawn whole beside the caption or not at all (see `inSlot`).
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
import { MAX_BADGED_RANK } from '../../../components/results/driverDisplayModel'
import { DRIVER_LINE_COPY, LAST_RUN_PREFIX } from './metricVocabulary'
import { restingDriverCaption, restingUnvaluedDriverCaption } from './driverCaptionFit'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'

export interface FactorDriverLineProps {
  nodeId: string
  /**
   * A published rank and the RANKED count, `M` (NODE-ANATOMY v3.2). Never
   * null: an unranked factor renders no line (`FactorDriverNotRanked` instead).
   */
  rank: { rank: number; setSize: number }
  /**
   * Relative sensitivity, 0..1 — the rank's own quantity over rank 1's (1 = the
   * top-ranked driver). `null` = no figure: the rank still shows (every one of
   * the M is shown), but no bar is drawn and none is described — a bar is
   * never drawn for a figure the run did not produce.
   */
  value: number | null
  /**
   * The model is KNOWN to have changed since the run this line reads (the
   * card's `useModelChangedSinceRun()`). Labels the caption and the accessible
   * name `Last run · `; it never decides whether the line shows.
   */
  fromLastRun?: boolean
  /**
   * ⭐ PJ-B3 (Canvas owner, 28 Sep 2026): the run ranked this factor but held NO
   * value for it — its `factor_sensitivity` row carries no `value_source` while
   * other rows carry one (`unvaluedDriver.ts`, via the card's
   * `useFactorRunCues`). The rank stays; the caption adds "no value yet"
   * (in the slot, the longest `rankSlotFormsNoValue` form that fits at the
   * landing bound, so "no value yet" is always visible), and the accessible
   * name and the hover open with `rankNoValueSentence`. Same caption style,
   * no new colour or badge. Omitted → false: the line is unchanged.
   */
  noValueYet?: boolean
  testId?: string
  /**
   * ⭐ THE CARD'S RESERVED ONE-LINE SLOT (DL #70 5849644637; `FactorNode`'s
   * `factor-driver-slot-*`). The slot owns the top margin and the height (one
   * line, `overflow-hidden`); the line fills it and the card NEVER GROWS.
   *
   * ⭐ THE CAPTION NEVER GIVES WAY; THE BAR IS ALL OR NOTHING (27 Sep 2026,
   * side-by-side DIFF item 11, adversarial review of the first fix). The row is
   * the contract's own `.driver` — `flex-wrap`, gap 6px — so a bar that does not
   * fit beside the words WRAPS to a second line, which the one-line slot clips:
   * the bar is drawn whole or not at all. Nothing in the row shrinks.
   *
   * ⛔ WHY NOT "THE BAR SHRINKS FIRST". The first fix let the gap and the bar
   * shrink (`[flex-shrink:1000]`) before a `min-w-0 truncate` caption. Flex
   * shares an overflow by shrink factor × base size, so the caption still took
   * a sliver. Measured in Chromium at the landing bound (scale 1.36, Inter,
   * Paul's two MRR boards, fresh and stale): all 10 ranked captions painted an
   * ellipsis ("Driver 3 of 3 ranked in this r…"), each 0.15–0.17px short of its
   * natural width — invisible to the integer scrollWidth/clientWidth — and the
   * bar was squashed to 7.0–13.4px of its 40.8px, where `max(4px, pct%)` drew
   * 90b8's 31% as 54%.
   *
   * ⭐ THE CAPTION IN THE SLOT IS THE LONGEST FORM THAT FITS AT THE LANDING
   * BOUND (Canvas owner, 27 Sep 2026, landing text cap 1.36 → 1.64). At 1.64
   * the full `Driver N of M ranked in this run` is 253–260px and the stale
   * `Last run · Driver N of M ranked` 249–255px against a 220px measure, so the
   * slot prints `restingDriverCaption`: `Driver N of M ranked` (165–171px) and
   * `Last run · Driver N of M` (185–191px). The accessible name and the
   * tooltip keep the full sentence, and each short form is a prefix of it.
   *
   * WHERE THE BAR SHOWS (Inter at 11px × scale, a 220–223px measure): beside
   * its words at 100%; at the landing bound the caption plus the 6px gap and
   * the 49px counter-scaled track no longer fit (only `Driver 1 of 1 ranked`
   * does, at 219.7px), so the bar wraps away and its figure stays in the name
   * and the tooltip. `max-w-full truncate` on the caption is a last resort
   * only, for copy that no longer fits — pinned by
   * `FactorDriverLine.landingFit.spec.tsx`.
   *
   * The focus ring is inset so the slot's `overflow-hidden` cannot clip it.
   * Omitted → the free-flowing line (Detailed's Layer 2), unchanged.
   *
   * ⚠ `w-full` ON THE BUTTON IS LOAD-BEARING. A `<button>` shrinks to fit its
   * content even as a flex container, so without it the caption ran past the
   * slot and the slot's `overflow-hidden` cut it mid-glyph, "Last run · Driver
   * 1 of 6 analysec" (Paul's MRR screenshots, 27 Sep 2026). With it, the row
   * wraps at the slot's edge instead.
   */
  inSlot?: boolean
}

/** The bar's whole percentage, or null when there is no finite figure to draw. */
function barPercent(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value * 100)))
    : null
}

/**
 * NODE-ANATOMY v3.2 — the caption, without the caller's `Last run · ` prefix.
 * Current: `Driver N of M ranked in this run`; from the last run: `Driver N of M
 * ranked` (the contract's stale form drops "in this run" so it fits).
 */
export function driverLineCaption(rank: FactorDriverLineProps['rank'], fromLastRun = false, noValueYet = false): string {
  return noValueYet
    ? DRIVER_LINE_COPY.rankNoValue(rank.rank, rank.setSize, fromLastRun)
    : DRIVER_LINE_COPY.rank(rank.rank, rank.setSize, fromLastRun)
}

/**
 * The accessible name and the hover. For a factor the run held no value for
 * (PJ-B3) it opens with the owner's full sentence, `rankNoValueSentence`, in
 * place of the rank basis, and drops `question` ("How sure are you of its
 * value?"), which presupposes a value this factor does not have. The bar's
 * sentence is unchanged: the bar is drawn either way.
 */
export function driverLineExplanation({
  rank,
  value,
  fromLastRun = false,
  noValueYet = false,
}: Pick<FactorDriverLineProps, 'rank' | 'value' | 'fromLastRun' | 'noValueYet'>): string {
  const pct = barPercent(value)
  const bar = pct === null
    ? []
    : [`Bar: ${DRIVER_LINE_COPY.barNoun}, ${pct}% ${DRIVER_LINE_COPY.barRelativeTo}. ${DRIVER_LINE_COPY.relativeDisclosure}`]
  if (noValueYet) {
    return [`${DRIVER_LINE_COPY.rankNoValueSentence(rank.rank, rank.setSize, fromLastRun)}.`, ...bar].join(' ')
  }
  return [
    `${driverLineCaption(rank, fromLastRun)}. ${DRIVER_LINE_COPY.rankBasis}`,
    ...bar,
    DRIVER_LINE_COPY.question,
  ].join(' ')
}

/**
 * Paul 23 Sep contract feedback point 5 — what `of M` counts (the factors the
 * run ranked, each showing its own rank) and why any other factor carries no
 * rank. `M` is the caption's own `rank.setSize`; the cap is the owner's
 * `MAX_BADGED_RANK`. No other number is stated.
 */
export function driverLineDenominatorNote(rank: FactorDriverLineProps['rank'], fromLastRun = false): string {
  return DRIVER_LINE_COPY.denominator(rank.setSize, MAX_BADGED_RANK, fromLastRun)
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
  fromLastRun = false,
  noValueYet = false,
  testId = 'factor-driver-line',
  inSlot = false,
}: FactorDriverLineProps) {
  const pct = barPercent(value)
  const lastRun = fromLastRun ? LAST_RUN_PREFIX : ''
  // In the card's one-line slot: the longest form that fits it at the landing
  // bound (`restingDriverCaption`, Canvas owner 27 Sep 2026; for a factor the
  // run held no value for, `restingUnvaluedDriverCaption`, 28 Sep 2026).
  // Free-flowing (Detailed, popover) the line wraps, so it keeps the full
  // sentence. The accessible name and the hover keep the full sentence either way.
  const caption = inSlot
    ? noValueYet
      ? restingUnvaluedDriverCaption(rank, fromLastRun)
      : restingDriverCaption(rank, fromLastRun)
    : `${lastRun}${driverLineCaption(rank, fromLastRun, noValueYet)}`
  const explanation = `${lastRun}${driverLineExplanation({ rank, value, fromLastRun, noValueYet })}`
  const denominatorNote = driverLineDenominatorNote(rank, fromLastRun)
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={`${explanation} ${denominatorNote}`}>
      <button
        type="button"
        data-testid={testId}
        data-node-tooltip="true"
        aria-label={explanation}
        aria-description={denominatorNote}
        // The bar sits BESIDE its words (contract `.driver`), not pushed to the
        // card's far edge. Laid out as TEXT, not a flex row: at the 0.65 landing
        // zoom the counter-scaled caption wraps, and a flex-wrap row then put the
        // bar on a line of its own; inline, it follows the last word, so the card
        // is one line shorter (NODE-ANATOMY v3.2 L4: shorter cards, not smaller type).
        className={inSlot
          ? 'group nodrag nopan flex h-full w-full min-w-0 flex-wrap content-start items-center gap-x-1.5 gap-y-0 whitespace-nowrap text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info rounded'
          : 'group nodrag nopan mt-1 block max-w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded'}
        onClick={(e) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span
          data-testid={`${testId}-caption`}
          // Regular weight (contract `.driver`; audit T10): the rank is a finding
          // about the factor, secondary to its value line above.
          className={`${typography.edgeLabel} text-text-body underline-offset-[3px] group-hover:underline${inSlot ? ' shrink-0 max-w-full truncate' : ''}`}
        >
          {caption}
        </span>
        {/* No figure → no bar. In the slot the 6px before it is the row's
            `gap-x-1.5` (contract `.driver` gap 6px), which only exists while
            the bar shares the caption's line; free-flowing, it is `ml-1.5`. */}
        {pct !== null && (
          <span
            aria-hidden="true"
            data-testid={`${testId}-bar`}
            // The fixture's 30 × 3px, COUNTER-SCALED like the caption beside it
            // (`--canvas-label-scale`), so at the 0.65 landing zoom the bar keeps
            // its proportion to the words instead of shrinking to ~20 × 2px.
            // `shrink-0` in the slot: never squashed, so the fill always reads
            // against the whole track (see `inSlot`).
            className={`inline-block align-middle h-[calc(3px*var(--canvas-label-scale,1))] w-[calc(30px*var(--canvas-label-scale,1))] overflow-hidden rounded-full bg-panel-border${inSlot ? ' shrink-0' : ' ml-1.5'}`}
          >
            <span
              data-testid={`${testId}-bar-fill`}
              // `text-light` at 75%: the fixture's #908D8D neutral from the existing
              // token (Paul pt 9 — the bar must not compete with attention). No new colour.
              className="block h-full rounded-full bg-text-light/75"
              style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0%' }}
            />
          </span>
        )}
      </button>
    </Tooltip>
  )
}
