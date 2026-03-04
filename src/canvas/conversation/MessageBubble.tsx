/**
 * MessageBubble — Single conversation message
 *
 * Renders user messages (right-aligned, info bg) and assistant messages
 * (left-aligned, panel bg) with optional inline blocks and action chips.
 */

import { memo } from 'react'
import { typography } from '../../styles/typography'
import { InlineBlocks } from './InlineBlocks'
import { ActionChipRow } from './ActionChipRow'
import { FeedbackRow } from './FeedbackRow'
import { SYSTEM_MESSAGE_SENTINEL } from './useConversation'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from './types'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import styles from './Conversation.module.css'

interface MessageBubbleProps {
  message: ConversationMessage
  onChipClick: (chip: ActionChip) => void
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onChipClick,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Defensive guard: never render the [system] sentinel as a user bubble
  if (isUser && message.content === SYSTEM_MESSAGE_SENTINEL) return null

  return (
    <div
      className={isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant}
      data-testid={`message-${message.role}`}
    >
      <p className={typography.body}>{message.content}</p>
      {message.blocks && message.blocks.length > 0 && (
        <InlineBlocks
          blocks={message.blocks}
          turnId={message.clientTurnId}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
        />
      )}
      {message.actionChips && message.actionChips.length > 0 && (
        <ActionChipRow chips={message.actionChips} onChipClick={onChipClick} />
      )}
      {!isUser && !message.synthetic && onFeedback && (
        <FeedbackRow turnId={message.clientTurnId} onFeedback={onFeedback} />
      )}
    </div>
  )
})
