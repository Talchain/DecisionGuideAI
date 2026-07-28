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
 */
import { useCallback } from 'react'
import type { ActionTypeLiteral } from '@talchain/schemas/boundary'
import type { PendingWireActionType } from '../../conversation/chipMeta'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { executeCanonicalRun } from '../../analysis/canonicalRunRegistry'
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
    >
      {label}
    </button>
  )
}
