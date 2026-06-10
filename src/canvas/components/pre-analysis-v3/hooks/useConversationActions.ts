/**
 * useConversationActions — null-checked wrappers over the guidance-store
 * conversation callbacks (the same dispatch surface PR 173 pins; no new
 * convention). Sparks send the prefilled prompt immediately (approved
 * decision): the short label shows in the bubble, the fuller prompt goes to
 * Olumi. When no conversation surface is registered the action degrades to a
 * composer prefill, then to a toast — never a silent dead end.
 */

import { useCallback } from 'react'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useShowToast } from '../../../ToastContext'

export interface ConversationActions {
  /** Send a prefilled prompt now. Returns false when no surface accepted it. */
  sendPrompt: (label: string, prompt: string) => boolean
}

export function useConversationActions(): ConversationActions {
  const showToast = useShowToast()

  const sendPrompt = useCallback(
    (label: string, prompt: string): boolean => {
      const callbacks = useGuidanceStore.getState()
      if (callbacks._sendChip) {
        callbacks._sendChip(label, prompt)
        return true
      }
      if (callbacks._prefillChat) {
        callbacks._prefillChat(prompt)
        return true
      }
      showToast('Open the Olumi panel to ask this', 'info')
      return false
    },
    [showToast],
  )

  return { sendPrompt }
}
