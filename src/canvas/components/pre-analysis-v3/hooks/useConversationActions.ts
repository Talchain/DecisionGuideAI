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

export interface ConversationActions {
  /** Send a prefilled prompt now. Returns false when no surface accepted it. */
  sendPrompt: (label: string, prompt: string) => boolean
}

export function useConversationActions(): ConversationActions {
  const showToast = useShowToast()
  const conversation = useOptionalConversationContext()

  const sendPrompt = useCallback(
    (label: string, prompt: string): boolean => {
      // 1. Live conversation context — no registration race possible.
      if (conversation) {
        conversation
          .sendChip({ id: `pre-analysis-v3-${Date.now()}`, label, message: prompt, intent: 'primary' })
          .catch(() => showToast(FIELD_FEEDBACK_COPY.olumiUnavailable, 'error'))
        revealOlumiSurface()
        return true
      }
      // 2. Guidance-store bridge (host without the provider).
      const callbacks = useGuidanceStore.getState()
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
