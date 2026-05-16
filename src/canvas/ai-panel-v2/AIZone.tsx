/**
 * AIZone — owns the right-panel AI conversation surface.
 *
 * Calls `useConversation()` exactly once and passes the instance into
 * `ConversationPanel` (which retains ChatThread + the patch/chip/feedback
 * handler matrix + guidanceStore registration). The brief's compact
 * `AIInputBar` replaces ConversationPanel's heavy ChatComposer via the
 * `hideComposer` prop — same handler matrix, new input UI.
 *
 * Singleton invariant (correction #9): exactly one `useConversation()`
 * call per active AI surface. Under FF on, DraftChat is unmounted, so this
 * is the only instance.
 */

import { memo, useCallback, useRef } from 'react'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useConversation } from '../conversation/useConversation'
import { AIInputBar } from './AIInputBar'

export const AIZone = memo(function AIZone() {
  const conversation = useConversation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      await conversation.sendMessage(text, { debugSource: 'ai_panel_v2_input' })
    },
    [conversation],
  )

  return (
    <div data-testid="ai-panel-v2-zone" className="flex flex-col h-full min-h-0">
      <ConversationPanel
        conversation={conversation}
        onCollapse={noop}
        onAttach={handleAttach}
        hideComposer
      />
      <AIInputBar
        onSend={handleSend}
        isThinking={conversation.isThinking}
        onAttach={handleAttach}
      />
      {/* Hidden file input for the cog popover's attach action. Reuses the
          DraftChat pattern: a hidden <input type="file" /> triggered by the
          attach handler. Actual upload wiring lands with the evidence
          features in a later brief. */}
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
