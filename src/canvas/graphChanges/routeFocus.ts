/**
 * ⭐ WHERE THIS CHANGE FLOWS (DL GO #85 5947426886; PTL 5947349533). On a C1 pair (the ONLY case that licenses reading the
 * model change as the reason the result moved), clicking a Changes row for a changed link or card lights its route
 * through the model's own links to the Goal, and everything else dims.
 *
 * Structural reach only: the route is the model's links, never a magnitude or a cause the producer did not send. On
 * every other pair nothing here is set, so a row click is exactly what it was (select + no-churn camera).
 *
 * One store field, `runChangesRouteFocusId`, names the element a C1 row asked about. It acts only while the selection
 * IS that element (`selectRunChangesRouteLit`), so a later click anywhere else ends it without any clearing race:
 *   - `usePathHighlight` lights a selected LINK's downstream route (a card already gets its route on selection);
 *   - the Changes view's background subdue yields to that focus, or the route would be lit and subdued at once
 *     (served `b1fa145b`, R3's C1 link pair: the click left 11/16 cards and 18/19 links dim, the route among them).
 * The surface that offers C1 rows releases the field when its pair stops being C1 and when it unmounts.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../store'

type RouteFocusState = {
  runChangesRouteFocusId?: string | null
  selection?: { nodeIds?: ReadonlySet<string>; edgeIds?: ReadonlySet<string> }
}

/** True while a C1 row's element is the current selection. Optional-chained so store doubles without the slices stay safe. */
export function selectRunChangesRouteLit(s: RouteFocusState): boolean {
  const id = s.runChangesRouteFocusId
  if (id === null || id === undefined) return false
  return s.selection?.edgeIds?.has(id) === true || s.selection?.nodeIds?.has(id) === true
}

export function releaseRunChangesRouteFocus(): void {
  if (useCanvasStore.getState().runChangesRouteFocusId !== null) useCanvasStore.getState().setRunChangesRouteFocus(null)
}

/**
 * Mount on a surface that lists Changes rows. Returns whether its rows may light a route (C1 only), and releases any
 * route focus when `attributable` changes (a rerun's new pair) or the surface unmounts.
 */
export function useRunChangesRouteFocus(attributable: boolean): boolean {
  useEffect(() => releaseRunChangesRouteFocus, [attributable])
  return attributable
}
