/**
 * NodeChip — outlined AI coaching chip for canvas nodes.
 *
 * Intent metadata is MANDATORY (A1 meta-decision diagnosis, 2026-07-20):
 * these chips are product-authored prompts, so their intent is known at
 * authoring time and must ship on the wire instead of being re-inferred
 * from message text by CEE's heuristics (the "Run the analysis now" chip
 * was folded into a clarify round as a brief "answer" because it arrived
 * as anonymous text).
 *
 * - `chipId`: stable identity, ships as `chip.parameters.chip_id`.
 * - `actionType`: wire intent from the @talchain/schemas ActionType enum
 *   (strict at CEE ingress), or null when the vocabulary has no honest
 *   value for a coaching chip — never force a wrong one.
 *
 * Send path, in two branches:
 *
 * 1. A chip whose declared intent is `run_analysis` is a RUN affordance, and
 *    every run affordance executes the ONE canonical pipeline registered by
 *    OutputsDock (`canonicalRunRegistry`) — never its own dispatch. Going
 *    direct to `_dispatchAction` skipped the readiness gate, the
 *    `flushPendingSaves()` barrier (so a run inside the 1500ms autosave
 *    debounce resolved against the PREVIOUS persisted graph) and the stored
 *    `goal_threshold` re-attachment (so the user's saved success target was
 *    silently dropped) — the same three losses the canvas shortcut and the
 *    command palette were converged onto the canonical runner to avoid.
 *    The branch keys on the DECLARED actionType, not on a hand-listed set of
 *    "run chips", so a future chip that declares run intent converges by
 *    construction rather than by someone remembering to add it.
 * 2. Every other chip is a coaching prompt: prefer the unified dispatcher
 *    (`_dispatchAction`, the only bridge that carries chip metadata); fall
 *    back to `_sendMessage` so the click still lands on hosts that
 *    registered only the legacy bridge.
 *
 * ⭐ THE REFUSAL IS ON THE CHIP BEFORE THE CLICK, NOT ONLY AFTER IT
 * (29 Aug 2026, measured on the deployed build — see below).
 *
 * On a starter, `canRunAnalysis` refuses at the `analysisHeldOn` rung and the
 * click DOES answer: a warning toast reading "Analysis is held on a saved
 * example. Re-draft it live to run one." appears within 300 ms. Two things
 * were nonetheless wrong, and only the first is fixed here:
 *
 *  1. THE CHIP AND THE DOCK BUTTON DISAGREED ABOUT THE SAME STATE. On the
 *     same screen, `pre-analysis-v3-analyse` carried `disabled` and that
 *     sentence as its `title`, while this chip looked live and said nothing
 *     until clicked. Two surfaces, one state, two stories — the class this
 *     estate keeps paying for. The notice now rides the chip as its `title`,
 *     from the SAME authority the gate and the banner read
 *     (`analysisHeldNotice`), so the three cannot drift apart.
 *
 *     ⚠ The chip is deliberately NOT disabled and NOT hidden (Paul's ruling,
 *     29 Aug: no hiding, no workarounds, caveat instead). A disabled control
 *     cannot explain itself on click, and the click's toast is the one place
 *     the remedy is named. Caveat before, answer after.
 *
 *  2. NOT FIXED, AND NAMED RATHER THAN CARRIED SILENTLY: the toast auto-
 *     dismisses after 5000 ms (`ToastContext.AUTO_DISMISS_MS.warning`) and
 *     carries no route to the remedy it names. While the starter banner is on
 *     screen its "Re-draft this live" button IS that route; once the user
 *     dismisses the banner there is no on-screen way to the action the
 *     refusal prescribes. Changing the warning dismissal policy is global and
 *     out of this seam; wiring a toast action needs the banner's redraft.
 *     Rowed, not hidden.
 *
 * ⚠ AND THE INSTRUMENT NOTE, because it cost this lane four probes and very
 * nearly a wrong verdict: every toast read taken ≥6 s after the click returns
 * an EMPTY array, which is indistinguishable from "the button does nothing".
 * The original report of a dead control was this artefact. Read toasts with a
 * MutationObserver, or inside 5 s.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ActionTypeLiteral } from '@talchain/schemas/boundary'
import type { PendingWireActionType } from '../../conversation/chipMeta'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { executeCanonicalRun } from '../../analysis/canonicalRunRegistry'
import { analysisHeldNotice } from '../../utils/analysisHeldOnInjectedModel'
import { useShowToastSafe } from '../../ToastContext'
import { typography } from '../../../styles/typography'
import { CANVAS_MIN_TARGET_BOX_STYLE } from './canvasGlyphScale'

interface NodeChipProps {
  label: string
  message: string
  /** Stable chip identity — ships as chip.parameters.chip_id. */
  chipId: string
  /**
   * Wire intent: a published ActionType value (sent), a signed-off pending
   * value (withheld by buildV5Payload's schema-derived gate until the
   * schema re-vendor), or null when no honest value exists.
   */
  actionType: ActionTypeLiteral | PendingWireActionType | null
}

export function NodeChip({ label, message, chipId, actionType }: NodeChipProps) {
  const showToast = useShowToastSafe()
  const [unavailable, setUnavailable] = useState(false)
  const hasConversation = useGuidanceStore((s) => Boolean(s._dispatchAction || s._sendMessage))
  useEffect(() => {
    if (hasConversation) setUnavailable(false)
  }, [hasConversation])

  /**
   * The refusal this chip would produce if clicked, or null when it would not
   * be refused for this reason.
   *
   * Derived HERE rather than passed in by each node, for the reason branch 1
   * already gives: keying on the DECLARED `actionType` means a future run chip
   * carries the caveat by construction, instead of by someone remembering to
   * thread a prop through a third node component. `analysisHeldNotice` returns
   * one of two module constants or null, so the selector's result is reference-
   * stable and a re-render happens only on a genuine flip.
   *
   * ⚠ It is NOT the whole gate. `canRunAnalysis` refuses for several other
   * reasons (in-flight, empty graph, unsettled draft, validation blockers), and
   * this shows only the held-model rung — the one a starter user meets, and the
   * one whose sentence has a single owner. A chip that stays silent here may
   * still be refused on click, which is why the click keeps answering.
   */
  const heldNotice = useCanvasStore((s) =>
    actionType === 'run_analysis' ? analysisHeldNotice(s) : null,
  )

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // Run affordance → the one canonical pipeline. `chip_id` provenance rides
    // through the registry's `parameters` channel, so the wire still carries
    // which chip started the run; OutputsDock merges the stored
    // `goal_threshold` alongside it.
    if (actionType === 'run_analysis') {
      void executeCanonicalRun({
        source: 'node-chip',
        parameters: { chip_id: chipId },
      }).then((outcome) => {
        // Never a silent click: every non-start outcome carries a reason or
        // a state the user can see.
        if (outcome.status === 'blocked') {
          showToast(outcome.reason, 'warning')
        } else if (outcome.status === 'unavailable') {
          showToast(outcome.reason, 'error')
        } else if (outcome.status === 'already-running') {
          showToast('An analysis is already running.', 'info')
        }
        // ROADMAP 2.1229 — the direct-V2 arm and its 'Running analysis…' toast
        // are gone with the `/v2/run` seam. The surviving 'dispatched' arm
        // needs no toast: its V5 chip turn is itself visible in the
        // conversation.
      }).catch((err: unknown) => {
        console.error('[NodeChip] canonical run failed:', err)
        showToast('Analysis failed. Please try again.', 'error')
      })
      return
    }

    setUnavailable(false)
    const callbacks = useGuidanceStore.getState()
    if (callbacks._dispatchAction) {
      callbacks._dispatchAction({
        ...(actionType ? { action_type: actionType } : {}),
        parameters: { chip_id: chipId },
        label,
        message,
        source: 'chip',
      })
      return
    }
    // Legacy bridge — metadata cannot travel; the message still lands.
    const send = callbacks._sendMessage
    if (send) {
      send(message)
      return
    }
    // Keep the question available without pretending that an unregistered
    // conversation accepted it. Inline feedback also works without a toast host.
    setUnavailable(true)
  }, [message, label, chipId, actionType, showToast])

  return (
    <>
    <button
      type="button"
      // ⭐ 24px TOUCH TARGET ON A SURFACE ARGUED FOR TOUCH (WCAG 2.2 AA, 2.5.8).
      //
      // #1061 moves these chips onto the card because a hover popover cannot be
      // reached on a touch device — so landing them under the minimum would
      // answer the wrong half of that argument.
      //
      // Expanded with a pseudo-element rather than padding so the chip's PAINTED
      // size and the row's density are unchanged: the same instrument used on the
      // quick-actions button in #1049, and for the same reason.
      //
      // ⛔⛔ AND THAT WAS NOT ENOUGH, FOR TWO REASONS THIS BLOCK USED TO STATE
      // AS FEATURES. Corrected by derivation at the tip, not measured in a
      // browser here:
      //
      //  1. ⚠ THE ARITHMETIC WENT STALE UNDER IT. This said *"edgeLabel is 10px
      //     with leading-tight (12.5px line box)"*. `#1527` raised `edgeLabel`
      //     10 → 11 and it carries `leading-snug` (1.375): the line box is
      //     15.125px. A hand-copied token value in the one comment that sizes a
      //     WCAG target — CLAUDE.md trap 12, in miniature.
      //
      //  2. ⭐⭐ "CSS px at zoom 1" IS THE WHOLE DEFECT, NOT A CAVEAT. This DOM
      //     lives inside React Flow's viewport transform and the product parks
      //     the user at `LABEL_LEGIBLE_ZOOM` (0.50) — the rung there is `quiet`,
      //     so the body and this chip ARE rendered. `py-0.5`, the 1px border and
      //     `before:-inset-y-[3px]` are all UNSCALED, and the slop is measured
      //     from the PADDING box so it clears the border by only 2px per side:
      //
      //        painted  15.125 + 6 x zoom  = **18.125px** at the settle zoom
      //        hit      15.125 + 10 x zoom = **20.125px** at the settle zoom
      //
      //     A guideline satisfied in the producer's units, handed to the user
      //     3.875px short — the same class of miss `canvasGlyphScale.ts` exists
      //     to close, reached here through a comment rather than a class.
      //
      // `CANVAS_MIN_TARGET_BOX_STYLE` floors the BOX at `MIN_TARGET_RENDERED_PX`
      // in RENDERED px, which takes the painted chip to 24px and the hit area to
      // 26px at the settle zoom (28px at zoom 1). ⭐ THE SLOP AND `py-0.5` ARE
      // DELIBERATELY UNTOUCHED: raising the slop instead would need the fifteen
      // `flex gap-1 flex-wrap` chip rows widened past `gap > 2 x slop` or a
      // wrapped line would steal its neighbour's clicks — and these chips are
      // DIFFERENT QUESTIONS, so a near miss sends the wrong one to the model.
      // A painted box cannot overlap its flex neighbours; see that constant's
      // header for why the box, and not the slop, is the right instrument.
      //
      // ⭐⭐ THE CHROME RECEDES AT REST; THE TEXT DOES NOT.
      //
      // Measured on the fresh draft: **14 of 20 cards carry one of these**, and
      // that is the DESIGN — the comment on `FactorNode`'s cardQuestion says it
      // outright: *"this is the one that must be reachable without hovering."*
      // Each chip was right on its own card. The aggregate was not: twenty
      // bordered boxes, identical in weight, competing with the content they
      // sit under. Paul, 15 Sep: *"it looks an absolute mess."*
      //
      // So nothing is removed and nothing moves. The BORDER and the FILL are
      // dropped at rest and returned when the card has the reader's attention —
      // `group-hover` and `group-focus-within` off the card root's existing
      // `group` (`BaseNode.tsx:838`), plus the chip's own hover.
      //
      // ⚠ CONTRAST IS DELIBERATELY UNTOUCHED. `text-text-body` stays at rest,
      // so the sentence is exactly as legible as before and no WCAG 1.4.3
      // question is reopened — the quietening is chrome only. Dimming the TEXT
      // would have been the obvious move and would have traded a design
      // complaint for an accessibility one.
      //
      // ⚠ The target below is unaffected BY THE QUIETENING: `before:` sizing and
      // `py-0.5` are unchanged, so the painted size and the hit area both stand.
      // (What that target actually WAS is corrected above — this sentence was
      // true about the chrome change and inherited the "24px" it was measured
      // against, which was itself never reached at the zoom the product parks
      // at. The correction belongs upstairs, with the arithmetic.)
      className={`${typography.edgeLabel} font-medium inline-flex items-center px-2 py-0.5 rounded-md border border-transparent bg-transparent text-text-body group-hover:border-info/30 group-hover:bg-panel group-focus-within:border-info/30 group-focus-within:bg-panel cursor-pointer hover:bg-info/5 transition-colors nodrag nopan relative before:absolute before:content-[''] before:-inset-y-[3px] before:left-0 before:right-0`}
      style={CANVAS_MIN_TARGET_BOX_STYLE}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      // `title` and not a styled tooltip, deliberately: this is the SAME
      // treatment `pre-analysis-v3-analyse` already gives the SAME sentence,
      // and the point of the change is that the two surfaces stop disagreeing.
      // `undefined` (not '') so no empty attribute lands in the DOM when the
      // model is analysable — a chip with a blank tooltip is its own small lie.
      {...(heldNotice ? { title: heldNotice } : {})}
    >
      {label}
    </button>
    <span
      role="status"
      className={unavailable
        ? `${typography.edgeLabel} text-text-light block w-full`
        : typography.screenReaderOnly}
    >
      {unavailable ? 'Olumi is unavailable here. Your question has not been sent.' : ''}
    </span>
    </>
  )
}
