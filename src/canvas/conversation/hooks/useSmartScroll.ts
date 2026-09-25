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
 *
 * ⭐ ONE CAP ON "PINNED": THE START OF THE NEWEST REPLY. When a new assistant
 * reply arrives and the reply (plus what follows it) is taller than the thread,
 * pinning to the bottom lands the reader on its END — the witnessed defect: a
 * long Run reply opened with its conclusion, and the conclusion was above the
 * fold (`e2e/ai-conversation/evidence/09-prb-run-reply-1280x800-as-arrived.png`).
 * So the pin follows new content only until the reply's first line reaches the
 * top of the thread, and stops there. The reader sees the conclusion first and
 * scrolls down for the rest. The cap is part of `pinOrNotify` (the pin, not a
 * second rule), so the same sensors, the same scrolled-up courtesy and the same
 * pill apply to it unchanged. It moves the reader FORWARD only — never back up
 * past where they already are — and it is never set by the user's own send, by a
 * restored transcript, or by a mount.
 */

import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import type { ConversationMessage } from '../types'

const SCROLL_THRESHOLD_PX = 60

/**
 * Space left above a held reply's first line. It equals the 12 px bottom margin
 * `ChatMessage` gives every message, so the thread's top edge lands in the gap
 * between the previous message and the reply rather than cutting through either.
 */
const REPLY_START_GAP_PX = 12

/**
 * The attribute `ChatMessage` puts on its root element, so the hook can find
 * the arriving reply by its id. Both sides use this one constant.
 */
export const MESSAGE_ID_ATTRIBUTE = 'data-message-id'

/** What the hold reads from each message: its identity and its role. */
type TranscriptEntry = Pick<ConversationMessage, 'id' | 'role'>

/**
 * The reply whose start the thread must not scroll past, given the transcript
 * now and the id of its newest message on the previous commit.
 *
 * It returns a reply only when this commit APPENDED to the transcript the
 * previous commit held (that newest id is still present, and newer messages
 * follow it) and none of the appended messages is the user's own. Every other
 * change returns null, and null keeps the old bottom pin:
 *   · mount, and a restore into an empty thread (no previous newest id);
 *   · a scenario switch or a restore that replaces the list (the previous
 *     newest id is gone);
 *   · a retry that drops the failed notice from the tail (the same);
 *   · the user's own send, which keeps scrolling to the bottom.
 * When one commit appends several messages, the first assistant message among
 * them is held: that is where the new text starts.
 */
export function arrivedReplyId(
  messages: ReadonlyArray<TranscriptEntry>,
  previousNewestId: string | null | undefined,
): string | null {
  let i = messages.length - 1
  while (i >= 0 && messages[i].id !== previousNewestId) i--
  if (i < 0) return null
  const appended = messages.slice(i + 1)
  if (appended.some((m) => m.role === 'user')) return null
  return appended.find((m) => m.role === 'assistant')?.id ?? null
}

interface UseSmartScrollDeps {
  messageCount: number
  isThinking: boolean
  /**
   * The transcript, in order. Only `id` and `role` are read, to detect a
   * reply that has just arrived (see `arrivedReplyId`). When it is
   * omitted, the hook pins to the bottom exactly as it did before the hold.
   */
  messages?: ReadonlyArray<TranscriptEntry>
}

interface UseSmartScrollReturn {
  listRef: React.RefObject<HTMLDivElement>
  listEndRef: React.RefObject<HTMLDivElement>
  showNewMessageIndicator: boolean
  handleScroll: () => void
  scrollToBottom: () => void
}

export function useSmartScroll({ messageCount, isThinking, messages }: UseSmartScrollDeps): UseSmartScrollReturn {
  const listRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const userScrolledUpRef = useRef(false)

  // ── The reply-start hold ──────────────────────────────────────────────────
  //
  // `replyStartIdRef` names the newest arrived reply, or null when there is no
  // hold. `newestIdRef` is the transcript's newest id on the previous commit,
  // which is how an arrival is told apart from a restore.
  const newestIdRef = useRef<string | null | undefined>(undefined)
  const replyStartIdRef = useRef<string | null>(null)

  /**
   * The `scrollTop` that puts the held reply's first line at the top of the
   * thread, or null when there is no hold or the reply is not rendered. Null
   * means "pin to the bottom as before". The reply is found by its id on every
   * call, never cached: a message that re-mounts is still found.
   */
  const replyStartScrollTop = useCallback((list: HTMLElement): number | null => {
    const id = replyStartIdRef.current
    if (id === null) return null
    const rendered = list.querySelectorAll(`[${MESSAGE_ID_ATTRIBUTE}]`)
    for (let i = rendered.length - 1; i >= 0; i--) {
      if (rendered[i].getAttribute(MESSAGE_ID_ATTRIBUTE) !== id) continue
      const offset = rendered[i].getBoundingClientRect().top - list.getBoundingClientRect().top
      return list.scrollTop + offset - REPLY_START_GAP_PX
    }
    return null
  }, [])

  /**
   * Apply the hold, if it binds. It binds only when pinning to the bottom would
   * push the held reply's first line above the top of the thread. It then
   * brings that line up to the top — FORWARD only, never back above where the
   * reader already is — and returns true so the caller skips the bottom pin.
   * When the reply and everything after it fit, it returns false and the
   * bottom pin runs as before. A hidden thread (`display: none`) has no layout
   * and cannot scroll, whichever branch runs; the reveal re-pin (sensor 2)
   * applies the hold once the thread is shown and can be measured.
   */
  const holdAtReplyStart = useCallback((): boolean => {
    const list = listRef.current
    if (!list) return false
    const startTop = replyStartScrollTop(list)
    if (startTop === null) return false
    if (list.scrollHeight - list.clientHeight <= startTop) return false
    if (list.scrollTop < startTop) list.scrollTop = startTop
    return true
  }, [replyStartScrollTop])

  // Detect the arrival, in a LAYOUT effect, and that is load-bearing. The
  // commit that adds the reply to the DOM also queues sensor 3's
  // MutationObserver callback, which runs as a microtask as soon as React's
  // commit finishes and pins at once. A reply arrives from the network as a
  // default-priority update, and React's scheduler runs its passive effects as
  // a separate task; when the render has used its 5 ms slice (a long reply's
  // render can), the scheduler yields first and that microtask pins before any
  // passive effect runs. A hold recorded in a passive effect would then find
  // the reader already moved to the bottom, and "forward only" would keep them
  // there. A layout effect runs inside the commit, before the microtask, so the
  // first pin to see the reply already knows about it. Pinned by the "(a)
  // timing" case in `ChatThread.replyStartInView.spec.tsx`.
  useLayoutEffect(() => {
    if (!messages) return
    const previousNewestId = newestIdRef.current
    const newestId = messages.length > 0 ? messages[messages.length - 1].id : null
    newestIdRef.current = newestId
    if (newestId === previousNewestId) return
    replyStartIdRef.current = arrivedReplyId(messages, previousNewestId)
  }, [messages])

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
    // The pin, capped at the newest reply's start (header note). The hold sets
    // `scrollTop` directly, so it is instant whatever `behavior` the sensor
    // asked for — no animation, with or without prefers-reduced-motion.
    if (!holdAtReplyStart()) listEndRef.current?.scrollIntoView({ behavior })
    setShowNewMessageIndicator(false)
  }, [holdAtReplyStart])

  /**
   * The pill's own action: the user ASKED to go to the bottom, so it always
   * goes — and the hold is released, so later content keeps following them there.
   */
  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false
    replyStartIdRef.current = null
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
    // A reader at the held reply's start is where the pin put them, not
    // someone who scrolled away to read history. Counting them as "scrolled
    // up" would raise the "New messages" pill for the rest of their own reply.
    // The band is the same 60 px as the bottom's. Outside it, in either
    // direction, the old rule applies unchanged: new content raises the pill
    // and never moves them.
    const startTop = replyStartScrollTop(el)
    const atReplyStart = startTop !== null && Math.abs(el.scrollTop - startTop) <= SCROLL_THRESHOLD_PX
    // The reader has scrolled down past the reply's start to the bottom: the
    // hold has done its job, so from here the thread follows new content to
    // the bottom as before.
    if (isNearBottom && startTop !== null && el.scrollTop > startTop + SCROLL_THRESHOLD_PX) {
      replyStartIdRef.current = null
    }
    const following = isNearBottom || atReplyStart
    userScrolledUpRef.current = !following
    if (following) {
      setShowNewMessageIndicator(false)
    }
  }, [replyStartScrollTop])

  return { listRef, listEndRef, showNewMessageIndicator, handleScroll, scrollToBottom }
}
