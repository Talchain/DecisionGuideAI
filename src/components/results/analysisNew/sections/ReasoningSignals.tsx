/**
 * Reasoning V2 — THE GROUNDED SIGNALS UNDER THE CHALLENGE: the three strongest
 * drivers, one tipping point, one assumption or evidence gap. Compact rows, at
 * rest, and nothing at all when the run gave nothing grounded.
 *
 * ⛔ THIS FILE SELECTS NOTHING AND WORDS NOTHING ABOUT THE RUN. Which rows
 * appear, with which ids, is `buildReasoningSignals`; every sentence is the
 * view model's or an existing copy owner's. Read that module's header before
 * changing what shows here.
 *
 * ⚠ ONE PRESENTATION EXCEPTION: THE DISPLAY ORDER OF THE THREE DRIVER ROWS.
 * See `byProducerRank` below — it re-orders the rows the builder selected by
 * the rank each row already prints, and changes nothing else.
 *
 * ⚠ NO PERCENTAGE ANYWHERE. The bar is `fraction` (magnitude / strongest in
 * this run), a rank comparison. The scale note that says so is reachable from
 * the info control, verbatim from `ANALYSIS_NEW_COPY.coverage`.
 *
 * ⚠ THE ACTS ARE THE CALLER'S. Focus, inspect and ask are handed in, so this
 * component cannot become a second focus or ask route. An absent handler hides
 * its control; a row without an id shows no controls at all.
 */
import { useState } from 'react'
import { Crosshair, Info, Search } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import type { AnalysisNewViewModel } from '../analysisNewTypes'
import { PanelIconButton } from '../PanelIconButton'
import { PanelFigure } from '../PanelFigure'
import { buildReasoningSignals, type FlipThresholdRow, type SignalDriverRow } from '../reasoningSignals'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'

export interface ReasoningSignalsProps {
  vm: Pick<AnalysisNewViewModel, 'status' | 'drivers' | 'uncertainty'>
  /**
   * `resultsSectionData.recommendation.flipThresholds` — the SAME array the
   * view model's `sensitivity.tippingPoints` is built from. Taken raw because
   * the strict gate drops `node_id`, and the row needs it to act.
   */
  flipThresholds: readonly FlipThresholdRow[] | null | undefined
  onFocus?: (targetId: string) => void
  onInspect?: (targetId: string) => void
  /** Receives an `openAskOlumi` payload; the body passes `openAskOlumi`. */
  onAsk?: (payload: AskOlumiPayload) => void
  testId?: string
}

/**
 * ⭐⭐ THE DRIVER ROWS READ IN THE ORDER OF THE NUMBER THEY PRINT (design
 * tweak C, 24 Sep 2026).
 *
 * WHY THEY WERE OUT OF ORDER. `buildReasoningSignals` takes the first three of
 * `vm.drivers.influenceRows`, which the builder sorts by `displayInfluence`
 * (this run's magnitude). The number each row prints is the PRODUCER's rank
 * (`influenceRank ?? rank`, via the finding's `Rank` inspect row). Those are
 * two different quantities, and on the served run they disagreed for the
 * lower two rows — so the zone printed "#1, #4, #3", a numbered list whose
 * numbers go backwards. A reader takes a numbered list to be in number order,
 * and reads that as broken.
 *
 * WHAT THIS DOES: sorts the SELECTED rows by that same printed rank, ascending,
 * so the list reads "#1, #3, #4". Stable, so rows with equal ranks keep the
 * builder's order; a row with no usable rank goes last, in builder order.
 *
 * ⛔ WHAT IT DOES NOT DO:
 *   · RENUMBER. The rank stays the producer's. A gap (here #2) stays a gap:
 *     that factor is controlled by the options, and the Drivers section's
 *     "not ranked here" line says so — the honest reading of the gap.
 *   · RESELECT. Which three rows appear is still the builder's decision.
 *   · RESCALE. Each bar keeps its own `fraction`; rows move whole. Where rank
 *     and magnitude disagree, the bars will not shrink monotonically down the
 *     list — which is the same disagreement the old order showed through the
 *     numbers, now shown through the bars, where it is not read as an error.
 */
function byProducerRank(rows: readonly SignalDriverRow[]): SignalDriverRow[] {
  const rankOf = (row: SignalDriverRow): number => {
    const n = row.rank === null ? NaN : Number(row.rank)
    return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
  }
  return rows
    .map((row, i) => ({ row, i, rank: rankOf(row) }))
    .sort((a, b) => (a.rank === b.rank ? a.i - b.i : a.rank - b.rank))
    .map(({ row }) => row)
}

interface RowActionsProps {
  focusId: string | null
  inspectId: string | null
  ask: AskOlumiPayload | null
  onFocus?: (targetId: string) => void
  onInspect?: (targetId: string) => void
  onAsk?: (payload: AskOlumiPayload) => void
  testId: string
}

/** At most three icon acts; none when the row names no model element. */
function RowActions({ focusId, inspectId, ask, onFocus, onInspect, onAsk, testId }: RowActionsProps) {
  const focus = focusId && onFocus ? () => onFocus(focusId) : null
  const inspect = inspectId && onInspect ? () => onInspect(inspectId) : null
  const askIt = ask && onAsk ? () => onAsk(ask) : null
  if (!focus && !inspect && !askIt) return null
  return (
    <span className="flex shrink-0 items-center" data-testid={`${testId}-actions`}>
      {focus ? (
        <PanelIconButton Icon={Crosshair} label={COPY.disclosure.focusTarget} onClick={focus} testId={`${testId}-focus`} />
      ) : null}
      {inspect ? (
        <PanelIconButton Icon={Search} label={ZONE.inspectInModel} onClick={inspect} testId={`${testId}-inspect`} />
      ) : null}
      {askIt ? <PanelIconButton ai label={ZONE.askAboutThis} onClick={askIt} testId={`${testId}-ask`} /> : null}
    </span>
  )
}

export function ReasoningSignals({
  vm,
  flipThresholds,
  onFocus,
  onInspect,
  onAsk,
  testId = 'analysis-new-signals',
}: ReasoningSignalsProps) {
  const [scaleOpen, setScaleOpen] = useState(false)
  const signals = buildReasoningSignals(vm, flipThresholds)
  if (!signals) return null
  const { tipping, gap } = signals
  const drivers = byProducerRank(signals.drivers)
  const scaleNoteId = `${testId}-scale-note`

  return (
    <div data-testid={testId}>
      {drivers.length > 0 ? (
        <div data-testid={`${testId}-drivers`}>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelMeta} text-text-light`}>{ZONE.driversKicker}</span>
            {/* The scale denial travels with the bars. The tooltip carries it
                for a pointer; the press shows it inline for touch, where a
                tooltip cannot be opened. Gated on the view model's own flag. */}
            {vm.drivers.influenceIsSetRelative ? (
              <PanelIconButton
                Icon={Info}
                label={COPY.coverage.setRelativeInfluence}
                onClick={() => setScaleOpen((v) => !v)}
                expanded={scaleOpen}
                testId={`${testId}-scale-info`}
              />
            ) : null}
          </div>
          {scaleOpen && vm.drivers.influenceIsSetRelative ? (
            <p id={scaleNoteId} className={`${typography.panelMeta} text-text-light`} data-testid={scaleNoteId}>
              {COPY.coverage.setRelativeInfluence}
            </p>
          ) : null}
          <ul className="list-none m-0 p-0">
            {drivers.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-1.5 py-1.5 border-b border-panel-border"
                data-testid={`${testId}-driver`}
                data-factor-id={row.id}
              >
                <span
                  className={`${typography.panelMeta} text-text-light w-6 shrink-0 tabular-nums`}
                  data-testid={`${testId}-driver-rank`}
                >
                  {row.rank ? `#${row.rank}` : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`${typography.panelBody} text-text-body block truncate`} title={row.label}>
                    {row.label}
                  </span>
                  <PanelFigure
                    variant="influence"
                    fraction={row.fraction}
                    className="mt-1"
                    testId={`${testId}-driver-bar`}
                  />
                </span>
                <RowActions
                  focusId={row.targetId}
                  inspectId={row.targetId}
                  ask={row.ask}
                  onFocus={onFocus}
                  onInspect={onInspect}
                  onAsk={onAsk}
                  testId={`${testId}-driver`}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tipping ? (
        <div
          className="flex items-start gap-1.5 py-1.5 border-b border-panel-border"
          data-testid={`${testId}-tipping`}
          data-target-id={tipping.targetId ?? undefined}
        >
          <p className={`${typography.panelBody} text-text-body min-w-0 flex-1`} data-testid={`${testId}-tipping-sentence`}>
            {tipping.sentence}
          </p>
          <RowActions
            focusId={tipping.targetId}
            inspectId={tipping.targetId}
            ask={tipping.ask}
            onFocus={onFocus}
            onInspect={onInspect}
            onAsk={onAsk}
            testId={`${testId}-tipping`}
          />
        </div>
      ) : null}

      {gap ? (
        <div
          className="flex items-start gap-1.5 py-1.5 border-b border-panel-border"
          data-testid={`${testId}-gap`}
          data-finding-id={gap.findingId}
          data-gap-kind={gap.kind}
        >
          <span className="min-w-0 flex-1">
            <span className={`${typography.panelBody} text-text-body block`} data-testid={`${testId}-gap-headline`}>
              {gap.headline}
            </span>
            {gap.detail ? (
              <span className={`${typography.panelMeta} text-text-light block`} data-testid={`${testId}-gap-detail`}>
                {gap.detail}
              </span>
            ) : null}
          </span>
          <RowActions
            focusId={gap.focusTargetId}
            inspectId={gap.inspectTargetId}
            ask={gap.ask}
            onFocus={onFocus}
            onInspect={onInspect}
            onAsk={onAsk}
            testId={`${testId}-gap`}
          />
        </div>
      ) : null}
    </div>
  )
}
