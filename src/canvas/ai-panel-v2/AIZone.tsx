/**
 * AIZone — owns the right-panel AI conversation surface.
 *
 * Calls `useConversation()` exactly once and passes the instance into
 * `ConversationPanel` (which retains ChatThread + the patch/chip/feedback
 * handler matrix + guidanceStore registration). The brief's compact
 * `AIInputBar` replaces ConversationPanel's heavy ChatComposer via the
 * `hideComposer` prop — same handler matrix, new input UI.
 *
 * Prefill target: AIZone provides a `prefillChat` callback to
 * ConversationPanel so external flows (inspector "Ask about this",
 * analysis hero prefill) populate the visible AIInputBar instead of the
 * non-existent legacy composer ref.
 *
 * Singleton invariant (correction #9): exactly one `useConversation()`
 * call per active AI surface. Under FF on, DraftChat is unmounted, so
 * this is the only instance.
 */

import { memo, useCallback, useRef } from 'react'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useConversation } from '../conversation/useConversation'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { SelectionPill } from './SelectionPill'
import { StaleAnalysisBadge } from './StaleAnalysisBadge'

export const AIZone = memo(function AIZone() {
  const conversation = useConversation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputBarRef = useRef<AIInputBarHandle>(null)

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      await conversation.sendMessage(text, { debugSource: 'ai_panel_v2_input' })
    },
    [conversation],
  )

  const handlePrefill = useCallback((text: string) => {
    inputBarRef.current?.setText(text)
  }, [])

  return (
    <div data-testid="ai-panel-v2-zone" className="flex flex-col h-full min-h-0">
      <SelectionPill />
      <ConversationPanel
        conversation={conversation}
        onCollapse={noop}
        onAttach={handleAttach}
        hideComposer
        prefillChat={handlePrefill}
      />
      <StaleAnalysisBadge />
      <AIInputBar
        ref={inputBarRef}
        onSend={handleSend}
        isThinking={conversation.isThinking}
        onAttach={handleAttach}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="ai-panel-v2-file-input"
      />
    </div>
  )
})

function noop() {
  /* persistent right-panel zone has no collapse affordance */
}
