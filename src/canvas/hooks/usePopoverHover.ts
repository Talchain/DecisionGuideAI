/**
 * usePopoverHover — shared hook for node hover popover behaviour.
 *
 * Desktop (hover: fine): 300ms enter delay, 100ms leave delay.
 * Mouse can transition from node into popover without closing.
 * Touch (hover: none): tap node to toggle popover open/closed.
 * Tap elsewhere to close on touch devices.
 * Quick-action and card-metadata hover/focus take precedence over the node preview. This
 * prevents its tooltip from competing with the preview; Escape dismisses
 * the preview until the pointer leaves and re-enters the node.
 *
 * ─── ⭐⭐⭐ THE TOUCH LINE ABOVE WAS TRUE OF THIS FILE AND FALSE OF THE PRODUCT ───
 *
 * *"Touch (hover: none): tap node to toggle popover open/closed"* has been in
 * this header since the hook was written, and `nodeHandlers.onClick` below
 * implements it. **No node component has ever wired it.** Measured at
 * `4b9a8fb548d3526706e1268753e9188202ea99c9` with a contrast control in the
 * same sweep of the same tree:
 *
 *     rg -a 'nodeHandlers\.onClick'      ->  0 hits, 0 files     (target)
 *     rg -a 'nodeHandlers\.onMouseEnter' ->  6 hits, 6 files     (contrast)
 *
 * Six node types, six wrappers, every one of them wiring the two MOUSE
 * handlers and none of them wiring the touch one. So on a touch device the
 * preview could not be opened at all: `onMouseEnter` returns early when
 * `isTouchRef` is set, and nothing else could set `showPopover`.
 *
 * That matters because the preview is this card's declared RECOVERY SURFACE
 * for text the product shortens in JavaScript — `OptionNode.tsx` says so in
 * as many words ("This popover is the recovery surface for the card's
 * compaction"). A recovery surface reachable only by hover recovers nothing
 * for a finger. Of the 34 distinct factor labels in the five committed
 * starter captures, **23 (68%) are shortened before they are rendered**, so
 * this is the ordinary case on this canvas, not an edge one.
 *
 * `NodeQuickActions.tsx` quotes the ruling this violates, from the same
 * estate: *"Every hover action has a click/tap/keyboard equivalent."*
 *
 * ─── WHAT CHANGED HERE ──────────────────────────────────────────────────────
 *
 * 1. The tap path stops calling `stopPropagation` (see `onClick`), so wiring
 *    it is ADDITIVE and cannot cost a touch user the node selection they get
 *    today. That is what makes it safe for all six wrappers to adopt it.
 * 2. A KEYBOARD path is added, which this hook never had in any form: the
 *    preview opens when the node itself takes KEYBOARD focus. WCAG 2.1 AA
 *    1.4.13 (Content on Hover or Focus) is the standard — content available
 *    on hover must be available on focus — and a keyboard user has no
 *    pointer to hover with.
 */
import { useState, useRef, useEffect, useCallback } from 'react'

const ENTER_DELAY = 300
const LEAVE_DELAY = 100

export function usePopoverHover() {
  const [showPopover, setShowPopover] = useState(false)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTouchRef = useRef(false)
  const nodeElRef = useRef<HTMLElement | null>(null)
  const pointerWithin = useRef(false)
  const actionHovered = useRef(false)
  const actionFocused = useRef(false)
  const dismissed = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchRef.current = window.matchMedia('(hover: none)').matches
    }
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    }
  }, [])

  // Touch: close popover when tapping outside the node
  useEffect(() => {
    if (!showPopover || !isTouchRef.current) return
    const handler = (e: MouseEvent) => {
      if (nodeElRef.current && !nodeElRef.current.contains(e.target as Node)) {
        setShowPopover(false)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [showPopover])

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  const cancelEnter = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
  }, [])

  const scheduleEnter = useCallback(() => {
    cancelEnter()
    if (actionHovered.current || actionFocused.current || dismissed.current) return
    enterTimerRef.current = setTimeout(() => {
      if (!actionHovered.current && !actionFocused.current && !dismissed.current) {
        setShowPopover(true)
      }
    }, ENTER_DELAY)
  }, [cancelEnter])

  useEffect(() => {
    const node = nodeElRef.current
    if (!node) return
    const isAction = (target: EventTarget | null) =>
      target instanceof Element && node.contains(target) &&
      !!target.closest('.node-quick-actions, [data-node-tooltip]')
    const update = () => {
      if (actionHovered.current || actionFocused.current) {
        cancelEnter()
        cancelLeave()
        setShowPopover(false)
      } else if (pointerWithin.current && !isTouchRef.current) {
        scheduleEnter()
      }
    }
    const over = (event: MouseEvent) => { actionHovered.current = isAction(event.target); update() }
    const out = (event: MouseEvent) => { actionHovered.current = isAction(event.relatedTarget); update() }
    const focus = (event: FocusEvent) => { actionFocused.current = isAction(event.target); update() }
    const blur = (event: FocusEvent) => { actionFocused.current = isAction(event.relatedTarget); update() }
    node.addEventListener('mouseover', over)
    node.addEventListener('mouseout', out)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', blur)
    return () => {
      node.removeEventListener('mouseover', over)
      node.removeEventListener('mouseout', out)
      node.removeEventListener('focusin', focus)
      node.removeEventListener('focusout', blur)
    }
  }, [cancelEnter, cancelLeave, scheduleEnter])

  /**
   * ⭐⭐ THE KEYBOARD PATH — the one this hook never had.
   *
   * WHY IT IS BOUND TO `.react-flow__node` AND NOT TO `nodeElRef`.
   * `nodeElRef` points at the wrapper each node component renders INSIDE React
   * Flow's own node element. React Flow (`nodesFocusable` defaults on; this
   * repo sets neither `nodesFocusable` nor `disableKeyboardA11y` — derived at
   * `ReactFlowGraph.tsx`, which passes neither) makes THAT element the focus
   * target. `focusin` bubbles UP, so a listener on the wrapper can only ever
   * see a DESCENDANT take focus — never the ancestor that actually receives
   * it. The existing wrapper listener below is therefore correct for what it
   * does (suppressing the preview while a quick-action button holds focus) and
   * structurally incapable of noticing the node's own focus ring.
   *
   * WHY `:focus-visible` AND NOT PLAIN FOCUS. A mouse click focuses the node
   * too. Opening on every click would bypass the 300ms hover intent this hook
   * exists to provide and change a behaviour nobody asked to change. The
   * pseudo-class is the browser's own answer to "was this focus a keyboard
   * focus", and it is already this repo's idiom (`focus-visible:ring-2`).
   *
   * ⚠ AND THE FALLBACK DIRECTION IS DELIBERATE. `matches(':focus-visible')`
   * can throw in a DOM implementation that does not know the selector (jsdom's
   * nwsapi raises on unsupported pseudo-classes rather than returning false),
   * so it is guarded — and the guard returns TRUE. Failing toward MORE
   * recovery is the correct direction here: a preview that opens when it need
   * not is a nuisance, a preview that will not open is the defect this change
   * exists to close.
   *
   * NO DELAY ON THIS PATH. The enter delay models a pointer PASSING OVER a
   * card on its way somewhere else. Keyboard focus is never accidental in that
   * way — it is the result of a deliberate Tab — so making a keyboard user
   * wait 300ms would be latency bought for no benefit.
   */
  useEffect(() => {
    const wrapper = nodeElRef.current
    if (!wrapper) return
    const rfNode = wrapper.closest('.react-flow__node')
    if (!rfNode) return

    const isKeyboardFocus = (el: Element): boolean => {
      try {
        return el.matches(':focus-visible')
      } catch {
        return true
      }
    }

    const focusIn = (event: FocusEvent) => {
      // ONLY the node's own focus ring. A descendant control taking focus must
      // keep SUPPRESSING the preview — that is `update()` below, and it is the
      // opposite behaviour, already correct, and not to be re-decided here.
      if (event.target !== rfNode) return
      if (!isKeyboardFocus(rfNode)) return
      // A keyboard user arriving deliberately outranks an earlier Escape.
      dismissed.current = false
      cancelEnter()
      cancelLeave()
      setShowPopover(true)
    }

    const focusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      // The popover is PORTALLED to document.body, so it is not a DOM
      // descendant of the node — `rfNode.contains()` alone would close it the
      // instant focus moved into the very content it was opened to show.
      // `data-node-popover` is the attribute that component already carries
      // for exactly this kind of cross-portal question.
      if (
        next instanceof Element &&
        (rfNode.contains(next) || next.closest('[data-node-popover]'))
      ) return
      setShowPopover(false)
    }

    rfNode.addEventListener('focusin', focusIn as EventListener)
    rfNode.addEventListener('focusout', focusOut as EventListener)
    return () => {
      rfNode.removeEventListener('focusin', focusIn as EventListener)
      rfNode.removeEventListener('focusout', focusOut as EventListener)
    }
  }, [cancelEnter, cancelLeave])

  useEffect(() => {
    if (!showPopover) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      dismissed.current = true
      cancelEnter()
      cancelLeave()
      setShowPopover(false)
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [showPopover, cancelEnter, cancelLeave])

  const nodeHandlers = {
    onMouseEnter: useCallback(() => {
      if (isTouchRef.current) return
      pointerWithin.current = true
      cancelLeave()
      scheduleEnter()
    }, [cancelLeave, scheduleEnter]),

    onMouseLeave: useCallback(() => {
      if (isTouchRef.current) return
      pointerWithin.current = false
      actionHovered.current = false
      dismissed.current = false
      cancelEnter()
      leaveTimerRef.current = setTimeout(() => setShowPopover(false), LEAVE_DELAY)
    }, [cancelEnter]),

    /**
     * ⭐ THE TAP PATH. Wired by all six node wrappers as of this change; wired
     * by none of them before it (see the header's contrast-controlled sweep).
     *
     * ⛔ `stopPropagation` REMOVED, AND THAT REMOVAL IS WHAT MAKES WIRING THIS
     * SAFE. With it, the first tap on a card would have opened the preview
     * INSTEAD OF selecting the node — trading one thing a touch user cannot do
     * for another they currently can, which is not a fix. Without it the tap
     * does both: the node selects exactly as it does today, and its preview
     * opens. Strictly additive, which is the only shape a change to a path
     * that has never run should take.
     *
     * The outside-tap close above still works: its `pointerdown` listener is
     * on `document` in the CAPTURE phase and asks `nodeElRef.contains(target)`,
     * a containment question that propagation has no bearing on.
     */
    onClick: useCallback(() => {
      if (!isTouchRef.current) return
      setShowPopover(prev => !prev)
    }, []),
  }

  const popoverHandlers = {
    onMouseEnter: useCallback(() => {
      cancelLeave()
    }, [cancelLeave]),

    onMouseLeave: useCallback(() => {
      leaveTimerRef.current = setTimeout(() => setShowPopover(false), LEAVE_DELAY)
    }, []),
  }

  const close = useCallback(() => setShowPopover(false), [])

  return { showPopover, nodeHandlers, popoverHandlers, close, nodeElRef }
}
