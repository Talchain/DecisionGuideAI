/**
 * AnalysisReadinessBar — the pre-run readiness statement, on the surface the
 * product's own advice sends the user to.
 *
 * ── THE WITNESSED DEFECT (fresh guest, headful Chrome, 20 Aug 2026) ────────
 * With the run blocked, the Analysis footer says, verbatim:
 *
 *     "4 parts of your model are not ready for analysis yet.
 *      Ask in the chat what they need."
 *
 * Selecting the Olumi tab — doing exactly that — UNMOUNTS the whole
 * pre-analysis subtree, because `OutputsDock` renders it under
 * `{effectiveActiveTab === 'results' && …}`. The sentence and the Analyse
 * control both leave the DOM. The instruction destroyed its own context: the
 * user arrives in the chat with nothing on screen saying what they came to ask
 * about, and no control to run once the answer lands.
 *
 * ── WHAT THIS BAR IS, AND THE FOUR THINGS IT DELIBERATELY IS NOT ───────────
 * The shell hosts it in its reserved footer region, declared by the Olumi
 * surface as `footerBar: 'readiness'` (`shellContract.ts`) — the same mechanism
 * the Model surface uses to ask for `ReanalyseBar`, and for the same underlying
 * reason: the control that surface needs is mounted on `results` only.
 *
 *  1. NOT A SECOND GATE. `canRun` and `blockedReason` are the shell's own
 *     `canRunAnalysis` / `runBlockedTooltip` — the SAME two values the Analysis
 *     footer's button and title are derived from, computed once in
 *     `OutputsDock` above the tab branch. Nothing is re-derived here.
 *  2. NOT A SECOND RUNNER. `onAnalyse` is `handleRunAnalysis`, the canonical
 *     runner registered in `canonicalRunRegistry`. The retired
 *     `StaleAnalysisBadge` is the counter-example: its rerun bypassed it.
 *  3. NOT A FRESHNESS SURFACE. It renders only PRE-RUN. Staleness after a
 *     completed analysis belongs to the freshness strip and `ReanalyseBar`.
 *  4. ⭐ NOT A SECOND OPINION ABOUT WHAT TO SAY — AND THIS ONE IT GOT WRONG
 *     THE FIRST TIME. It shipped with a two-arm expression
 *     (`blocked ? notReady : ready`) beside the footer's four-arm ladder, and
 *     on a reachable state the two contradicted each other: with neither
 *     readiness authority having answered, the footer said "Readiness not
 *     checked yet" (warning) and this bar said "Analysis available" (green) —
 *     the confident claim, on the surface the advice sends the user to. Both
 *     surfaces now call `deriveReadinessDisplay`, which is the one owner.
 *     `readinessDisplay.ts`'s header carries the ladder and the measurement.
 *
 * ⚠ THE BUTTON'S HONESTY IS THE POINT AND IS NOT NEGOTIABLE. It is `disabled`
 * on exactly `!canRun`, and carries the gate's own sentence as its `title`. It
 * must never look pressable while the gate is shut.
 */

import { RefreshCw } from 'lucide-react'
// ⚠ THE MODULE, NOT THE `components/ui` BARREL. Measured: the barrel re-exports
// the whole brick set, which pulls six unrelated files into the DOCK'S
// TRANSITIVE IMPORT CLOSURE — the scope of the raw-typography rule — and REDs
// `tests/ci-guards/shell-conformance.spec.ts` ("no file in the dock closure
// gains raw typography"): DeltaInterpretation +1, RangeChips +3, RangeLabels
// +3, ScoreChip +1, VerdictCard +1, FieldLabel +2. It does NOT move
// `ci:guard:ds:enforce`, which stays EXIT=0 with `panel-typography-scoped` Δ+0
// — naming that guard here would send the next reader to a check that cannot
// reproduce the finding.
import { Button } from '../../../components/ui/Button'
import { typography } from '../../../styles/typography'
import { FOOTER_COPY } from '../pre-analysis-v3/constants'
import {
  deriveReadinessDisplay,
  gateBlockedSubline,
  RESTING_AVAILABLE,
  type ReadinessCheckFacts,
  type ReadinessDot,
} from '../pre-analysis-v3/footer/readinessDisplay'

/** The shell's copy of the panel's dot palette, keyed off the shared type so a
 *  new dot cannot be added in one place and missed here. */
const DOT_CLASSES: Record<ReadinessDot, string> = {
  muted: 'bg-text-light',
  warning: 'bg-warning',
  success: 'bg-success',
}

export interface AnalysisReadinessBarProps {
  /**
   * True while no analysis has completed AND there is a model to analyse —
   * i.e. exactly when the Analysis surface would be showing its pre-run panel.
   * The bar makes no claim outside that window.
   */
  preRunWithModel: boolean
  /** OutputsDock's `canRunAnalysis`. The run gate, not a copy of it. */
  canRun: boolean
  /** OutputsDock's `runBlockedTooltip`. Only read while the gate is shut. */
  blockedReason?: string
  /**
   * OutputsDock's `runBlockedSentences` — the producer's sentences BEHIND
   * `blockedReason`, from the same call that produced the string.
   *
   * ⚠ ADDITIVE, AND THE DEFAULT IS TODAY'S BEHAVIOUR. Omit it and this surface
   * renders the joined paragraph exactly as it always has. It is not this
   * component that decides the array is trustworthy: `deriveReadinessDisplay`
   * carries it through ONLY when its join equals the VETTED subline, because
   * `vetBlockedReason` can SUBSTITUTE a composed fallback for producer text it
   * will not pass. Handing it straight to the markup would put our fallback in
   * one surface and the producer's sentences in the other.
   *
   * `PanelFooter` — the other reader of the same `deriveReadinessDisplay`, fed
   * the same two values from the same component — has taken this since #883.
   * This bar taking it too is what stops the two pre-run surfaces telling one
   * state in two shapes.
   */
  blockedSentences?: readonly string[]
  /** OutputsDock's `isRunning`. */
  isAnalysing: boolean
  /**
   * Non-null only when the readiness CHECK failed. Outranks the gate copy —
   * the gate blocks only on `readiness && !can_run_analysis`, so an unreachable
   * readiness service leaves `canRun` TRUE, and without this arm the bar would
   * render a green "Analysis available" straight through an outage.
   */
  readinessCheck?: (ReadinessCheckFacts & { retry: () => void }) | null
  /** `readinessNothingHasAnswered(...)` — neither authority has spoken. */
  nothingHasAnswered: boolean
  /** OutputsDock's `handleRunAnalysis` — the canonical runner. */
  onAnalyse: () => void
}

export function AnalysisReadinessBar({
  preRunWithModel,
  canRun,
  blockedReason,
  blockedSentences,
  isAnalysing,
  readinessCheck = null,
  nothingHasAnswered,
  onAnalyse,
}: AnalysisReadinessBarProps) {
  // Outside the pre-run window the Analysis surface itself shows no readiness
  // panel, so there is nothing to carry and a bar here would be a claim no
  // other surface is making.
  if (!preRunWithModel) return null

  const blocked = !canRun && !isAnalysing
  // ⚠ `resting` is the ONLY arm this surface supplies itself, and it says LESS
  // than the panel's rather than something different: same headline
  // (`FOOTER_COPY.ready`), no subline. The panel can add whether success is
  // defined or estimates are uncalibrated; the shell has no `PreAnalysisModel`
  // and must not invent the difference.
  const display = deriveReadinessDisplay({
    readinessCheck,
    isAnalysing,
    canRun,
    blockedReason,
    blockedSentences,
    nothingHasAnswered,
    resting: RESTING_AVAILABLE,
  })

  return (
    <div
      className="bg-panel border-t border-panel-border px-3 py-2 flex items-center gap-3"
      data-testid="analysis-readiness-bar"
      data-blocked={blocked ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`h-2 w-2 flex-none rounded-full ${DOT_CLASSES[display.dot]}`}
      />
      <div
        className="min-w-0 flex-1"
        {...(readinessCheck ? { 'data-testid': 'analysis-readiness-bar-outage' } : {})}
      >
        <p className={`${typography.panelBody} text-text-header`} data-testid="analysis-readiness-bar-headline">
          {display.headline}
        </p>
        {/* THE PRODUCER'S SENTENCES ARE A LIST, NOT A PARAGRAPH — the same shape
            `PanelFooter` has rendered since #883, on the surface that was still
            joining them. Witnessed on deployed staging `236bb14a`, 28 Aug 2026:
            603 characters of four concatenated question-pairs in one unbroken
            line. The join is UNBOUNDED and nothing truncates it.
            Nothing is truncated or summarised — the contract forbids both, so
            we never put our words in the producer's mouth. The SAME bytes
            render one per line, and `display.subline` stays their exact join
            for the disabled control's `title` below.
            ⚠ ONE sentence stays a sentence: a list of one renders a bullet
            where prose belonged, which would be a regression in the common
            small case bought with a fix for the large one.
            ⚠ THE CLASSES MIRROR `PanelFooter` EXACTLY, deliberately. These two
            surfaces state one thing and must look like one thing; matching the
            neighbour beats matching `PANEL_LIST_BULLET`, which governs the
            conversation surface and carries `space-y-1` rather than the footer's
            `space-y-0.5`. Converging those two rhythms is a separate, visible
            change and wants the visual harness. */}
        {display.sublineSentences !== undefined && display.sublineSentences.length > 1 ? (
          <ul
            className={`${typography.panelMeta} text-text-light list-disc space-y-0.5 pl-4`}
            data-testid="analysis-readiness-bar-reason-list"
          >
            {display.sublineSentences.map((sentence, index) => (
              <li key={`${index}:${sentence}`}>{sentence}</li>
            ))}
          </ul>
        ) : (
          display.subline && (
            <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-readiness-bar-reason">
              {display.subline}
            </p>
          )
        )}
      </div>
      {/* The check can be retried without touching the run. Deliberately NOT a
          gate: the verdict is the server's, and this asks it again — it never
          decides in its place. Same affordance the Analysis footer offers, so
          the route stays usable on whichever surface the user is standing. */}
      {readinessCheck && (
        <Button
          size="sm"
          variant="secondary"
          className="flex-none"
          onClick={readinessCheck.retry}
          aria-label={FOOTER_COPY.readinessRetry}
          data-testid="analysis-readiness-bar-retry"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
      {/* ⚠ THE SHARED `Button`, NOT A HAND-ROLLED ONE. The blocked treatment on
          the Analysis surface — `opacity 0.4`, `cursor: not-allowed`, an
          explanatory `title` — belongs to that component
          (`disabled:opacity-40 disabled:cursor-not-allowed`). Re-implementing it
          here would put a SECOND blocked appearance for the SAME state one tab
          away from the first. */}
      <Button
        size="sm"
        className="flex-none"
        onClick={onAnalyse}
        disabled={isAnalysing || !canRun}
        title={blocked ? gateBlockedSubline(blockedReason) : undefined}
        data-testid="analysis-readiness-bar-analyse"
      >
        {isAnalysing ? FOOTER_COPY.analysing : FOOTER_COPY.analyse}
      </Button>
    </div>
  )
}
