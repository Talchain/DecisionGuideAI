/**
 * useComposerState — textarea state, auto-grow, and keyboard handling.
 *
 * Enter sends (when content + not disabled), Shift+Enter inserts newline,
 * Escape collapses the panel. The textarea auto-grows with content up to
 * a configurable max height (default 35% of panel).
 */

import { useRef, useState, useCallback, useEffect } from 'react'

interface UseComposerStateOpts {
  onSend: (text: string) => void
  onCollapse: () => void
  disabled?: boolean
  maxHeightPercent?: number
}

interface UseComposerStateReturn {
  value: string
  setValue: (v: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  canSend: boolean
  reset: () => void
  replaceText: (text: string) => void
}

export function useComposerState({
  onSend,
  onCollapse,
  disabled = false,
  maxHeightPercent = 35,
}: UseComposerStateOpts): UseComposerStateReturn {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !disabled

  // Auto-grow on value change — caps at maxHeightPercent of viewport
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = Math.floor(window.innerHeight * (maxHeightPercent / 100))
    const newHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeightPercent])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (canSend) {
          onSend(value.trim())
          setValue('')
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onCollapse()
      }
    },
    [canSend, value, onSend, onCollapse],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
    },
    [],
  )

  const reset = useCallback(() => {
    setValue('')
  }, [])

  /** Replace input content (used by Guide dropdown). Focuses and places cursor at end. */
  const replaceText = useCallback((text: string) => {
    setValue(text)
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(text.length, text.length)
      }
    })
  }, [])

  return { value, setValue, textareaRef, handleKeyDown, handleChange, canSend, reset, replaceText }
}
