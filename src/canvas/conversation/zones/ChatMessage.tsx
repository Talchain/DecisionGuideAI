/**
 * ChatMessage — wraps MessageBubble with hover/focus action bar.
 *
 * Uses Tailwind `group` + `group-hover:opacity-100` to show MessageActions
 * on hover. Keyboard accessible via `focus-within`.
 */

import { memo } from 'react'
import { MessageBubble } from '../MessageBubble'
import { MessageActions } from './MessageActions'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

interface ChatMessageProps {
  message: ConversationMessage
  isFirst: boolean
  onChipClick: (chip: ActionChip) => void
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
  onChipClick,
  onRetry,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
}: ChatMessageProps) {
  return (
    <div
      className="group relative pointer-events-auto"
      style={{ marginBottom: 18 }}
      data-testid={`chat-message-${message.role}`}
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
