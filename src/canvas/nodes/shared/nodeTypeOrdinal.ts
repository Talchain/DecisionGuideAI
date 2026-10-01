/**
 * ⭐ EVERY REPEATED CARD CARRIES A NUMBER WITHIN ITS TYPE (Paul, 1 Oct 2026: "We discussed each node having a number
 * relating to the node type. In this graph, there are four alternatives/options, and therefore there should be four
 * numbers. There are five, so each one of them should be 1 to 5, etc.").
 *
 * - **What gets a number:** options, factors, outcomes and risks are numbered 1…N separately, so four options read
 *   1–4 and five factors read 1–5. The Question and the Goal are single anchors and carry none.
 * - **The order is the reading order:** left to right along the row the layout puts the type on, then top to bottom.
 *   That way "Option 2" is the second option a user sees, not the second one the producer happened to write.
 * - **Ties:** equal positions fall back to the store order, so the numbering is total and stable.
 * - **Display only:** the number is never written into the model, the label, or anything sent to the server.
 */
export const NUMBERED_NODE_KINDS = ['option', 'factor', 'outcome', 'risk'] as const
export type NumberedNodeKind = (typeof NUMBERED_NODE_KINDS)[number]

export interface OrdinalInputNode {
  id: string
  type?: string | null
  position?: { x?: number; y?: number } | null
}

/** Tops within this many flow units of a row's first card are the same row (a card is ≥ 120 units tall). */
export const ROW_TOLERANCE = 60

const isNumberedKind = (t: unknown): t is NumberedNodeKind =>
  typeof t === 'string' && (NUMBERED_NODE_KINDS as readonly string[]).includes(t)

/** id → 1-based number within its own type, for every numbered card. Un-numbered kinds are absent. */
export function nodeTypeOrdinals(nodes: readonly OrdinalInputNode[]): Map<string, number> {
  const byKind = new Map<NumberedNodeKind, { id: string; x: number; y: number; i: number }[]>()
  nodes.forEach((n, i) => {
    if (!isNumberedKind(n.type)) return
    const list = byKind.get(n.type) ?? []
    list.push({ id: n.id, x: Number(n.position?.x ?? 0) || 0, y: Number(n.position?.y ?? 0) || 0, i })
    byKind.set(n.type, list)
  })
  const out = new Map<string, number>()
  for (const list of byKind.values()) {
    // Reading order: rows first, then left to right. Cards whose tops sit within ROW_TOLERANCE of the row's first
    // card are one row, so a card nudged a few units down keeps its place. A wrapped row's second line (≥ one card
    // height lower) reads after the first.
    list.sort((a, b) => a.y - b.y || a.x - b.x || a.i - b.i)
    const rows: (typeof list)[] = []
    for (const n of list) {
      const row = rows[rows.length - 1]
      if (row && n.y - row[0].y <= ROW_TOLERANCE) row.push(n)
      else rows.push([n])
    }
    let k = 0
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x || a.i - b.i)
      for (const n of row) out.set(n.id, ++k)
    }
  }
  return out
}

/**
 * The prefix a card's number wears: the same alphabet as the contract's persisted entity refs (`ENTITY_REF_PATTERN`,
 * schemas 0.67: option O · factor F · outcome OC · risk R). "O2" reads as an identifier, not a rank: a bare "2"
 * beside a title would look like the factors' sensitivity ranks (MT-18).
 */
export const NODE_NUMBER_PREFIX: Readonly<Record<NumberedNodeKind, string>> = Object.freeze({
  option: 'O',
  factor: 'F',
  outcome: 'OC',
  risk: 'R',
})

/**
 * The ONE number a card shows within its type.
 * - **Options:** the store's identity-anchored `optionNumbering`, the number behind the Analysis panel's "Option N"
 *   chip, so the card and the panel can never disagree. An option added since registration continues after the
 *   highest registered number, in reading order, and never reuses one.
 * - **Every other numbered kind:** its reading-order number (`nodeTypeOrdinals`).
 * - **Anything else** (the Question, the Goal) has no number.
 */
export function nodeTypeNumber(
  kind: unknown,
  id: string,
  nodes: readonly OrdinalInputNode[],
  optionNumbering?: Readonly<Record<string, number>> | null,
): number | undefined {
  if (!isNumberedKind(kind)) return undefined
  const registered = kind === 'option' ? optionNumbering ?? {} : {}
  if (kind === 'option' && Object.keys(registered).length > 0) {
    if (registered[id] != null) return registered[id]
    // Append-only, like the registry: never reuse a number, even a deleted option's.
    const max = Math.max(0, ...Object.values(registered))
    const unregistered = nodes.filter((n) => n.type === 'option' && registered[n.id] == null)
    const order = nodeTypeOrdinals(unregistered)
    const k = order.get(id)
    return k === undefined ? undefined : max + k
  }
  return nodeTypeOrdinals(nodes).get(id)
}
