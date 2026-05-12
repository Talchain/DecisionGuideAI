/**
 * Row-action dispatcher factory.
 *
 * Maps every `RowAction` to its handler:
 *   - ai / discuss / add / challenge / brief → chat prefill (no auto-send in v1)
 *   - edit                                    → onFocusNode (prefill fallback)
 *   - confirm                                 → onConfirm   (prefill fallback)
 *
 * `prefillChat` must NEVER auto-send. Only the reflect-state CTA uses
 * `sendMessage` (auto-send), and that path runs through `handleCtaClick`,
 * not through this dispatcher.
 */

import type { RowAction } from './analysisHeroVM.types'

export interface DispatcherDeps {
  prefillChat: (text: string) => void
  onFocusNode: ((nodeId: string) => void) | undefined
  onConfirm: ((nodeId: string) => void) | undefined
}

export function makeRowActionDispatcher({ prefillChat, onFocusNode, onConfirm }: DispatcherDeps) {
  return (action: RowAction, payload: { chatPrompt: string; targetNodeId: string | undefined }) => {
    const { chatPrompt, targetNodeId } = payload
    switch (action) {
      case 'ai':
      case 'discuss':
      case 'add':
      case 'challenge':
      case 'brief':
        // v1 — every secondary action is chat prefill. No direct mutation
        // and no auto-send.
        prefillChat(chatPrompt)
        return
      case 'edit':
        if (targetNodeId && onFocusNode) onFocusNode(targetNodeId)
        else prefillChat(chatPrompt)
        return
      case 'confirm':
        if (targetNodeId && onConfirm) onConfirm(targetNodeId)
        else prefillChat(chatPrompt)
        return
    }
  }
}
