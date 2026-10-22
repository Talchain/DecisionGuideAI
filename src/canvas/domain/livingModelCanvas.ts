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
 * ⛔ Display only. Nothing here enters the store, a save, a turn, a Run or a count: an item drawn this way cannot be
 * selected, dragged, connected, deleted or edited; hovering it shows its read-only details. Aims stay on the goal card
 * (`otherAims.ts`).
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

/**
 * CEE's reason for leaving an item out (the graph read's `withheld`, CEE #3657: the mapper's own codes), in plain words.
 * A code not listed here gives no reason rather than a guessed one; the status line still says the item is left out.
 */
export const WITHHELD_REASON_WORDS: Readonly<Record<string, string>> = {
  risk_occurrence_unknown: 'its chance or its time window isn’t set yet',
  risk_unattributed: 'it isn’t clear whose estimate its chance is',
  risk_not_in_slice: 'a risk like this can’t be calculated yet',
  risk_window_not_goal_window: 'its time window differs from the goal’s',
  factor_level_unknown: 'its level today isn’t set yet',
  level_range_not_in_slice: 'its range can’t be calculated yet',
  limit_not_in_slice: 'its limit can’t be calculated yet',
  identity_not_in_slice: 'how it is defined can’t be calculated yet',
  identity_part_unknown: 'a part of how it is defined has no figure yet',
  identity_unit_mismatch: 'the parts of how it is defined are in different units',
  identity_inconsistent: 'how it is defined doesn’t add up',
}

/**
 * Why the item is left out: CEE's own reason where the read carries the list; before CEE served one, the goal card's
 * rule for a risk (no chance given). A list with no entry for the item gives no reason.
 */
function reasonFor(graph: Rec, id: string, fallback: string | null): string | null {
  if (!Array.isArray(graph.withheld)) return fallback
  const held = recs(graph.withheld).find((w) => w.id === id)
  return held !== undefined && typeof held.reason === 'string' ? WITHHELD_REASON_WORDS[held.reason] ?? null : null
}

export function livingOnlyOf(data: unknown): LivingOnly | null {
  const v = isRec(data) ? data[LIVING_ONLY_KEY] : undefined
  return isRec(v) ? { reason: str(v.reason) } : null
}

export function notInCalculationWords(item: LivingOnly): string {
  return item.reason === null ? NOT_IN_CALCULATION_COPY : `${NOT_IN_CALCULATION_COPY}: ${item.reason}`
}

/**
 * Display only: no selection, drag, link or delete. The card still answers a hover with its read-only details card. It
 * mounts no edit control (`BaseNode`, `FactorNode`), and the canvas's click, double-click and menu routes skip it
 * (`ReactFlowGraph`), because each one would edit an item the engine lacks.
 */
const INERT = { selectable: false, draggable: false, connectable: false, deletable: false, focusable: false }

/**
 * A risk's chance, as the engine block the risk card already reads (`domain/eventRisk.ts`), only where whose it is cannot
 * be misread. ⛔ The chance's author comes from the chance alone, never from its window (DL, 22 Oct, #2921): Olumi's
 * where Olumi estimated it, or where Olumi raised the risk and nobody gave the figure; the person's where they raised it.
 * The person's chance over Olumi's window shows no chance, because the card names one author for both. Another party's
 * or an unverified chance shows none either: the card's only words for a stated chance are "you said".
 */
function eventRiskOf(risk: Rec): Rec | undefined {
  const occurrence = isRec(risk.occurrence) ? risk.occurrence : {}
  const low = num(occurrence.low)
  const high = num(occurrence.high)
  const months = num(risk.horizon_months)
  if (low === null || high === null || months === null) return undefined
  const estimateBy = occurrence.estimate_by ?? null
  const basis = estimateBy === 'olumi' || (estimateBy === null && risk.source === 'olumi') ? 'olumi'
    : risk.source === 'user' ? 'user' : null
  if (basis === null || (basis === 'user' && risk.horizon_by === 'olumi')) return undefined
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
    added.push({ ...node, ...INERT, data: { ...node.data, [LIVING_ONLY_KEY]: { reason: reasonFor(graph, id, null) } } })
  }
  for (const r of recs(lm.risks)) {
    const id = str(r.id); const label = str(r.label)
    if (!id || !label || onCanvas.has(id)) continue
    const eventRisk = eventRiskOf(r)
    const occurrence = isRec(r.occurrence) ? r.occurrence : {}
    const chanceNeeded = num(occurrence.low) === null && num(occurrence.high) === null
    const node = mapDraftNodeToCanvas({ id, kind: 'risk', label, ...(eventRisk ? { event_risk: eventRisk } : {}) })
    const reason = reasonFor(graph, id, chanceNeeded ? CHANCE_NEEDED_REASON : null)
    added.push({ ...node, ...INERT, data: { ...node.data, [LIVING_ONLY_KEY]: { reason } } })
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
