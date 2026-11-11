/**
 * SPIKE (UI restore, 11 Nov 2026; Paul: "having the previous UI but plugged into the alpha data model"). THE ONE ADAPTER from core's View
 * (olumi.view/3) to the previous product's canvas: each View card as the previous canvas's own typed node, each View link as its own typed
 * edge. Read-only: nothing here writes to core.
 *
 * THE RULE (Codex partner's ruling, handover-20261110/reasoning-tab.md section 5): this file may MAP and CARRY. It never imitates the old
 * backend's payload (no draft-graph envelope, no applyDraftResult), never invents a value and never works anything out twice. A previous
 * slot core does not fill is left EMPTY and named in `UNFILLED`; a core field the previous card has no place for is named in `UNPLACED`.
 * Both lists are the spike's finding, read by its report.
 */
import { useEffect } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { useCanvasStore } from '../canvas/store'
import { DEFAULT_EDGE_DATA } from '../canvas/domain/edges'
import type { ViewModel } from './client'
import { allOptionCards, cardLinks, drawKindOf, drawnModelOf, QUESTION } from './layout'
import { VIEW_LINK } from './canvas'
import { useViewStore } from './store'

/** The previous canvas's node kinds a View card is drawn as: the lane's own rule (layout.ts drawKindOf), unchanged. */
type LegacyKind = 'decision' | ReturnType<typeof drawKindOf>
/**
 * What this adapter states on a previous-canvas node (canvas/domain/nodes.ts): which kind of card it is, its heading, and that it is
 * core's. Nothing else: the card's body is drawn from the View card itself (previous/CoreCard.tsx), so no previous value slot is filled
 * here and none is defaulted.
 */
export type LegacyNodeData = {
  /** `NodeData.label`: the card's heading, core's words, verbatim. */
  label: string
  kind: LegacyKind
  type: LegacyKind
  /** A core card: the previous frame says nothing of its own about it, and no previous editor opens on it. */
  core: true
  /** The row the previous layout places it in, where core's kind differs from the previous one of the same name (LIMIT_TIER). */
  layoutTier?: number
}
/**
 * RULING 2 (limits): core's limit is an aim the figures are measured against ("measured by" and "bound" links arrive at it), so it
 * stands in its own row between the consequences and the goal. The previous layout's own `constraint` is an input beside the factors
 * (TIER_BY_KIND tier 2), a different thing with the same name: placed there, the link from the figure that measures it runs UP the board.
 */
export const LIMIT_TIER = 4

const nodeOf = (id: string, kind: LegacyKind, label: string, rest: Partial<LegacyNodeData> = {}): Node<LegacyNodeData> =>
  ({ id, type: kind, position: { x: 0, y: 0 }, data: { label, kind, type: kind, core: true, ...rest } })

/** RULING 1 (root links), off only for the contrast shot (`?previous-canvas=unrooted`). */
export const unrootedSpike = (): boolean => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('previous-canvas') === 'unrooted'

/**
 * Core's model as the previous canvas's nodes and edges. Positions are left to the previous layout (the canvas lays out what it measures).
 * Links are the lane's own link edge (`viewLink`, registered on the previous canvas): core's words on the link, dashed only where core
 * doubts it or it is proposed (RULING 6). RULING 1: core states that a card is an option of this question (`family: 'option'`); the
 * previous graph draws that statement as a plain link from the question to each option, with no strength, sign or belief.
 */
export function legacyGraphOf(whole: ViewModel, rooted = true): { nodes: Node<LegacyNodeData>[]; edges: Edge[] } {
  const model = drawnModelOf(whole)
  const nodes = [nodeOf(QUESTION, 'decision', model.question.text), ...model.cards.map((c) => { const kind = drawKindOf(c, model); return nodeOf(c.id, kind, c.heading, kind === 'constraint' ? { layoutTier: LIMIT_TIER } : {}) })]
  const edges = cardLinks(model).map(({ link, i }): Edge => ({ id: `${link.from}->${link.to}:${link.kind}`, source: link.from, target: link.to, type: VIEW_LINK, data: { link, i }, ariaLabel: link.title }))
  const drawn = { style: DEFAULT_EDGE_DATA.style, curvature: DEFAULT_EDGE_DATA.curvature, schemaVersion: DEFAULT_EDGE_DATA.schemaVersion, pathType: 'bezier' as const }
  const roots = rooted ? allOptionCards(model).map((c): Edge => ({ id: `root:${c.id}`, source: QUESTION, target: c.id, type: 'styled', data: drawn })) : []
  return { nodes, edges: [...roots, ...edges] }
}

/** On the spike, the previous canvas follows the View: each View that lands is put on it as the previous product's own graph. */
export function usePreviousCanvas(on: boolean): void {
  const view = useViewStore((s) => s.view)
  useEffect(() => {
    if (!on) return
    const store = useCanvasStore.getState()
    const { nodes, edges } = view?.model == null ? { nodes: [], edges: [] } : legacyGraphOf(view.model, !unrootedSpike())
    store.beginExternalGraphMutation?.('hydrate', { suppressHistory: true })
    try { useCanvasStore.setState({ nodes: nodes as never, edges: edges as never }) } finally { useCanvasStore.getState().endExternalGraphMutation?.() }
    if (nodes.length > 0) useCanvasStore.getState().setPendingLayout(true)
  }, [on, view])
}
