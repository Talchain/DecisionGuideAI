/**
 * ConversationPanel — Multi-turn conversation surface
 *
 * Renders inside DraftChat's expanded panel when VITE_ENABLE_ORCHESTRATOR_V2
 * is ON. Shows a scrollable message list, typing indicator, inline blocks,
 * action chips, and a growing single-line input.
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { MessageBubble } from './MessageBubble'
import { GrowingInput } from './GrowingInput'
import type { ActionChip } from './types'
import type { UseConversationReturn } from './useConversation'
import styles from './Conversation.module.css'

interface ConversationPanelProps {
  conversation: UseConversationReturn
  onCollapse: () => void
}

const WELCOME_TEXT =
  "Describe the decision you're facing \u2014 what you're trying to decide, the options you're considering, and what matters most."

export const ConversationPanel = memo(function ConversationPanel({
  conversation,
  onCollapse,
}: ConversationPanelProps) {
  const { messages, isThinking, longRunningHint, lastFailedInput, sendMessage, sendChip, retryLast } = conversation
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const userScrolledUpRef = useRef(false)
  const nodeCount = useCanvasStore((s) => s.nodes.length)

  // Restore input text when a send fails so the user can edit and resend
  useEffect(() => {
    if (lastFailedInput) setInputValue(lastFailedInput)
  }, [lastFailedInput])

  // Show welcome message only when empty and no graph
  const showWelcome = messages.length === 0 && nodeCount === 0

  // Auto-scroll logic: only auto-scroll if user is near the bottom
  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMessageIndicator(false)
    userScrolledUpRef.current = false
  }, [])

  useEffect(() => {
    if (messages.length === 0) return

    if (userScrolledUpRef.current) {
      setShowNewMessageIndicator(true)
    } else {
      scrollToBottom()
    }
  }, [messages.length, isThinking, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
    userScrolledUpRef.current = !isNearBottom
    if (isNearBottom) {
      setShowNewMessageIndicator(false)
    }
  }, [])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    sendMessage(text)
  }, [inputValue, sendMessage])

  const handleChipClick = useCallback(
    (chip: ActionChip) => {
      if (chip.id === 'retry') {
        retryLast()
        return
      }
      sendChip(chip)
    },
    [sendChip, retryLast],
  )

  const canSend = inputValue.trim().length > 0 && !isThinking

  return (
    <>
      {/* Message list */}
      <div
        ref={listRef}
        className={styles.messageList}
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {showWelcome && (
          <div className={styles.welcomeMessage} data-testid="welcome-message">
            <p className={typography.body}>{WELCOME_TEXT}</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onChipClick={handleChipClick}
          />
        ))}

        {isThinking && (
          <div className={styles.typingIndicator} data-testid="typing-indicator">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            {longRunningHint && (
              <span className={styles.longRunningHint}>{longRunningHint}</span>
            )}
          </div>
        )}

        {showNewMessageIndicator && (
          <button
            type="button"
            className={styles.newMessageIndicator}
            onClick={scrollToBottom}
            data-testid="new-message-indicator"
          >
            New message ↓
          </button>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        <GrowingInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onCollapse={onCollapse}
          disabled={isThinking}
        />
        <button
          type="button"
          className={canSend ? styles.sendButtonActive : styles.sendButtonDisabled}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Press Enter to send"
        >
          {isThinking ? (
            <div className={styles.sendButtonSpinner} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
})
