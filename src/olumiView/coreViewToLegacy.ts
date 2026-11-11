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
import type { ViewCard, ViewModel } from './client'
import { allOptionCards, drawKindOf, drawnModelOf, QUESTION } from './layout'
import { useViewStore } from './store'

/** The previous canvas's node kinds a View card is drawn as: the lane's own rule (layout.ts drawKindOf), unchanged. */
type LegacyKind = 'decision' | ReturnType<typeof drawKindOf>
/** What this adapter fills of the previous node's data (canvas/domain/nodes.ts): only slots core's View states. */
export type LegacyNodeData = {
  /** `NodeData.label`: the card's heading, core's words, verbatim. */
  label: string
  kind: LegacyKind
  type: LegacyKind
  /** `NodeData.provenance`: 'ai_inferred' where core says the card is Olumi's (`author.by === 'olumi'`). A person's card is left unset: the
   *  previous card tells 'from_brief' from 'user_set', and core's View says only 'person'. */
  provenance?: 'ai_inferred'
  /** `FactorNodeData.display_value`: a figure card's own figure text, core's words, verbatim; unset for a per-option card or no figure. */
  display_value?: string
}
/** What this adapter fills of the previous edge's data (canvas/domain/edges.ts): how a link is drawn, and core's own words for it. */
export type LegacyEdgeData = {
  style: typeof DEFAULT_EDGE_DATA.style; curvature: number; schemaVersion: typeof DEFAULT_EDGE_DATA.schemaVersion; pathType: 'bezier'
  /** `EdgeData.label`: core's effect words for the link (`effect.text`), else its `label`; unset when core gives neither. */
  label?: string
}

/** Previous slots core's View cannot fill today; each is left empty, never defaulted. */
export const UNFILLED = [
  'edge.weight / beliefStrength (link strength): core states an effect range in words for some links, a strength for none',
  'edge.direction / effect_direction (the + or - on a link): core states no sign',
  'edge.beliefExists / exists_probability / confidence',
  'option.interventions (what each option changes, per factor, as numbers): the previous option card then reads "No changes specified"',
  'factor.observedState (value, baseline, unit as numbers), prior, category, controllability',
  'goal threshold as a number (goalThreshold); core sends the aim as words (aim.text) and a bound card',
  'risk.probability / impact as numbers',
  'decision -> option links: the previous graph roots every option at the question; core draws none',
  'node.provenance for a person\'s card (from_brief or user_set)',
] as const
/** Core fields the previous card or link has no place for; not drawn by this spike. */
export const UNPLACED = [
  'card.figure.text on any card that is not a factor (an aim\'s bound, an option\'s headline chance, an outcome\'s per-option values)',
  'card.values[] (each option\'s worked-out range on an outcome), card.rows (chance rows), card.headline, card.driver',
  'card.author (whose words, with their quote), card.olumi (Olumi\'s reason), card.face (the person\'s own wording as the title)',
  'card.change / link.proposed (a held proposal\'s additions), card.doubt / link.doubt (dashed: core doubts it), card.challenged, card.focus',
  'card.badge (the notes behind a card), card.premises, card.rests_on, card.unused, card.reason, card.status (an option ruled out)',
  'link.title (what the link means: "measured by", "bound", "target", "may change"), link.kind (plain, through, reason), link.alert',
  'families the previous product has no kind for: limit (drawn as its constraint), assumption, condition, relation, left_out (drawn as factors)',
] as const

const nodeOf = (id: string, kind: LegacyKind, label: string, rest: Partial<LegacyNodeData> = {}): Node<LegacyNodeData> =>
  ({ id, type: kind, position: { x: 0, y: 0 }, data: { label, kind, type: kind, ...rest } })

const cardNode = (c: ViewCard, model: ViewModel): Node<LegacyNodeData> => {
  const kind = drawKindOf(c, model)
  const figure = kind === 'factor' && c.figure !== null && c.figure.text !== '' && (c.values?.length ?? 0) < 2 ? c.figure.text : undefined
  return nodeOf(c.id, kind, c.heading, {
    ...(c.author?.by === 'olumi' ? { provenance: 'ai_inferred' as const } : {}),
    ...(figure === undefined ? {} : { display_value: figure }),
  })
}

/** Core's model as the previous canvas's nodes and edges. Positions are left to the previous layout (the canvas lays out what it measures). */
/**
 * NOT ON BY DEFAULT (`?previous-canvas=rooted`, for one labelled shot): the previous graph roots every option at the question, and its
 * question card reads "No options linked yet" without those links. Core states that a card is an option of this question (`family:
 * 'option'`) and draws no such link. Whether drawing that statement as the previous root link is mapping or inventing is the DL's ruling.
 */
export const rootedSpike = (): boolean => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('previous-canvas') === 'rooted'

export function legacyGraphOf(whole: ViewModel, rooted = false): { nodes: Node<LegacyNodeData>[]; edges: Edge<LegacyEdgeData>[] } {
  const model = drawnModelOf(whole)
  const nodes = [nodeOf(QUESTION, 'decision', model.question.text), ...model.cards.map((c) => cardNode(c, model))]
  const ids = new Set(nodes.map((n) => n.id))
  const edges = model.links.flatMap((l, i): Edge<LegacyEdgeData>[] => {
    if (!ids.has(l.from) || !ids.has(l.to)) return []
    const words = l.effect?.text ?? (l.label === '' ? undefined : l.label)
    return [{ id: `l${i}`, source: l.from, target: l.to, type: 'styled',
      data: { style: DEFAULT_EDGE_DATA.style, curvature: DEFAULT_EDGE_DATA.curvature, schemaVersion: DEFAULT_EDGE_DATA.schemaVersion, pathType: 'bezier', ...(words === undefined ? {} : { label: words }) } }]
  })
  const drawn = { style: DEFAULT_EDGE_DATA.style, curvature: DEFAULT_EDGE_DATA.curvature, schemaVersion: DEFAULT_EDGE_DATA.schemaVersion, pathType: 'bezier' as const }
  const roots = rooted ? allOptionCards(model).map((c): Edge<LegacyEdgeData> => ({ id: `root:${c.id}`, source: QUESTION, target: c.id, type: 'styled', data: drawn })) : []
  return { nodes, edges: [...roots, ...edges] }
}

/** On the spike, the previous canvas follows the View: each View that lands is put on it as the previous product's own graph. */
export function usePreviousCanvas(on: boolean): void {
  const view = useViewStore((s) => s.view)
  useEffect(() => {
    if (!on) return
    const store = useCanvasStore.getState()
    const { nodes, edges } = view?.model == null ? { nodes: [], edges: [] } : legacyGraphOf(view.model, rootedSpike())
    store.beginExternalGraphMutation?.('hydrate', { suppressHistory: true })
    try { useCanvasStore.setState({ nodes: nodes as never, edges: edges as never }) } finally { useCanvasStore.getState().endExternalGraphMutation?.() }
    if (nodes.length > 0) useCanvasStore.getState().setPendingLayout(true)
  }, [on, view])
}
