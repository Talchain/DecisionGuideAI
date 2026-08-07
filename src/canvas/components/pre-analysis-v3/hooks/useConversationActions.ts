/**
 * useConversationActions — delivers prefilled prompts to Olumi from the
 * pre-analysis panel, with the result always visible.
 *
 * Primary path: the ConversationContext directly (the panel renders inside
 * the provider). This avoids the guidance-store registration race that left
 * every callback null in the Analysis-tab + empty-conversation + floating-
 * closed state (ConversationPanel's unmount cleanup nulls the registry and
 * OlumiTabBody's register effect does not re-run) — the root cause of the
 * "spark does nothing" bug found in local testing.
 *
 * Intent metadata (A1 meta-decision diagnosis, 2026-07-20): every spark is
 * product-authored, so its intent is KNOWN at authoring time and must ship
 * on the wire — `chip.action_type` when the schema vocabulary has an honest
 * value, and always `chip.parameters.spark_id` (the registry identity CEE's
 * routing half keys on). Anonymous spark text let CEE's draft-shape regex
 * misread "What should I check before running the first analysis?" as a
 * decision brief and draft a meta-decision graph. Free-typed user text is
 * NEVER stamped — only registry sparks travel through this hook.
 *
 * After a successful send the Olumi surface is revealed (focus the floating
 * panel if open, else activate the docked Olumi tab) so the user sees the
 * message land. If no delivery path exists at all, a toast says so — never
 * a silent no-op.
 */

import { useCallback } from 'react'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useShowToast } from '../../../ToastContext'
import { revealOlumiSurface } from '../../../conversation/revealOlumi'
import { FIELD_FEEDBACK_COPY } from '../constants'
import type { SparkPrompt } from '../types'

export interface ConversationActions {
  /** Send a registry spark now. Returns false when no surface accepted it. */
  sendPrompt: (spark: SparkPrompt) => boolean
}

export function useConversationActions(): ConversationActions {
  const showToast = useShowToast()
  const conversation = useOptionalConversationContext()

  const sendPrompt = useCallback(
    (spark: SparkPrompt): boolean => {
      const { id, label, prompt, action_type } = spark
      // 1. Live conversation context — no registration race possible.
      if (conversation) {
        conversation
          .sendChip({
            id: `pre-analysis-v3-${Date.now()}`,
            label,
            message: prompt,
            intent: 'primary',
            ...(action_type ? { action_type } : {}),
            parameters: { spark_id: id },
          })
          .catch(() => showToast(FIELD_FEEDBACK_COPY.olumiUnavailable, 'error'))
        revealOlumiSurface()
        return true
      }
      // 2. Guidance-store bridge (host without the provider). Prefer the
      // unified dispatcher — the only bridge callback that carries chip
      // metadata to the wire.
      const callbacks = useGuidanceStore.getState()
      if (callbacks._dispatchAction) {
        callbacks._dispatchAction({
          ...(action_type ? { action_type } : {}),
          parameters: { spark_id: id },
          label,
          message: prompt,
          source: 'chip',
        })
        revealOlumiSurface()
        return true
      }
      // Legacy bridges — intent metadata cannot travel these; the message
      // still lands rather than dead-ending the click.
      if (callbacks._sendChip) {
        callbacks._sendChip(label, prompt)
        revealOlumiSurface()
        return true
      }
      if (callbacks._sendMessage) {
        callbacks._sendMessage(prompt)
        revealOlumiSurface()
        return true
      }
      if (callbacks._prefillChat) {
        callbacks._prefillChat(prompt)
        revealOlumiSurface()
        return true
      }
      // 3. Nothing can deliver — say so.
      showToast(FIELD_FEEDBACK_COPY.olumiUnavailable, 'info')
      return false
    },
    [conversation, showToast],
  )

  return { sendPrompt }
}
