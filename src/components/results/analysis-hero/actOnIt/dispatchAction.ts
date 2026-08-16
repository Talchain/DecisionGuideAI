/**
 * Row-action dispatcher factory.
 *
 * Salvaged verbatim (behaviour-wise) from `analysisHeroV17/dispatchAction.ts`.
 *
 * Maps every `RowAction` to its handler:
 *   - ai / discuss / add / challenge / brief → send the prompt to Olumi
 *   - edit                                   → onFocusNode (chat fallback)
 *   - confirm                                → onConfirm   (chat fallback)
 *
 * `sendToOlumi` AUTO-SENDS and reveals the chat (Paul's 2026-07-01 decision,
 * reversing the earlier 'zero auto-send' directive). The behaviour lives in
 * the injected function, not here.
 */

import type { RowAction, RowActionDispatcher, RowActionPayload } from './types'

export interface DispatcherDeps {
  /** Injected chat handler — sends the prompt to Olumi. */
  sendToOlumi: (text: string) => void
  onFocusNode: ((nodeId: string) => void) | undefined
  onConfirm: ((nodeId: string) => void) | undefined
}

export function makeRowActionDispatcher(
  { sendToOlumi, onFocusNode, onConfirm }: DispatcherDeps,
): RowActionDispatcher {
  return (action: RowAction, payload: RowActionPayload) => {
    const { chatPrompt, targetNodeId } = payload
    switch (action) {
      case 'ai':
      case 'discuss':
      case 'add':
      case 'challenge':
      case 'brief':
        // Every secondary action sends its prompt to Olumi (no direct mutation).
        sendToOlumi(chatPrompt)
        return
      case 'edit':
        if (targetNodeId && onFocusNode) onFocusNode(targetNodeId)
        else sendToOlumi(chatPrompt)
        return
      case 'confirm':
        if (targetNodeId && onConfirm) onConfirm(targetNodeId)
        else sendToOlumi(chatPrompt)
        return
    }
  }
}
