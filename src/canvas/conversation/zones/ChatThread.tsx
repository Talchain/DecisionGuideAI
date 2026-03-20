/**
 * ChatThread — Zone 2: scrollable conversation thread.
 *
 * Renders EmptyState (no messages + no graph), ChatMessage list,
 * ThinkingIndicator, SuggestedChips, and "New messages" pill.
 * Custom scrollbar: 4px, themed. Smart scroll via useSmartScroll.
 */

import { memo } from 'react'
import { ArrowDown } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useSmartScroll } from '../hooks/useSmartScroll'
import { EmptyState } from './EmptyState'
import { ChatMessage } from './ChatMessage'
import { SessionDivider } from '../primitives/SessionDivider'
import { ThinkingIndicator } from './ThinkingIndicator'
import { SuggestedChips } from './SuggestedChips'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

interface ChatThreadProps {
  messages: ConversationMessage[]
  isThinking: boolean
  longRunningHint: string | null
  nodeCount: number
  patchBlockStates: Map<string, PatchBlockState>
  patchRejections: Map<string, PatchRejectionInfo>
  onChipClick: (chip: ActionChip) => Promise<void>
  onPatchAccept: (key: string, block: GraphPatchBlock) => void
  onPatchDismiss: (key: string) => void
  onFeedback: (turnId: string, rating: 'up' | 'down') => void
  onRetry: () => void
  onArtefactMessage?: (message: string) => void
}

/** Derive a thinking label from the hint. */
function thinkingLabel(hint: string | null): string {
  if (hint) return hint
  return 'Thinking\u2026'
}

export const ChatThread = memo(function ChatThread({
  messages,
  isThinking,
  longRunningHint,
  nodeCount,
  patchBlockStates,
  patchRejections,
  onChipClick,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onRetry,
  onArtefactMessage,
}: ChatThreadProps) {
  const { listRef, listEndRef, showNewMessageIndicator, handleScroll, scrollToBottom } =
    useSmartScroll({ messageCount: messages.length, isThinking })

  const showEmpty = messages.length === 0 && nodeCount === 0

  // Get suggested chips from last assistant message
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const suggestedChips = lastAssistantMsg?.actionChips ?? []
  // Only hide inline chips when SuggestedChips will actually render something.
  // SuggestedChips filters out chips without a message field (e.g. retry chips),
  // so hideChips must mirror that filter — otherwise retry chips vanish entirely.
  const suggestedChipsWillRender = suggestedChips.some(c => !!c.message)

  return (
    <div
      ref={listRef}
      className="chat-thread olumi-scrollbar flex flex-col flex-1 min-h-0 overflow-y-auto bg-panel"
      style={{ padding: '20px 16px 8px' }}
      onScroll={handleScroll}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      data-testid="chat-thread"
    >
      {showEmpty && <EmptyState />}

      {messages.map((msg, i) => {
        const isLastAssistant = msg === lastAssistantMsg
        return msg.sessionDivider ? (
          <SessionDivider key={msg.id} text={msg.sessionDivider} />
        ) : (
          <ChatMessage
            key={msg.id}
            message={msg}
            isFirst={i === 0}
            hideChips={isLastAssistant && suggestedChipsWillRender}
            historicalChips={!isLastAssistant}
            onChipClick={onChipClick}
            onRetry={onRetry}
            patchBlockStates={patchBlockStates}
            patchRejections={patchRejections}
            onPatchAccept={onPatchAccept}
            onPatchDismiss={onPatchDismiss}
            onFeedback={onFeedback}
            onArtefactMessage={onArtefactMessage}
          />
        )
      })}

      {/* Suggested chips after last assistant message (visible even while thinking; isThinking disables them) */}
      {suggestedChips.length > 0 && (
        <SuggestedChips chips={suggestedChips} onChipClick={onChipClick} isThinking={isThinking} />
      )}

      {/* Suppress standalone ThinkingIndicator when a streaming message is already visible */}
      {isThinking && !messages.some(m => m.isStreaming) && (
        <ThinkingIndicator label={thinkingLabel(longRunningHint)} />
      )}

      {/* New messages pill */}
      {showNewMessageIndicator && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={`
            sticky bottom-2 self-center z-10
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
            bg-transparent border border-info/30 text-text-body
            ${typography.panelMeta} font-medium
            cursor-pointer
          `}
          style={{ boxShadow: 'var(--shadow-2, 0 4px 12px rgba(0,0,0,0.08))' }}
          data-testid="new-messages-pill"
        >
          <ArrowDown className="w-3 h-3" aria-hidden="true" />
          New messages
        </button>
      )}

      <div ref={listEndRef} />
    </div>
  )
})
