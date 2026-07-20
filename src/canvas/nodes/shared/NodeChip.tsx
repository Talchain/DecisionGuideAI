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
 * Send path: prefer the unified dispatcher (`_dispatchAction`, the only
 * bridge that carries chip metadata); fall back to `_sendMessage` so the
 * click still lands on hosts that registered only the legacy bridge.
 */
import { useCallback } from 'react'
import type { ActionTypeLiteral } from '@talchain/schemas/boundary'
import type { PendingWireActionType } from '../../conversation/chipMeta'
import { useGuidanceStore } from '../../stores/guidanceStore'
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
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
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
  }, [message, label, chipId, actionType])

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
