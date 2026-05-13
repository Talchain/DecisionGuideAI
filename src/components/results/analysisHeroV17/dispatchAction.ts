/**
 * Row-action dispatcher factory.
 *
 * Maps every `RowAction` to its handler:
 *   - ai / discuss / add / challenge / brief → chat prefill (no auto-send in v1)
 *   - edit                                    → onFocusNode (prefill fallback)
 *   - confirm                                 → onConfirm   (prefill fallback)
 *
 * `prefillChat` must NEVER auto-send. After Fix 9 (Round-4 polish pass) the
 * reflect-state CTA was relabelled "Test the result" and switched from
 * auto-send to prefill, so the v17 hero now has ZERO auto-send paths in
 * either this dispatcher or the footer CTA. `sendMessage` is still imported
 * by the composer as a future-fallback, but no current path calls it.
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
