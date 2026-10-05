/**
 * ⭐⭐ F8 (27 Sep 2026), THE CLICK AND THE RIGHT-CLICK: both act on the line
 * nearest the pointer — the one the hover highlights (`edgeHoverArbiter.ts`) —
 * not on whichever edge's hit area xyflow found on top.
 *
 * xyflow hands `onEdgeClick` / `onEdgeContextMenu` the TOPMOST hit area's edge.
 * Where sibling links share a gutter that is often a neighbour of the line the
 * person pointed at (`nearestEdgeAtPoint.ts` has the measurement). The hover
 * already follows the nearest line, so a handler that kept xyflow's edge would
 * act on a link other than the one the canvas is showing: a right-click on the
 * highlighted "Engineering Capacity → On-Time Delivery" (e-9) opened a menu for
 * e-10, whose Delete and Reverse run without naming their edge. These are the
 * two handler bodies, extracted so they can be driven; `ReactFlowGraph.tsx`
 * calls them (`reactFlowGraph.edgePointerTarget.spec.ts` pins the call sites).
 */
import type { EdgeChange } from '@xyflow/react'
import { resolveNearestEdgeAtPoint, edgeGroupAtPoint } from './nearestEdgeAtPoint'

export interface EdgePointerEvent {
  clientX: number
  clientY: number
}

/** The slice of xyflow's store a re-pointed click reads and writes. */
export interface EdgeClickFlowStore {
  /** The multi-selection key (Meta / Control here) is held. */
  multiSelectionActive: boolean
  /** xyflow's edges as of the last render — the state BEFORE this click. */
  edgeLookup: { get(id: string): { selected?: boolean } | undefined }
  triggerEdgeChanges: (changes: EdgeChange[]) => void
}

/**
 * `handleEdgeClick`'s body. xyflow has just applied its own click to `edge`
 * (the topmost hit area); when a different line is nearest the pointer, move
 * that click onto it. Returns the id the click now belongs to (null when there
 * was no pointer click to re-point).
 *
 * · A plain click selects the nearest line INSTEAD of the clicked one — by
 *   explicit select changes through the same `onEdgesChange` the click's own
 *   selection took. Not `addSelectedEdges([nearest])`: it diffs against
 *   xyflow's edge lookup, which does not yet hold the clicked edge's selection
 *   inside this handler, so it would ADD the nearest line beside the wrong one
 *   (measured: both e-9 and e-10 selected on build-vs-buy).
 * · A multi-selection click (the key held) TOGGLES in xyflow. The toggle is
 *   undone on the clicked edge (back to its state before the click, which is
 *   `edge.selected` — xyflow decided its own toggle on that same field) and
 *   applied to the nearest line instead, so a toggle-off of a selected line
 *   turns it off rather than selecting it.
 * · Keyboard focus follows the selection: xyflow's own mousedown focused the
 *   clicked edge's group, and its Escape / Enter act on the FOCUSED edge.
 */
export function retargetEdgeClick(
  event: EdgePointerEvent | undefined,
  edge: { id: string; selected?: boolean } | undefined,
  flow: EdgeClickFlowStore,
  doc: Document = document,
): string | null {
  if (!event || !edge?.id) return null
  const nearest = resolveNearestEdgeAtPoint(event.clientX, event.clientY, edge.id, doc)
  if (nearest === edge.id) return nearest
  flow.triggerEdgeChanges(
    flow.multiSelectionActive
      ? [
          { id: edge.id, type: 'select', selected: edge.selected === true },
          { id: nearest, type: 'select', selected: flow.edgeLookup.get(nearest)?.selected !== true },
        ]
      : [
          { id: edge.id, type: 'select', selected: false },
          { id: nearest, type: 'select', selected: true },
        ],
  )
  const group = edgeGroupAtPoint(event.clientX, event.clientY, nearest, doc) as (Element & { focus?: (o?: FocusOptions) => void }) | null
  if (group && group.hasAttribute('tabindex') && typeof group.focus === 'function') group.focus({ preventScroll: true })
  return nearest
}

/**
 * ⭐ S.1 FOR LINKS (Paul, 4 Oct 2026): does this click open the FULL link inspector?
 *
 * One plain click on a link opens it, exactly as one click on a card does. This reverses #2322's "E2 (Paul 29 Sep)"
 * at-pointer mini-editor (journey 4: "the link inspector needs a double click"); the inspector holds the same strength
 * and direction writers. `intendedId` is `retargetEdgeClick`'s RETURN, the line nearest the pointer (PR Review
 * 5897003679). ⛔ A Meta/Control multi-selection click is a SELECTION gesture (it may be a toggle-off), and a click
 * that resolved no link names nothing: neither opens anything (PR Review 5897538379).
 */
export function edgeClickOpensInspector(
  event: EdgePointerEvent | undefined,
  intendedId: string | null,
  multiSelectionActive: boolean,
): boolean {
  return event !== undefined && intendedId !== null && intendedId !== '' && !multiSelectionActive
}

/**
 * `onEdgeContextMenu`'s edge: the line nearest the pointer, looked up in the
 * canvas store (the menu's actions read the store by id). xyflow's own edge
 * when that line is the one it passed, or when the nearest is not in the store.
 */
export function resolveContextMenuEdge<E extends { id: string }>(
  event: EdgePointerEvent,
  edge: E,
  storeEdges: readonly E[],
  doc: Document = document,
): E {
  const nearest = resolveNearestEdgeAtPoint(event.clientX, event.clientY, edge.id, doc)
  if (nearest === edge.id) return edge
  return storeEdges.find((e) => e.id === nearest) ?? edge
}
