/**
 * ChatMessage — wraps MessageBubble with hover/focus action bar.
 *
 * Uses Tailwind `group` + `group-hover:opacity-100` to show MessageActions
 * on hover. Keyboard accessible via `focus-within`.
 *
 * Messages are categorised (action, research, error, answer) via
 * data-message-category for test/automation selectors.
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
  action: '',
  research: '',
  error: '',
}

interface ChatMessageProps {
  message: ConversationMessage
  isFirst: boolean
  /** When true, suppress inline ActionChipRow (chips rendered externally by SuggestedChips) */
  hideChips?: boolean
  /** When true, inline chips are visible but non-interactive (historical turn) */
  onChipClick: (chip: ActionChip) => Promise<void>
  onRetry: () => void
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  /** AI panel v2 surface — render message body at panelBody (12px). */
  compact?: boolean
  /**
   * Transcript honesty (trust item #3): when true, this failed user message
   * is the one retryLast would resend — wire onRetry as the message's own
   * retry affordance. ChatThread sets this for at most ONE message.
   */
  showFailedSendRetry?: boolean
}

export const ChatMessage = memo(function ChatMessage({
  message,
  isFirst,
  hideChips,
  onChipClick,
  onRetry,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onArtefactMessage,
  onProposalConfirm,
  compact,
  showFailedSendRetry,
}: ChatMessageProps) {
  const category = getMessageCategory(message)
  const borderClass = CATEGORY_BORDER[category]

  return (
    <div
      className={`group relative pointer-events-auto ${borderClass}`}
      style={{ marginBottom: 12 }}
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
        onChipClick={onChipClick}
        patchBlockStates={patchBlockStates}
        patchRejections={patchRejections}
        onPatchAccept={onPatchAccept}
        onPatchDismiss={onPatchDismiss}
        onFeedback={onFeedback}
        onArtefactMessage={onArtefactMessage}
        onProposalConfirm={onProposalConfirm}
        compact={compact}
        onRetryFailedSend={showFailedSendRetry ? onRetry : undefined}
      />
    </div>
  )
})
