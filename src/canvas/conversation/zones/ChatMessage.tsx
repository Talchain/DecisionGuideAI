/**
 * ChatMessage — wraps MessageBubble with hover/focus action bar.
 *
 * Uses Tailwind `group` + `group-hover:opacity-100` to show MessageActions
 * on hover. Keyboard accessible via `focus-within`.
 *
 * Visual distinction: left border accent based on message category
 * (action=info, research=success, error=danger, answer=none).
 */

import { memo } from 'react'
import { MessageBubble } from '../MessageBubble'
import { MessageActions } from './MessageActions'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

type MessageCategory = 'answer' | 'action' | 'research' | 'error'

/** Derive visual category from message content and metadata. */
function getMessageCategory(msg: ConversationMessage): MessageCategory {
  if (msg.role === 'user') return 'answer'
  if (msg.synthetic && msg.actionChips?.some(c => c.id === 'retry')) return 'error'
  if (!msg.blocks?.length) return 'answer'
  if (msg.blocks.some(b => b.type === 'graph_patch')) return 'action'
  if (msg.blocks.some(b => b.type === 'evidence' || b.type === 'fact')) return 'research'
  return 'answer'
}

const CATEGORY_BORDER: Record<MessageCategory, string> = {
  answer: '',
  action: 'border-l-2 border-l-info',
  research: 'border-l-2 border-l-success',
  error: 'border-l-2 border-l-danger',
}

interface ChatMessageProps {
  message: ConversationMessage
  isFirst: boolean
  /** When true, suppress inline ActionChipRow (chips rendered externally by SuggestedChips) */
  hideChips?: boolean
  /** When true, inline chips are visible but non-interactive (historical turn) */
  historicalChips?: boolean
  onChipClick: (chip: ActionChip) => Promise<void>
  onRetry: () => void
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isFirst,
  hideChips,
  historicalChips,
  onChipClick,
  onRetry,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
}: ChatMessageProps) {
  const category = getMessageCategory(message)
  const borderClass = CATEGORY_BORDER[category]

  return (
    <div
      className={`group relative pointer-events-auto ${borderClass}`}
      style={{ marginBottom: 18 }}
      data-testid={`chat-message-${message.role}`}
      data-message-category={category !== 'answer' ? category : undefined}
    >
      {/* Action bar — visible on hover/focus-within, fade in 200ms */}
      <div
        className={`
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          transition-opacity pointer-events-none group-hover:pointer-events-auto
          group-focus-within:pointer-events-auto
        `}
        style={{ transitionDuration: '200ms' }}
      >
        <MessageActions
          role={message.role}
          content={message.content}
          onRetry={message.role === 'assistant' ? onRetry : undefined}
          isFirst={isFirst}
        />
      </div>

      <MessageBubble
        message={message}
        hideChips={hideChips}
        historicalChips={historicalChips}
        onChipClick={onChipClick}
        patchBlockStates={patchBlockStates}
        patchRejections={patchRejections}
        onPatchAccept={onPatchAccept}
        onPatchDismiss={onPatchDismiss}
        onFeedback={onFeedback}
      />
    </div>
  )
})
