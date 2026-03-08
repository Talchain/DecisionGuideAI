/**
 * useSmartScroll — auto-scroll logic for the conversation thread.
 *
 * Auto-scrolls to bottom when new messages arrive, unless the user has
 * scrolled up more than 60px from the bottom. Shows a "New messages"
 * indicator when new content arrives while scrolled up.
 */

import { useRef, useState, useCallback, useEffect } from 'react'

const SCROLL_THRESHOLD_PX = 60

interface UseSmartScrollDeps {
  messageCount: number
  isThinking: boolean
}

interface UseSmartScrollReturn {
  listRef: React.RefObject<HTMLDivElement>
  listEndRef: React.RefObject<HTMLDivElement>
  showNewMessageIndicator: boolean
  handleScroll: () => void
  scrollToBottom: () => void
}

export function useSmartScroll({ messageCount, isThinking }: UseSmartScrollDeps): UseSmartScrollReturn {
  const listRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const userScrolledUpRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMessageIndicator(false)
    userScrolledUpRef.current = false
  }, [])

  useEffect(() => {
    if (messageCount === 0) return

    if (userScrolledUpRef.current) {
      setShowNewMessageIndicator(true)
    } else {
      scrollToBottom()
    }
  }, [messageCount, isThinking, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD_PX
    userScrolledUpRef.current = !isNearBottom
    if (isNearBottom) {
      setShowNewMessageIndicator(false)
    }
  }, [])

  return { listRef, listEndRef, showNewMessageIndicator, handleScroll, scrollToBottom }
}
