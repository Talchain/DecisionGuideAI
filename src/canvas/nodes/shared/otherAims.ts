/**
 * ⭐ AIMS THE ANALYSIS DOES NOT INCLUDE YET, SHOWN, NEVER HIDDEN (Paul, 21 Oct 2026: his 3PL session lost "reputation" and
 * "refunds" from the canvas; "never hide what Olumi has"). Core analyses ONE goal; every other aim lives only in the saved
 * living model (`graph.living_model.aims`, with the links into it in `living_model.links`). This reader lists each aim whose
 * id is not a node of the graph, in the model's own words, with who it came from and what the model links into it.
 * Read-only: nothing here enters `nodes`/`edges`, a Run or the engine graph.
 */

export type OtherAimSource = 'user' | 'party' | 'olumi' | 'unverified'

export interface OtherAim {
  readonly id: string
  readonly text: string
  readonly source: OtherAimSource
  /** The named person, when the source is `party`. */
  readonly party: string | null
  /** The labels of the items the model links into this aim, in the model's order. */
  readonly linkedFrom: readonly string[]
  /** The model's own status: shown, never filtered out (a withdrawn aim says so). */
  readonly status: 'current' | 'later' | 'withdrawn'
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : [])
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const SOURCES: ReadonlySet<string> = new Set(['user', 'party', 'olumi', 'unverified'])

export function otherAimsOf(graph: unknown): OtherAim[] {
  if (!isRec(graph) || !isRec(graph.living_model)) return []
  const lm = graph.living_model
  const nodes = recs(graph.nodes)
  const onCanvas = new Set(nodes.map((n) => n.id).filter((id): id is string => typeof id === 'string'))
  const labelOf = new Map<string, string>()
  for (const item of [...recs(lm.options), ...recs(lm.factors), ...recs(lm.aims)]) {
    const id = str(item.id); const label = str(item.label) ?? str(item.text)
    if (id && label) labelOf.set(id, label)
  }
  for (const n of nodes) {
    const id = str(n.id); const label = str(n.label) ?? str((n.data as Rec | undefined)?.label)
    if (id && label) labelOf.set(id, label)
  }
  const links = recs(lm.links)
  return recs(lm.aims).flatMap((aim): OtherAim[] => {
    const id = str(aim.id); const text = str(aim.text)
    if (!id || !text || onCanvas.has(id)) return []
    const source = typeof aim.source === 'string' && SOURCES.has(aim.source) ? aim.source as OtherAimSource : 'unverified'
    const linkedFrom = [...new Set(links.filter((l) => l.to === id).map((l) => labelOf.get(String(l.from))).filter((l): l is string => !!l))]
    const status = aim.status === 'later' || aim.status === 'withdrawn' ? aim.status : 'current'
    return [{ id, text, source, party: source === 'party' ? str(aim.party) : null, linkedFrom, status }]
  })
}

/** Who an aim came from, in the canvas's own provenance words. */
export function otherAimSourceWords(aim: Pick<OtherAim, 'source' | 'party'>): string {
  switch (aim.source) {
    case 'user': return 'Yours'
    case 'party': return aim.party ? `From ${aim.party}` : 'From someone you named'
    case 'olumi': return 'Olumi’s'
    default: return 'Source not confirmed'
  }
}

export const OTHER_AIM_COPY = { notInAnalysis: 'Not in this analysis yet', withdrawn: 'Withdrawn', linkedFrom: 'Linked from' } as const

/** The card's status words: an aim the person withdrew says so instead of "not in this analysis yet". */
export function otherAimStatusWords(aim: Pick<OtherAim, 'status'>): string {
  return aim.status === 'withdrawn' ? OTHER_AIM_COPY.withdrawn : OTHER_AIM_COPY.notInAnalysis
}
