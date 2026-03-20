/**
 * MessageBubble — Single conversation message
 *
 * Renders user messages (right-aligned, info bg) and assistant messages
 * (left-aligned, panel bg) with optional inline blocks and action chips.
 *
 * Progressive disclosure: long assistant text (>300 chars, no blocks, not
 * synthetic) is clamped to ~6 lines with a "Show more" toggle.
 *
 * Streaming: when `message.isStreaming` is true, text renders incrementally
 * with a blinking cursor. Provisional tool-backed turns render at reduced
 * opacity until `turn_complete`.
 */

import { memo, useState, useRef, useEffect } from 'react'
import { typography } from '../../styles/typography'
import { safeRichText } from '../utils/safeRichText'
import { InlineBlocks } from './InlineBlocks'
import { ActionChipRow } from './ActionChipRow'
import { FeedbackRow } from './FeedbackRow'
import { SYSTEM_MESSAGE_SENTINEL } from './useConversation'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from './types'
import type { PatchBlockState, PatchRejectionInfo } from './useConversation'
import styles from './Conversation.module.css'

/** Character threshold for applying progressive disclosure. */
const CLAMP_CHAR_THRESHOLD = 300

interface MessageBubbleProps {
  message: ConversationMessage
  /** When true, suppress inline ActionChipRow (chips rendered externally by SuggestedChips) */
  hideChips?: boolean
  /** When true, inline ActionChipRow is visible but non-interactive (historical turn) */
  historicalChips?: boolean
  onChipClick: (chip: ActionChip) => Promise<void>
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
  onArtefactMessage?: (message: string) => void
}

export const MessageBubble = memo(function MessageBubble({
  message,
  hideChips,
  historicalChips = false,
  onChipClick,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onArtefactMessage,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  // Defensive guard: never render the [system] sentinel as a user bubble
  if (isUser && message.content === SYSTEM_MESSAGE_SENTINEL) return null

  const isStreaming = message.isStreaming === true
  const isProvisional = message.isProvisional === true
  const hasToolLoading = Boolean(message.toolLoadingState)

  // Progressive disclosure for long assistant prose (disabled during streaming)
  const needsClamp = !isUser
    && !isStreaming
    && !message.synthetic
    && message.content.length > CLAMP_CHAR_THRESHOLD
    && (!message.blocks || message.blocks.length === 0)

  const [expanded, setExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (needsClamp && contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > contentRef.current.clientHeight)
    }
  }, [needsClamp, message.content])

  // Streaming with no text yet — show thinking indicator placeholder
  if (isStreaming && !message.content && !hasToolLoading) {
    return (
      <div
        className={styles.messageBubbleAssistant}
        data-testid="message-assistant"
      >
        <div className={styles.streamingThinking} data-testid="streaming-thinking">
          <span className={styles.streamingDot} />
          <span className={styles.streamingDot} />
          <span className={styles.streamingDot} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={isUser ? styles.messageBubbleUser : styles.messageBubbleAssistant}
      data-testid={`message-${message.role}`}
    >
      <div
        ref={needsClamp ? contentRef : undefined}
        className={`${typography.panelBody} ${styles.markdownContent} ${
          needsClamp && !expanded ? styles.markdownContentClamped : ''
        } ${isProvisional ? styles.provisionalText : ''}`}
        data-streaming={isStreaming || undefined}
        // eslint-disable-next-line no-restricted-syntax -- sanitised by safeRichText (allowlist: strong, br, ul, li)
        dangerouslySetInnerHTML={{
          __html: safeRichText(message.content) + (isStreaming ? '<span class="streaming-cursor" aria-hidden="true">|</span>' : ''),
        }}
      />
      {hasToolLoading && (
        <div className={styles.toolLoadingState} data-testid="tool-loading-state">
          <span className={styles.toolLoadingDot} />
          {message.toolLoadingState}
        </div>
      )}
      {needsClamp && isOverflowing && (
        <button
          type="button"
          className={styles.showMoreTextToggle}
          onClick={() => setExpanded(v => !v)}
          data-testid="message-show-more"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {message.blocks && message.blocks.length > 0 && (
        <InlineBlocks
          blocks={message.blocks}
          turnId={message.id}
          patchBlockStates={patchBlockStates}
          patchRejections={patchRejections}
          onPatchAccept={onPatchAccept}
          onPatchDismiss={onPatchDismiss}
          onArtefactMessage={onArtefactMessage}
          assistantTextWordCount={message.content.trim().split(/\s+/).filter(Boolean).length}
        />
      )}
      {!hideChips && message.actionChips && message.actionChips.length > 0 && (
        <ActionChipRow chips={message.actionChips} onChipClick={onChipClick} disabled={historicalChips} />
      )}
      {!isUser && !message.synthetic && onFeedback && (
        <FeedbackRow turnId={message.clientTurnId} onFeedback={onFeedback} />
      )}
    </div>
  )
})
