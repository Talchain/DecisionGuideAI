/**
 * ⭐⭐ THE CANVAS DRAWS THE PERSON'S MODEL, NOT THE ENGINE'S PROJECTION (Paul, 22 Oct 2026, approved after his served test:
 * the living model held 2 outcomes and 4 risks with links between them; the canvas, drawing the engine graph, showed the
 * outcomes as plain factors and the risks only as words on the goal card).
 *
 * The saved graph carries both: `living_model` (the AI's model, the one source of meaning) and `nodes`/`edges` (the
 * projection CEE regenerates from it for the maths, which leaves out what it cannot calculate yet). This is the one pure
 * function from the first to what is drawn:
 *  · every engine node stays, with its id, data and position, so results, highlights and lenses still attach;
 *  · a factor the living model calls an outcome is drawn as one (`livingKinds.ts`, which the layout shares);
 *  · a factor, outcome or risk the engine graph leaves out is drawn too, in its row (`placeAddedNodes`, the rule a node
 *    the AI added to a laid-out board already follows), with one line: "Not in the calculation yet";
 *  · a signed link between two drawn items that the engine graph lacks is drawn as a link.
 * ⛔ Display only. Nothing here enters the store, a save, a turn, a Run or a count: an item drawn this way takes no
 * pointer input and cannot be selected, dragged, connected or deleted. Aims stay on the goal card (`otherAims.ts`).
 * ⛔ An unsigned link is not drawn as a link (a link line always shows a direction, and the person's model gives none):
 * `DirectionNeededLayer` already draws it, "Direction needed · <whose>", once both its ends are drawn.
 */
import type { Edge, Node } from '@xyflow/react'

import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../utils/applyDraftResult'
import { canvasEdgePairKey, edgePairKey } from '../utils/graphIdentity'
import { placeAddedNodes } from '../utils/newNodePlacement'
import { withoutCoreSwitches } from './coreSwitch'
import { livingOutcomeIdsOf, withLivingKinds } from './livingKinds'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The UI-only data key on an item drawn from the living model alone. Never on the wire: these items are never saved. */
export const LIVING_ONLY_KEY = 'livingOnly' as const
export interface LivingOnly {
  /** Why the calculation leaves it out, in plain words, where the canvas knows; else null (CEE holds the reason). */
  readonly reason: string | null
}

export const NOT_IN_CALCULATION_COPY = 'Not in the calculation yet'
/** The status pill's identity on a drawn-only card (`BaseNode`), so an assertion binds to this claim. */
export const NOT_IN_CALCULATION_TEST_ID = 'not-in-calculation-pill'
/** A risk with no chance of happening given (the goal card's own reason, `otherAims.ts` before this module). */
export const CHANCE_NEEDED_REASON = 'it needs a chance of happening'

export function livingOnlyOf(data: unknown): LivingOnly | null {
  const v = isRec(data) ? data[LIVING_ONLY_KEY] : undefined
  return isRec(v) ? { reason: str(v.reason) } : null
}

export function notInCalculationWords(item: LivingOnly): string {
  return item.reason === null ? NOT_IN_CALCULATION_COPY : `${NOT_IN_CALCULATION_COPY}: ${item.reason}`
}

/** Display only: no selection, drag, link, delete or pointer route (an inline control would edit an item the engine lacks). */
const INERT = { selectable: false, draggable: false, connectable: false, deletable: false, focusable: false, style: { pointerEvents: 'none' as const } }

/**
 * A risk's chance, as the engine block the risk card already reads (`domain/eventRisk.ts`), only where whose it is cannot
 * be misread: Olumi's estimate (of the chance or its window) is Olumi's, the person's own words are theirs. Another
 * party's or an unverified risk shows no chance here, because the card's only words for a stated chance are "you said".
 */
function eventRiskOf(risk: Rec): Rec | undefined {
  const occurrence = isRec(risk.occurrence) ? risk.occurrence : {}
  const low = num(occurrence.low)
  const high = num(occurrence.high)
  const months = num(risk.horizon_months)
  if (low === null || high === null || months === null) return undefined
  const basis = occurrence.estimate_by === 'olumi' || risk.horizon_by === 'olumi' || risk.source === 'olumi' ? 'olumi'
    : risk.source === 'user' ? 'user' : null
  if (basis === null) return undefined
  return { version: 1, occurrence: { p_low: low, p_high: high, basis }, horizon: { months } }
}

export function drawLivingModel(nodes: Node[], edges: Edge[], graph: unknown): { nodes: Node[]; edges: Edge[] } {
  if (!isRec(graph) || !isRec(graph.living_model)) return { nodes, edges }
  const lm = graph.living_model
  const drawnNodes = withLivingKinds(nodes, livingOutcomeIdsOf(graph))
  const onCanvas = new Set(drawnNodes.map((n) => n.id))

  const added: Node[] = []
  for (const f of recs(lm.factors)) {
    const id = str(f.id); const label = str(f.label)
    if (!id || !label || onCanvas.has(id)) continue
    const node = mapDraftNodeToCanvas({ id, kind: f.kind === 'outcome' ? 'outcome' : 'factor', label })
    added.push({ ...node, ...INERT, data: { ...node.data, [LIVING_ONLY_KEY]: { reason: null } } })
  }
  for (const r of recs(lm.risks)) {
    const id = str(r.id); const label = str(r.label)
    if (!id || !label || onCanvas.has(id)) continue
    const eventRisk = eventRiskOf(r)
    const occurrence = isRec(r.occurrence) ? r.occurrence : {}
    const chanceNeeded = num(occurrence.low) === null && num(occurrence.high) === null
    const node = mapDraftNodeToCanvas({ id, kind: 'risk', label, ...(eventRisk ? { event_risk: eventRisk } : {}) })
    added.push({ ...node, ...INERT, data: { ...node.data, [LIVING_ONLY_KEY]: { reason: chanceNeeded ? CHANCE_NEEDED_REASON : null } } })
  }

  // Placed against the cards as drawn (an option's switch is not drawn, `coreSwitch.ts`).
  const drawnEngine = withoutCoreSwitches(drawnNodes, edges)
  const positions = placeAddedNodes(drawnEngine.nodes, added)
  const placed = added.map((n, i) => ({ ...n, position: positions[i]! }))
  for (const n of placed) onCanvas.add(n.id)

  const pairs = new Set(drawnEngine.edges.map((e) => canvasEdgePairKey(e)).filter((k): k is string => k !== null))
  const edgeIds = new Set(edges.map((e) => e.id))
  const addedEdges: Edge[] = []
  for (const l of recs(lm.links)) {
    const id = str(l.id); const from = str(l.from); const to = str(l.to)
    const sign = isRec(l.effect) ? l.effect.sign : null
    if (!id || !from || !to || (sign !== '+' && sign !== '-')) continue
    if (!onCanvas.has(from) || !onCanvas.has(to) || pairs.has(edgePairKey(from, to)) || edgeIds.has(id)) continue
    pairs.add(edgePairKey(from, to))
    const edge = mapDraftEdgeToCanvas({ id, from, to, effect_direction: sign === '+' ? 'positive' : 'negative' }, addedEdges.length)
    addedEdges.push({ ...edge, selectable: false, focusable: false, deletable: false, interactionWidth: 0,
      data: { ...edge.data, [LIVING_ONLY_KEY]: { reason: null } } })
  }

  if (placed.length === 0 && addedEdges.length === 0 && drawnNodes === nodes) return { nodes, edges }
  return { nodes: [...drawnNodes, ...placed], edges: addedEdges.length === 0 ? edges : [...edges, ...addedEdges] }
}
