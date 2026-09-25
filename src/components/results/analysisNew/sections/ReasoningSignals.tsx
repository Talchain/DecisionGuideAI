/**
 * Reasoning V2 — THE GROUNDED SIGNALS UNDER THE CHALLENGE: the three strongest
 * drivers, one tipping point, one assumption or evidence gap. Compact rows, at
 * rest, and nothing at all when the run gave nothing grounded.
 *
 * ⛔ THIS FILE SELECTS NOTHING AND WORDS NOTHING ABOUT THE RUN. Which rows
 * appear, in what order, with which ids, is `buildReasoningSignals`; every
 * sentence is the view model's or an existing copy owner's. Read that module's
 * header before changing what shows here.
 *
 * ⚠ NO PERCENTAGE ANYWHERE. The bar is `fraction` (magnitude / strongest in
 * this run), a rank comparison. The scale note that says so is reachable from
 * the info control, verbatim from `ANALYSIS_NEW_COPY.coverage`.
 *
 * ⚠ THE ACTS ARE THE CALLER'S. Focus, inspect and ask are handed in, so this
 * component cannot become a second focus or ask route. An absent handler hides
 * its control; a row without an id shows no controls at all.
 */
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Crosshair, Info, Search } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import type { AnalysisNewViewModel } from '../analysisNewTypes'
import { PanelIconButton } from '../PanelIconButton'
import { PanelFigure } from '../PanelFigure'
import { action } from '../panelSurfaces'
import { buildReasoningSignals, type FlipThresholdRow } from '../reasoningSignals'
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
  /**
   * ⭐ V2 PROTOTYPE (`challengeHTML`): at rest the challenge is compact, and the
   * drivers' bars and the gap sit behind ONE closed "Assumptions and
   * evidence" disclosure. The Reasoning tab passes `true`; measured on served
   * `7f39c88b` at 1440×900, the open list was 189px of the challenge zone and
   * kept the provisional qualifier below the fold. Default `false` keeps every
   * other caller unchanged.
   */
  closedAtRest?: boolean
  /**
   * ⭐ V2 prototype: "Assumptions and evidence … holds the drivers and
   * evidence". The Reasoning tab passes its "What moves the outcome" block
   * here, so it renders INSIDE the door instead of as its own block on the
   * default scroll. Rendered only while the door is open.
   */
  evidenceSlot?: ReactNode
  testId?: string
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
  closedAtRest = false,
  evidenceSlot = null,
  testId = 'analysis-new-signals',
}: ReasoningSignalsProps) {
  const [scaleOpen, setScaleOpen] = useState(false)
  const [open, setOpen] = useState(!closedAtRest)
  const signals = buildReasoningSignals(vm, flipThresholds)
  // Nothing to disclose ⇒ no door either: an empty disclosure is a dead control.
  if (!signals) {
    if (!evidenceSlot) return null
    return (
      <div data-testid={testId}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`${typography.panelBody} ${action('disclose')}`}
          data-testid={`${testId}-disclose`}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-text-light ${open ? 'rotate-90' : ''}`}
            aria-hidden={true}
          />
          {ZONE.assumptionsAndEvidence}
        </button>
        {open ? <div className="mt-1">{evidenceSlot}</div> : null}
      </div>
    )
  }
  const { drivers, tipping, gap } = signals
  /**
   * ⭐ THE TIPPING CONDITION STAYS AT REST, open or closed. It is the one line
   * that says what would change the answer, and a closed row labelled
   * "Assumptions and evidence" does not advertise it
   * (`aRowThatPromisesNothingMayNotHide.spec.tsx`). It only renders on a run
   * licensed to name a leader, so on a withheld run the rest state stays one
   * line of drivers plus the door.
   */
  const tippingRow = tipping ? (
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
  ) : null
  if (!open) {
    // ⭐⭐ PAUL'S RULING OF 18 SEP SURVIVES THE COMPACT REST STATE: the drivers
    // are READ BEFORE the answer. So the rest state still names them, ranked
    // by the producer (the gap in "#1, #2, #5" is real and is kept), on one
    // line; only their bars, the gap and the drivers' acts move behind the
    // disclosure. The tipping row stays (see `tippingRow`).
    return (
      <div data-testid={testId} className="space-y-0.5">
        {/* ⭐ V2 prototype (22 Sep, supersedes the 18 Sep rest line): at rest the
            zone shows ONLY the "Assumptions and evidence" door; the ranked
            drivers, their bars and the evidence gap all live behind it. */}
        {tippingRow}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className={`${typography.panelBody} ${action('disclose')}`}
          data-testid={`${testId}-disclose`}
        >
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-light" aria-hidden={true} />
          {ZONE.assumptionsAndEvidence}
        </button>
      </div>
    )
  }
  const scaleNoteId = `${testId}-scale-note`

  return (
    <div data-testid={testId}>
      {closedAtRest ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-expanded={true}
          className={`${typography.panelBody} ${action('disclose')} mb-1`}
          data-testid={`${testId}-disclose`}
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-light" aria-hidden={true} />
          {ZONE.assumptionsAndEvidence}
        </button>
      ) : null}
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

      {tippingRow}

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
      {evidenceSlot ? <div className="mt-2">{evidenceSlot}</div> : null}
    </div>
  )
}
