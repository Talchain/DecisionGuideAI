/**
 * useSmartScroll — THE scroll authority for the conversation thread.
 *
 * Keeps the thread pinned to its newest content, unless the user has
 * deliberately scrolled more than 60px up from the bottom — in which case it
 * never steals their position and raises the "New messages" pill instead.
 *
 * ⭐ ONE DECISION, SEVERAL SENSORS. The courtesy rule lives exactly once, in
 * `pinOrNotify`. Three sensors feed it — a message arrived, the surface was
 * revealed, the content grew — because those are three different ways the same
 * event becomes observable, not three different rules. `ChatThread` owns no
 * scroll logic of its own; if you are about to add scroll handling to this
 * surface, add a sensor here rather than a second controller beside it.
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

  /**
   * ⭐ THE ONE SCROLL-COURTESY DECISION FOR THIS SURFACE.
   *
   * "New content has arrived: is the reader pinned to the bottom, or are they
   * reading history?" — pin, or raise the pill; never both, never neither.
   *
   * This rule used to be WRITTEN OUT THREE TIMES in this file — the message
   * effect's if/else, the reveal observer's inline `scrollIntoView` +
   * `setShowNewMessageIndicator(false)`, and `scrollToBottom` — which is the
   * hand-maintained mirror this estate pays for repeatedly (CLAUDE.md trap 12):
   * three copies that agree today diverge at the next tweak, and the drift
   * reads as green. Every sensor below now routes through THIS function, so a
   * change to the courtesy rule cannot land in one copy and miss the others.
   *
   * The sensors are deliberately several — a message arrived, the surface was
   * revealed, the content grew — because those are three different ways the
   * same event becomes observable. They are SENSORS, not rules: the decision
   * exists once, here.
   */
  const pinOrNotify = useCallback((behavior: ScrollBehavior) => {
    if (userScrolledUpRef.current) {
      setShowNewMessageIndicator(true)
      return
    }
    listEndRef.current?.scrollIntoView({ behavior })
    setShowNewMessageIndicator(false)
  }, [])

  /** The pill's own action: the user ASKED to go to the bottom, so it always goes. */
  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMessageIndicator(false)
  }, [])

  // Sensor 1 — a message arrived (or the thinking state settled).
  useEffect(() => {
    if (messageCount === 0) return
    pinOrNotify('smooth')
  }, [messageCount, isThinking, pinOrNotify])

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
  // Sensor 2 — the surface was REVEALED.
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastHeight = el.clientHeight
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height
        if (lastHeight === 0 && height > 0) pinOrNotify('auto')
        lastHeight = height
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [pinOrNotify])

  // ── Sensor 3: the CONTENT GREW inside an existing message ─────────────────
  //
  // ⚠ WHY A COUNT OF MESSAGES CANNOT SEE THE REPLY ARRIVE. Sensor 1's
  // `messageCount` is a PROXY for content, and on the single most important
  // turn in the product the proxy is constant while the content is everything.
  // Derived at the producer (`useConversation.ts`): the streaming path creates
  // ONE placeholder assistant message (`isStreaming: true`, :5928) and then
  // grows it by MUTATION — `text_delta` → `scheduleStreamFlush` → content, and
  // `block` → `updateMessage(msgId, { blocks })` (:5962-5985). A first-time
  // user's brief comes back as one message that grows for tens of seconds, and
  // the suggested chips land on it at the very end. Across every one of those
  // commits `messages.length`, `renderedMessageCount` and `isThinking` are all
  // IDENTICAL, so sensors 1 and 2 are structurally incapable of observing any
  // of it.
  //
  // Measured at pristine `aa916511` in real Chromium
  // (`e2e/geometry/threadAutoScroll.measure.ts` — jsdom cannot prove this,
  // CLAUDE.md trap 3): after the reply grew, `scrollTop 0`, `scrollHeight
  // 1194`, `clientHeight 600`, and the "Run analysis" chip sat at y=1126 with
  // `inView: false` and `hitTestable: false`. The chip was never dead. It was
  // 526 px below the bottom of a thread that had stopped following its own
  // content.
  //
  // So this sensor observes the content ITSELF rather than a proxy for it. A
  // MutationObserver fires on exactly the commits above (text, blocks, chips)
  // and on nothing the user did — `scrollIntoView` mutates no DOM, so there is
  // no feedback loop, and `setShowNewMessageIndicator` bails out on an
  // unchanged value rather than re-rendering. Records are already batched at
  // the microtask checkpoint, and the producer itself commits on rAF, so this
  // is one re-pin per frame at worst.
  //
  // INSTANT, not smooth, and that is load-bearing: a smooth flight is animated
  // over several frames, during which `handleScroll` sees a mid-flight
  // scrollTop, concludes the user has scrolled up, and cancels the very pin
  // that is in progress. Instant lands in one event, at the bottom, where
  // `handleScroll` correctly reads "near bottom".
  useEffect(() => {
    const el = listRef.current
    if (!el || typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => pinOrNotify('auto'))
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pinOrNotify])

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
