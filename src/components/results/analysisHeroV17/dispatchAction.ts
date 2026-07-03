/**
 * Row-action dispatcher factory.
 *
 * Maps every `RowAction` to its handler:
 *   - ai / discuss / add / challenge / brief → send prompt to Olumi
 *   - edit                                    → onFocusNode (chat fallback)
 *   - confirm                                 → onConfirm   (chat fallback)
 *
 * `prefillChat` is the injected chat handler. Per Paul's 2026-07-01 decision it
 * now AUTO-SENDS the prompt to Olumi + reveals the chat (reversing the earlier
 * Fix-9 'zero auto-send' directive). The param keeps its historical name; the
 * behaviour lives in the injected function (AnalysisHeroV17).
 */

import type { RowAction } from './analysisHeroVM.types'

export interface DispatcherDeps {
  /** Injected chat handler — sends the prompt to Olumi (see AnalysisHeroV17). */
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
        // every secondary action sends its prompt to Olumi (no direct mutation).
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
