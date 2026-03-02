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
import type { ConversationMessage, ActionChip } from './types'
import styles from './Conversation.module.css'

interface MessageBubbleProps {
  message: ConversationMessage
  onChipClick: (chip: ActionChip) => void
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onChipClick,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant}
      data-testid={`message-${message.role}`}
    >
      <p className={typography.body}>{message.content}</p>
      {message.blocks && message.blocks.length > 0 && (
        <InlineBlocks blocks={message.blocks} />
      )}
      {message.actionChips && message.actionChips.length > 0 && (
        <ActionChipRow chips={message.actionChips} onChipClick={onChipClick} />
      )}
    </div>
  )
})
