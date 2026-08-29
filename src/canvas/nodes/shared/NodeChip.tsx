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
import { useCallback } from 'react'
import type { ActionTypeLiteral } from '@talchain/schemas/boundary'
import type { PendingWireActionType } from '../../conversation/chipMeta'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { executeCanonicalRun } from '../../analysis/canonicalRunRegistry'
import { analysisHeldNotice } from '../../utils/analysisHeldOnInjectedModel'
import { useShowToastSafe } from '../../ToastContext'
import { typography } from '../../../styles/typography'

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
    actionType === 'run_analysis' ? analysisHeldNotice(s.nodes) : null,
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
    if (send) send(message)
  }, [message, label, chipId, actionType, showToast])

  return (
    <button
      type="button"
      className={`${typography.edgeLabel} font-medium inline-flex items-center px-2 py-0.5 rounded-md border border-info/30 text-text-body bg-panel cursor-pointer hover:bg-info/5 transition-colors nodrag nopan`}
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
  )
}
