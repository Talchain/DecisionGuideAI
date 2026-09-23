/**
 * Who holds the option card's preview open, besides the hover/tap/focus paths
 * `usePopoverHover` already owns. Two doors, both deliberate
 * (`shared/optionCardAtRest.ts`):
 *
 *   · SELECTING the card — its "expanded" state, opened on purpose, without
 *     growing the card;
 *   · pressing `+N more` — the same list for a reader who has not selected.
 *
 * ⭐ AND THREE EXITS, because a pin with no exit is a popover stuck over the
 * board. Deselecting releases everything; Escape releases the pin until the
 * selection next changes (WCAG 2.1 1.4.13 — additional content on focus or
 * hover must be dismissable, and a pin is that content held open); pressing
 * `+N more` again closes it. A `+N more` pin also releases on a press anywhere
 * that is not this card or its own preview — a SELECTION pin does not need
 * that, because React Flow deselects on such a press itself.
 *
 * ⚠ THE PREVIEW IS PORTALLED, so "inside" is decided by IDENTITY, never by
 * DOM containment alone: the same `[data-node-popover]` owner id
 * `usePopoverHover` compares against, taken from the anchor's React Flow node,
 * and an EMPTY id owns nothing (fail closed — the rule that hook states).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export function useOptionPreviewPin({
  enabled,
  selected,
  anchorRef,
}: {
  /** Only a card that compacted something has anything to pin. */
  enabled: boolean
  selected: boolean
  anchorRef: RefObject<HTMLElement | null>
}): { pinRequested: boolean; toggle: () => void } {
  const [requested, setRequested] = useState(false)
  const [released, setReleased] = useState(false)
  const wasSelected = useRef(selected)

  useEffect(() => {
    if (wasSelected.current === selected) return
    wasSelected.current = selected
    // Any change of selection starts fresh: selecting pins again after an
    // earlier Escape, and deselecting releases a `+N more` pin with it.
    setReleased(false)
    if (!selected) setRequested(false)
  }, [selected])

  const pinRequested = enabled && (requested || (selected && !released))

  useEffect(() => {
    if (!pinRequested) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setRequested(false)
      setReleased(true)
    }
    const onPointer = (event: PointerEvent) => {
      if (!requested) return
      const target = event.target
      if (!(target instanceof Node)) return
      const anchor = anchorRef.current
      if (anchor?.contains(target)) return
      const ownerId = anchor?.closest('.react-flow__node')?.getAttribute('data-id') ?? ''
      const owner = target instanceof Element ? target.closest('[data-node-popover]') : null
      if (ownerId && owner?.getAttribute('data-node-popover') === ownerId) return
      setRequested(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer, true)
    }
  }, [pinRequested, requested, anchorRef])

  const toggle = useCallback(() => {
    if (pinRequested) {
      setRequested(false)
      setReleased(true)
    } else {
      setRequested(true)
      setReleased(false)
    }
  }, [pinRequested])

  return { pinRequested, toggle }
}
