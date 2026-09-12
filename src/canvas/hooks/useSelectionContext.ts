import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import {
  describeSelectionCarriage,
  type SelectionCarriage,
} from '../conversation/selectedElementRefs'

export interface SelectionContext {
  id: string
  label: string
  kind: 'node' | 'edge'
}

/**
 * Returns the single currently-selected canvas element, or null when nothing
 * or more than one element is selected. Used by the persistent input strip
 * (selection pill, stage-aware placeholder).
 *
 * ⭐ IT NOW DERIVES FROM THE WIRE RULE RATHER THAN RE-READING THE STORE, AND
 * THAT CLOSES A REAL DISAGREEMENT — this hook and `buildPayload` were two
 * authorities answering "what is this turn about?", and they did not agree:
 *
 *   · this hook fell back to `?? id`, so a node with no label displayed its RAW
 *     ID to the user, where the wire correctly omits the label entirely;
 *   · it never checked `node.type`, so a KINDLESS node was named in the pill
 *     and DROPPED by the wire — the product named an element the turn did not
 *     carry, which is the one thing the pill must never do.
 *
 * `SelectionPill`'s own header already recorded the correct principle — *"one
 * code path, so the two affordances can never come to mean different things"* —
 * and applied it to its two buttons. This applies the same principle one level
 * up, to the pill and the payload.
 *
 * The pill's public shape is unchanged, so nothing downstream moves. What
 * changes is that a context is returned ONLY when the turn will actually carry
 * that element.
 */
export function useSelectionContext(): SelectionContext | null {
  const carriage = useSelectionCarriage()
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)

  return useMemo<SelectionContext | null>(() => {
    if (carriage.kind !== 'carried' || carriage.refs.length !== 1) return null
    const ref = carriage.refs[0]

    if (ref.kind !== 'edge') {
      // `label` is absent exactly when the wire has nothing truthful to send.
      // Returning null here rather than falling back to the id is the fix: an
      // id is not a name, and showing one told the user the product knew what
      // they had selected when it did not.
      if (!ref.label) return null
      return { id: ref.id, label: ref.label, kind: 'node' }
    }

    // The wire addresses an edge as the canonical `source→target` composite.
    // Recover the UI-facing labels for DISPLAY only — the id stays the wire's,
    // so the pill's single-flight guard keys on the same identity the turn does.
    const [source, target] = ref.id.split('→')
    const edge = edges.find((e) => e.source === source && e.target === target)
    if (!edge) return null
    const sourceLabel = (nodes.find((n) => n.id === source)?.data?.label as string | undefined) ?? source
    const targetLabel = (nodes.find((n) => n.id === target)?.data?.label as string | undefined) ?? target
    return { id: ref.id, label: `${sourceLabel} → ${targetLabel}`, kind: 'edge' }
  }, [carriage, nodes, edges])
}

/**
 * The full carriage answer, for surfaces that must say something when a
 * selection exists but is NOT being carried.
 *
 * `useSelectionContext` returns null for three very different situations —
 * nothing selected, more than one element selected, and a selection the wire
 * withholds — and a surface that only knows "null" cannot tell the user which.
 * Silence is right for the first and a false statement by omission for the
 * last: the user has pointed at something, believes the question is about it,
 * and it is not.
 */
export function useSelectionCarriage(): SelectionCarriage {
  const selection = useCanvasStore((s) => s.selection)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  return useMemo(
    () => describeSelectionCarriage({ selection, nodes, edges }),
    [selection, nodes, edges],
  )
}
