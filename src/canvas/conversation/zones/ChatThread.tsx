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
  onProposalConfirm?: (proposalId: string) => void
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
  onProposalConfirm,
}: ChatThreadProps) {
  const { listRef, listEndRef, showNewMessageIndicator, handleScroll, scrollToBottom } =
    useSmartScroll({ messageCount: messages.length, isThinking })

  // Has the conversation produced any finalized (non-streaming) assistant messages?
  const hasFinalizedAssistant = messages.some(m => m.role === 'assistant' && !m.isStreaming)

  // EmptyState stays visible when no graph nodes exist and no finalized assistant
  // response has arrived. This keeps the shape pipeline on screen during the first
  // turn (Generate Model or first chat message) so it can serve as the loading hub.
  const showEmptyState = nodeCount === 0 && !hasFinalizedAssistant

  // While EmptyState is showing, extract streaming text from the first streaming
  // message so it can be displayed below the shapes instead of in a message bubble.
  const streamingMsg = showEmptyState ? messages.find(m => m.isStreaming) : undefined
  const streamingText = streamingMsg?.content || null

  if (import.meta.env.DEV) {
    console.debug('[ChatThread] showEmptyState=%s isThinking=%s nodeCount=%d hasFinalizedAssistant=%s msgs=%d streamingText=%s',
      showEmptyState, isThinking, nodeCount, hasFinalizedAssistant, messages.length, !!streamingText)
  }

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
      {showEmptyState && (
        <EmptyState
          animate={isThinking}
          statusLabel={isThinking ? thinkingLabel(longRunningHint) : null}
          streamingText={streamingText}
        />
      )}

      {messages.map((msg, i) => {
        // Hide user messages and the streaming placeholder while EmptyState is the loading hub
        if (showEmptyState && (msg.role === 'user' || msg.isStreaming)) return null
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
            onProposalConfirm={onProposalConfirm}
          />
        )
      })}

      {/* Suggested chips after last assistant message (visible even while thinking; isThinking disables them) */}
      {suggestedChips.length > 0 && (
        <SuggestedChips chips={suggestedChips} onChipClick={onChipClick} isThinking={isThinking} />
      )}

      {/* ThinkingIndicator: only when EmptyState is NOT handling the loading display */}
      {isThinking && !showEmptyState && !messages.some(m => m.isStreaming) && (
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
