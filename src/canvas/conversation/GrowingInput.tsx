/**
 * GrowingInput — Single-line to 3-line growing textarea
 *
 * Starts as a single line, expands to max 3 lines as the user types.
 * Enter sends, Shift+Enter inserts newline, Esc collapses the panel.
 */

import { useRef, useCallback, useEffect, memo } from 'react'
import styles from './Conversation.module.css'

interface GrowingInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onCollapse: () => void
  disabled?: boolean
  placeholder?: string
}

const MAX_ROWS = 3
const LINE_HEIGHT = 24 // 16px font * 1.5 line-height

export const GrowingInput = memo(function GrowingInput({
  value,
  onChange,
  onSend,
  onCollapse,
  disabled = false,
  placeholder = 'Describe your decision...',
}: GrowingInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_ROWS
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!disabled && value.trim()) {
          onSend()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCollapse()
      }
    },
    [disabled, value, onSend, onCollapse],
  )

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={styles.growingInput}
      rows={1}
      aria-label="Message input"
    />
  )
})
