/**
 * ⭐ THE CHAT THREAD SCROLLS ITSELF AND NOTHING ELSE — the one way any code moves the conversation.
 *
 * WITNESSED (reasoning witness, 7 Oct 2026, 15 of 15 turns with the chat at the bottom, on 79a058e5 → e438a05e):
 * the moment a turn went pending the Olumi tab went WHITE — only the tab row and the composer stayed — until the
 * reply landed or the waiting line changed at 20 s. A 200 ms sampler found the cause one level up: the dock's own
 * `aside[data-testid=outputs-dock]`, which is `overflow: hidden`, sat at `scrollTop 906` during the blank and 0
 * after it, while `chat-thread`'s own scrollTop never moved. Paul's words for it: "it goes blank".
 *
 * The writer was `Element.scrollIntoView`. It scrolls EVERY scrollable ancestor, and an `overflow: hidden` box is
 * still a scroll container to script. The thread pinned itself by calling it on an end sentinel with no `block`,
 * i.e. `block: 'start'`, so the browser also scrolled the dock to put that sentinel at the dock's top, carrying the
 * whole conversation out of view. The run-return card scroll (`block: 'start'`) did the same for a moment.
 *
 * So the thread is moved ONLY by writing the thread's own scroll position, here. The ancestors cannot move because
 * nothing ever asks them to.
 */

/** The attribute `ChatThread` puts on its scroll container, so a target can find the thread it sits in. */
export const THREAD_SCROLLER_ATTRIBUTE = 'data-thread-scroller'

/** Move the thread to `top`, writing only the thread. `scrollTo` where the platform has it; else `scrollTop`. */
export function scrollThreadTo(thread: HTMLElement, top: number, behavior: ScrollBehavior): void {
  if (typeof thread.scrollTo === 'function') {
    thread.scrollTo({ top, behavior })
    return
  }
  thread.scrollTop = top
}

/** Pin the thread to its end. The browser clamps an over-large `top` to the end. */
export function scrollThreadToEnd(thread: HTMLElement, behavior: ScrollBehavior): void {
  scrollThreadTo(thread, thread.scrollHeight, behavior)
}

/**
 * Bring `target` into view INSIDE the thread that contains it, moving only that thread:
 *   · `block: 'start'`   — the target's top at the thread's top;
 *   · `block: 'nearest'` — the least movement that shows it (none when it is already in view).
 * Returns false when `target` is not inside a thread; the caller then decides (nothing is scrolled here).
 */
export function scrollWithinThread(
  target: Element,
  { behavior, block }: { behavior: ScrollBehavior; block: 'start' | 'nearest' },
): boolean {
  const thread = target.closest<HTMLElement>(`[${THREAD_SCROLLER_ATTRIBUTE}]`)
  if (!thread) return false
  const threadBox = thread.getBoundingClientRect()
  const box = target.getBoundingClientRect()
  const offsetTop = box.top - threadBox.top
  if (block === 'start') {
    scrollThreadTo(thread, thread.scrollTop + offsetTop, behavior)
    return true
  }
  const offsetBottom = box.bottom - threadBox.bottom
  // CSSOM "nearest": a target in view, or one spanning both edges, does not move; otherwise align the edge that is
  // out of view, unless the target is taller than the thread, in which case align the other edge.
  const tallerThanThread = box.bottom - box.top > threadBox.bottom - threadBox.top
  if ((offsetTop >= 0 && offsetBottom <= 0) || (offsetTop < 0 && offsetBottom > 0)) return true
  if (offsetTop < 0) {
    scrollThreadTo(thread, thread.scrollTop + (tallerThanThread ? offsetBottom : offsetTop), behavior)
  } else {
    scrollThreadTo(thread, thread.scrollTop + (tallerThanThread ? offsetTop : offsetBottom), behavior)
  }
  return true
}
