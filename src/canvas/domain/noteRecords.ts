/**
 * ⭐ OLUMI'S NOTES ARE NOT MODEL CARDS (Paul, 24 Oct 2026: the card icon row; DL: identity from the canonical model).
 *
 * The model program saves its display-only records (claims, assumptions, left-out items, preferences, dissent and
 * evidence) as graph nodes of kind `action`, with no links (CEE #3709). The canvas drew each as a full card with the
 * legacy action shape. A node is a NOTE when its id equals a record id in one of those families of the saved graph's
 * `living_model.canonical`; the family is the array the record sits in, never its label. A note is kept in the store,
 * like core's option switch (`coreSwitch.ts`), but never drawn, laid out, measured or fitted. It is shown as a counted
 * notes glyph on the card it concerns: its first concern that is a drawn card. A note that concerns no drawn card is
 * shown in the board's notes place, so no note's text is lost.
 *
 * Limits without a figure are projected under a derived id (`mp:limit:<id>`); they stay as they render today (DL ruling:
 * the UI never rebuilds CEE's id convention).
 */
import { create } from 'zustand'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null)

export const NOTE_FAMILIES = ['assumptions', 'claims', 'left_out', 'preferences', 'dissent', 'evidence'] as const
export type NoteFamily = (typeof NOTE_FAMILIES)[number]

/** The family's name as the hover reads it. */
export const NOTE_FAMILY_WORDS: Readonly<Record<NoteFamily, string>> = {
  assumptions: 'Assumption',
  claims: 'Claim',
  left_out: 'Left out',
  preferences: 'Preference',
  dissent: 'Disagreement',
  evidence: 'Evidence',
}

export interface NoteRecord {
  readonly id: string
  readonly family: NoteFamily
  /** The record's own words: its text (dissent: holder and position), else the saved node's description. */
  readonly text: string
  /** Whose words: the person's (from the brief or typed) or Olumi's. */
  readonly author: 'person' | 'olumi' | null
  /** The drawn card it is shown on, or null for the board's notes place. */
  readonly anchorId: string | null
}

/**
 * Every note on the saved graph, keyed by node id, anchored against the ids of the cards on the canvas.
 * Empty when the saved graph carries no canonical model (any board not drawn by the model program).
 */
export function noteRecordsOf(savedGraph: unknown, canvasNodeIds: ReadonlySet<string>): ReadonlyMap<string, NoteRecord> {
  const g = rec(savedGraph)
  const canonical = rec(rec(g?.living_model)?.canonical)
  if (!canonical) return new Map()
  const savedNodes = Array.isArray(g?.nodes) ? (g.nodes as unknown[]).map(rec).filter((n): n is Rec => n !== null) : []
  const savedNodeIds = new Set(savedNodes.map((n) => n.id).filter((id): id is string => typeof id === 'string'))
  const descriptionOf = new Map(savedNodes.map((n) => [n.id, str(n.description)] as const))

  const found: Array<{ id: string; family: NoteFamily; rec: Rec }> = []
  for (const family of NOTE_FAMILIES) {
    const list = Array.isArray(canonical[family]) ? (canonical[family] as unknown[]) : []
    for (const item of list) {
      const r = rec(item)
      const id = r ? str(r.id) : null
      // A note is a saved graph node with exactly the record's id.
      if (r && id && savedNodeIds.has(id)) found.push({ id, family, rec: r })
    }
  }
  const noteIds = new Set(found.map((f) => f.id))
  const out = new Map<string, NoteRecord>()
  for (const { id, family, rec: r } of found) {
    const concerns = Array.isArray(r.concerns) ? r.concerns : family === 'preferences' && str(r.quantity) ? [r.quantity] : []
    const anchorId = concerns.find((c): c is string => typeof c === 'string' && canvasNodeIds.has(c) && !noteIds.has(c)) ?? null
    const own = family === 'dissent' && str(r.holder) && str(r.position) ? `${str(r.holder)}: ${str(r.position)}` : str(r.text)
    const extra = family === 'left_out' && str(r.why) ? ` Why: ${str(r.why)}` : ''
    const text = own ? `${own}${extra}` : descriptionOf.get(id) ?? id
    out.set(id, { id, family, text, author: r.author === 'olumi' ? 'olumi' : r.author === 'person' ? 'person' : null, anchorId })
  }
  return out
}

/** The notes for the scenario on screen, published once the saved-graph read answers (`NoteRecordsPublisher`). */
interface NoteRecordsState {
  scenarioId: string | null
  records: ReadonlyMap<string, NoteRecord>
  publish: (scenarioId: string | null, records: ReadonlyMap<string, NoteRecord>) => void
}
const EMPTY: ReadonlyMap<string, NoteRecord> = new Map()
export const useNoteRecordsStore = create<NoteRecordsState>()((set) => ({
  scenarioId: null,
  records: EMPTY,
  publish: (scenarioId, records) => set({ scenarioId, records }),
}))

/**
 * The note ids on screen now, for non-hook readers (layout, measure gate, fit, the drawn-node filter). The publisher
 * replaces the set whenever the scenario or its saved graph changes, so it never holds another scenario's notes.
 * Deliberately store-free: `utils/layout.ts` is imported by the canvas store.
 */
export function currentNoteIds(): ReadonlySet<string> {
  return new Set(useNoteRecordsStore.getState().records.keys())
}

/** The model as drawn: no note cards (they have no links; any link touching one is dropped with it). */
export function withoutNotes<N extends { id: string }, E extends { source: string; target: string }>(
  nodes: readonly N[], edges: readonly E[],
): { nodes: N[]; edges: E[]; hidden: N[] } {
  const notes = currentNoteIds()
  if (notes.size === 0) return { nodes: [...nodes], edges: [...edges], hidden: [] }
  return {
    nodes: nodes.filter((n) => !notes.has(n.id)),
    edges: edges.filter((e) => !notes.has(e.source) && !notes.has(e.target)),
    hidden: nodes.filter((n) => notes.has(n.id)),
  }
}

/** Same record set, ignoring order and anchors' identity: used to publish only on a real change. */
export function sameNoteRecords(a: ReadonlyMap<string, NoteRecord>, b: ReadonlyMap<string, NoteRecord>): boolean {
  if (a.size !== b.size) return false
  for (const [id, r] of a) {
    const o = b.get(id)
    if (!o || o.family !== r.family || o.text !== r.text || o.anchorId !== r.anchorId || o.author !== r.author) return false
  }
  return true
}
