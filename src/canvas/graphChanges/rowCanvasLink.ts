/**
 * ⭐ THE MODEL LIGHTS UP WHAT THE AI IS TALKING ABOUT (DL #85 5939855664, lease (a); Paul's investor-UX ask).
 *
 * One link from a thing the panel or the pill names to the element it names on the canvas, bound by IDENTITY only:
 * a node id, or an edge found by its two end ids (`targetOfRow`). Never a label match: two links can share labels, and a
 * label match would light the wrong one. A row with no element on the canvas now has NO link (`null`), so nothing lights.
 *
 * Every action is an EXISTING canvas handler. Nothing here writes the graph, the analysis or a new store field:
 *   - focus     → `focusNodeById` / `focusEdgeById` (select + no-churn camera: no move when it is already in view);
 *   - highlight → `highlightNode` / `highlightEdge` (the hover highlight the Compare tab's other rows already use);
 *   - clear     → `clearHighlight`.
 *
 * `{ route: true }` (a C1 pair only — `routeFocus.ts`): the click also asks for the element's route to the Goal.
 */
import { useEffect, useMemo, useRef } from 'react'
import type { RunDeltaInputRow } from '../../components/results/analysisNew/runDeltaView'
import { useCanvasStore } from '../store'
import { focusEdgeById, focusNodeById } from '../utils/focusHelpers'
import { clearHighlight, highlightEdge, highlightNode } from '../utils/highlightHelpers'
import { targetOfRow, type GraphChangeTarget } from './graphChangesView'

export interface CanvasLink {
  readonly target: GraphChangeTarget
  readonly focus: () => void
  readonly highlight: () => void
}

export function canvasLinkOfTarget(
  target: GraphChangeTarget | null | undefined,
  opts: { route?: boolean } = {},
): CanvasLink | null {
  if (!target) return null
  return {
    target,
    focus: () => {
      if (opts.route) useCanvasStore.getState().setRunChangesRouteFocus(target.id)
      if (target.kind === 'node') focusNodeById(target.id)
      else focusEdgeById(target.id)
    },
    highlight: () => (target.kind === 'node' ? highlightNode(target.id) : highlightEdge(target.id)),
  }
}

/** The row's link on the graph as drawn NOW (ids and link ends only), or null when nothing on the canvas stands for it. */
export function canvasLinkOfRow(row: RunDeltaInputRow, opts: { route?: boolean } = {}): CanvasLink | null {
  const { nodes, edges } = useCanvasStore.getState()
  return canvasLinkOfTarget(
    targetOfRow(row, {
      nodes: nodes.map((n) => ({ id: n.id, kind: n.type })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
    opts,
  )
}

/**
 * Hover/keyboard-focus lighting for one surface. `on(link)` lights the element; `off()` clears ONLY a highlight this
 * surface lit; unmount does the same, so a row that disappears while hovered (the detail closing) never leaves the
 * canvas lit.
 */
export function useCanvasLight(): { on: (link: CanvasLink) => void; off: () => void } {
  const lit = useRef(false)
  useEffect(
    () => () => {
      if (lit.current) clearHighlight()
    },
    [],
  )
  return useMemo(
    () => ({
      on: (link: CanvasLink) => {
        link.highlight()
        lit.current = true
      },
      off: () => {
        if (!lit.current) return
        clearHighlight()
        lit.current = false
      },
    }),
    [],
  )
}
