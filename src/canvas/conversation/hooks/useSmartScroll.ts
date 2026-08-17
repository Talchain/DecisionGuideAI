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

  // ── L-83: re-pin to bottom when the thread is REVEALED ────────────────────
  //
  // A message that arrives while the thread is HIDDEN — the floating panel
  // minimised (`display:none`), or the collapsed dock's Olumi tab — cannot be
  // scrolled to: `scrollIntoView` on a container with no boxes is a silent
  // no-op, and nothing here re-ran when the surface came back. So the newest
  // message (on the witnessed journey, a failure notice whose Retry affordance
  // is the recovery path) laid out BELOW the visible band, and every
  // hit-test point of its controls resolved to the composer strip under the
  // thread — the ISSUE-LEDGER L-83 "0/121 points, fully occluded by the chat
  // composer" measurement. The z-order was never the defect; the missing
  // reveal re-pin was.
  //
  // A hidden element has zero border-box size, so a ResizeObserver on the
  // list sees the reveal as a 0 → >0 transition. Re-pin then, INSTANTLY (an
  // animated flight from scrollTop 0 would be surprise motion the user never
  // initiated), and only when the user has not deliberately scrolled up —
  // a reveal must never steal the position of someone reading history (their
  // "New messages" pill already handles that case).
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastHeight = el.clientHeight
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height
        if (lastHeight === 0 && height > 0 && !userScrolledUpRef.current) {
          listEndRef.current?.scrollIntoView({ behavior: 'auto' })
          setShowNewMessageIndicator(false)
        }
        lastHeight = height
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
