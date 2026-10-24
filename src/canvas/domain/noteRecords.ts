/**
 * ⭐ OLUMI'S NOTES ARE SHOWN ON THE CARD THEY CONCERN (Paul, 24 Oct 2026: the card icon row; DL: identity from the
 * canonical model, source first).
 *
 * The model's display-only records (claims, assumptions, conditions, left-out items, preferences, dissent and evidence) live in the
 * saved graph's `living_model.canonical`; the family is the array the record sits in, never its label. A record is a NOTE
 * when the canvas does not draw it: it is shown as a counted notes glyph on its first concern that is a visible card, or on
 * the question card when none is, so no note's text is lost.
 *
 * Readers before writers: today CEE still projects these records as graph nodes (`model-program/project.ts`, #3709), and a
 * record the canvas draws is never also a note, so nothing is said twice. When CEE stops projecting them, they become notes
 * here with no further UI change. The canvas never hides, lays out or measures anything on this account.
 */
import { create } from 'zustand'
import { useCanvasStore } from '../store'
import { coreSwitchOptionOf } from './coreSwitch'

type Rec = Record<string, unknown>
const rec = (v: unknown): Rec | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null)

export const NOTE_FAMILIES = ['assumptions', 'claims', 'conditions', 'left_out', 'preferences', 'dissent', 'evidence'] as const
export type NoteFamily = (typeof NOTE_FAMILIES)[number]

/** The family's name as the hover reads it. */
export const NOTE_FAMILY_WORDS: Readonly<Record<NoteFamily, string>> = {
  assumptions: 'Assumption',
  claims: 'Claim',
  conditions: 'Condition',
  left_out: 'Left out',
  preferences: 'Preference',
  dissent: 'Disagreement',
  evidence: 'Evidence',
}

export interface NoteRecord {
  readonly id: string
  readonly family: NoteFamily
  /** The record's own words: its text (dissent: holder and position; left out: with why). */
  readonly text: string
  /** Whose words: the person's (from the brief or typed) or Olumi's. */
  readonly author: 'person' | 'olumi' | null
  /** The visible card it is shown on, or null for the question card. */
  readonly anchorId: string | null
}

type CanvasNode = { id: string; type?: string; data?: unknown }

/**
 * Every note for the saved graph, anchored against the cards on the canvas. Empty when the saved graph carries no
 * canonical model (any board not drawn by the model program). A record with no words of its own is not a note.
 */
export function noteRecordsOf(savedGraph: unknown, canvasNodes: readonly CanvasNode[]): ReadonlyMap<string, NoteRecord> {
  const canonical = rec(rec(rec(savedGraph)?.living_model)?.canonical)
  if (!canonical) return new Map()
  const onCanvas = new Set(canvasNodes.map((n) => n.id))
  const labels = new Map(canvasNodes.map((n) => [n.id, str(rec(n.data)?.label)] as const))
  const labelOf = (id: unknown): string | null => (typeof id === 'string' ? labels.get(id) ?? null : null)
  // Core's option switch is kept in the store but never drawn: a note about it is shown on its option (`coreSwitch.ts`).
  const switchOption = coreSwitchOptionOf(canvasNodes)
  const visibleCard = (c: unknown): string | null =>
    typeof c === 'string' && onCanvas.has(c) ? switchOption.get(c) ?? c : null

  const out = new Map<string, NoteRecord>()
  for (const family of NOTE_FAMILIES) {
    const list = Array.isArray(canonical[family]) ? (canonical[family] as unknown[]) : []
    for (const item of list) {
      const r = rec(item)
      const id = r ? str(r.id) : null
      // Drawn as a card already (today's projection): never said twice.
      if (!r || !id || onCanvas.has(id) || out.has(id)) continue
      const own = family === 'dissent' && str(r.holder) && str(r.position) ? `${str(r.holder)}: ${str(r.position)}`
        : family === 'preferences' && !str(r.text) ? preferenceWords(r, labelOf) : str(r.text)
      if (!own) continue
      // The same extra words CEE's projection carries: why it was left out, and where evidence comes from.
      const why = family === 'left_out' && str(r.why) ? ` Why: ${str(r.why)}` : family === 'evidence' && str(r.source) ? ` Source: ${str(r.source)}` : ''
      const concerns = Array.isArray(r.concerns) ? r.concerns : family === 'preferences' && str(r.quantity) ? [r.quantity] : []
      const anchorId = concerns.map(visibleCard).find((c): c is string => c !== null) ?? null
      out.set(id, { id, family, text: `${own}${why}`, author: r.author === 'olumi' ? 'olumi' : r.author === 'person' ? 'person' : null, anchorId })
    }
  }
  return out
}

/**
 * A preference has no text of its own: a direction on a quantity, named by the quantity's card, with the person's words —
 * "Lower Total annual spending (“to save money”)" (CEE's projection: `Preference: <direction> <quantity label>`).
 */
function preferenceWords(r: Rec, labelOf: (id: unknown) => string | null): string | null {
  const quote = str(r.quote)
  const label = labelOf(r.quantity) ?? str(r.quantity)
  const way = str(r.direction)
  const aim = way && label ? `${way.charAt(0).toUpperCase()}${way.slice(1)} ${label}` : null
  return aim && quote ? `${aim} (“${quote}”)` : aim ?? (quote ? `“${quote}”` : null)
}

/** The notes, published per scenario once its saved-graph read answers (`NoteRecordsPublisher`). */
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

/** The notes for the scenario on screen; another scenario's are never shown, even before its own read answers. */
export function useNoteRecords(): ReadonlyMap<string, NoteRecord> {
  const scenarioId = useCanvasStore((s) => s.currentScenarioId ?? null)
  const { scenarioId: of, records } = useNoteRecordsStore()
  return of === scenarioId ? records : EMPTY
}

/** Same record set: used to publish only on a real change. */
export function sameNoteRecords(a: ReadonlyMap<string, NoteRecord>, b: ReadonlyMap<string, NoteRecord>): boolean {
  if (a.size !== b.size) return false
  for (const [id, r] of a) {
    const o = b.get(id)
    if (!o || o.family !== r.family || o.text !== r.text || o.anchorId !== r.anchorId || o.author !== r.author) return false
  }
  return true
}
