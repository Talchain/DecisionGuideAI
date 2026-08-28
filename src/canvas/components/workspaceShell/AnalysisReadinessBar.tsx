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

  // ⭐ THE ONE DISCRIMINATOR THIS LAYOUT TURNS ON, and it is the SAME condition
  // that already chooses `<ul>` over `<p>` below — not a second, parallel test
  // that could drift away from it.
  //
  // MEASURED DEFECT (deployed `a9fc1564`, driven as a guest, Olumi tab, default
  // 416px dock): this bar took 465px of the panel's 772px — 60% — leaving the
  // conversation 132px to hold 1,615px of content, i.e. 8% of it visible. At
  // the 280px dock floor the same state measured 1,392px of bar and a 68px
  // sentence column, about eight characters per line. Three causes, all here:
  // no height bound on a `flex-shrink-0` element; `items-center` on a row whose
  // text child was 448px and whose button was 30px, which floated the button
  // against the middle of the list; and the run control sharing the sentence
  // column's row, cutting the text to 220px of 414.
  //
  // Only the LIST case gets the column treatment. The common short state keeps
  // today's compact row exactly — a fix for the large case must not cost the
  // small one a row of height it does not need.
  const hasSentenceList = display.sublineSentences !== undefined && display.sublineSentences.length > 1

  /* Defined ONCE and placed ONCE — the discriminator below chooses WHERE they
     sit, so the two layouts cannot drift into two different sets of controls. */
  const actions = (
    <>
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
    </>
  )

  return (
    <div
      className={`bg-panel border-t border-panel-border px-3 py-2 flex gap-3 ${
        hasSentenceList ? 'flex-col' : 'items-center'
      }`}
      data-testid="analysis-readiness-bar"
      data-blocked={blocked ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      <div className={`flex min-w-0 flex-1 gap-3 ${hasSentenceList ? 'items-start' : 'items-center'}`}>
        <span
          aria-hidden
          className={`h-2 w-2 flex-none rounded-full ${DOT_CLASSES[display.dot]}${hasSentenceList ? ' mt-1' : ''}`}
        />
        <div className="min-w-0 flex-1" {...(readinessCheck ? { 'data-testid': 'analysis-readiness-bar-outage' } : {})}>
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
            ⚠ `space-y-1`, NOT `PanelFooter`'s `space-y-0.5`. Mirroring the
            neighbour exactly was the first instinct and the shell's
            zero-tolerance conformance guard refused it: 2px is off the DS
            spacing scale (4·8·12·16·20·24·32·40·48·56·64), and this module
            admits no exceptions. 4px is both the scale value and
            `PANEL_LIST_BULLET`'s rhythm, so the bar now agrees with the
            conversation surface instead. `PanelFooter`'s 2px is the outlier —
            it sits outside the shell module, which is the only reason it
            survives. Converging it is a separate, visible change. */}
          {display.subline && (
            // ⚠ ONE TESTID SPANS BOTH BRANCHES, AND THAT IS THE POINT. Putting it
            // on the `<p>` alone made `analysis-readiness-bar-reason` addressable
            // ONLY in the one-sentence case — the exact mirror of the defect
            // `PanelFooter`'s own comment records (there the SINGLE-sentence
            // branch was the unaddressable one). A sibling spec that had pinned
            // "the reason survives the tab change" went red, correctly, because
            // the reason had become unfindable in the case it was written for.
            // The wrapper renders only when there IS a subline, so
            // `queryByTestId(...)` still returns null when nothing is refusing.
            <div data-testid="analysis-readiness-bar-reason">
              {display.sublineSentences !== undefined && display.sublineSentences.length > 1 ? (
                // ⚠ BOUNDED, AND IT SCROLLS RATHER THAN CLIPPING. A clipped
                // producer sentence reads as a DIFFERENT sentence, which is the
                // one thing this surface must never do — so the bound caps how
                // much is shown at once, never how much exists.
                // `tabIndex={0}` because a scrollable region must be reachable by
                // keyboard (WCAG 2.1.1); without it the overflow is mouse-only.
                // `max-h-40` (160px) ≈ eight lines of `panelMeta`, which is the
                // point where the bar stops competing with the conversation it
                // sits under. It is a BACKSTOP: the intended fix for long lists
                // is progressive disclosure, not scrolling.
                <ul
                  className={`${typography.panelMeta} text-text-light list-disc space-y-1 pl-4 max-h-40 overflow-y-auto`}
                  data-testid="analysis-readiness-bar-reason-list"
                  tabIndex={0}
                >
                  {display.sublineSentences.map((sentence, index) => (
                    <li key={`${index}:${sentence}`}>{sentence}</li>
                  ))}
                </ul>
              ) : (
                <p className={`${typography.panelMeta} text-text-light`}>{display.subline}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {/* ⭐ THE RUN CONTROL LEAVES THE SENTENCE COLUMN'S ROW. While it shared that
          row it took ~150px of 414 and the producer's sentences wrapped in the
          220px left over (196px after `pl-4`) — roughly thirty characters a
          line. Stacked, they get the panel's full width. The compact state
          keeps the control beside the text, where it costs nothing.

          ⚠ ONE DOM POSITION IN BOTH LAYOUTS, AND THAT IS THE POINT. The first
          cut rendered `{actions}` in two different parents and chose between
          them — which makes React unmount and remount the button when the
          blockers clear. `OutputsDock.readinessSurvivesTabChange` caught it:
          it pins THE SAME DOM NODE across "blocked → the producer answers →
          the button enables", not merely "a button is enabled". Identity is
          the contract; only the CLASSES may branch.

          ⚠ `gap-3`, NOT `gap-2`, AND THE VISUAL CHECK IS WHY. Retry and Analyse
          were previously separated by the ROOT's `gap-3`; wrapping them at
          `gap-2` narrowed that to 8px and shifted Retry 4px right — 227 pixels
          of diff on the `olumi-tab` reference, in the OUTAGE arm, which is the
          one seeded state that renders both buttons. Every class assertion in
          this lane's specs still passed: they check the ROOT's layout, and this
          moved a child. The compact case must stay pixel-identical to today —
          only the LIST case is meant to look different. */}
      <div className={`flex gap-3 ${hasSentenceList ? 'justify-end' : 'flex-none items-center'}`}>{actions}</div>
    </div>
  )
}
