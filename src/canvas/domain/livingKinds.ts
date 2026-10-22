/**
 * ⭐ THE PERSON'S MODEL SAYS WHICH FACTORS ARE OUTCOMES (Paul's served test, 22 Oct 2026: "why did the AI produce no
 * outcomes?" It had: two, in the living model). A living-model factor of `kind: 'outcome'` stays a factor in the engine
 * graph CEE derives for the maths unless the goal has a level today (CEE mapper). The canvas draws the person's model,
 * so that factor is drawn AND laid out as an outcome. Same id and same data, so results, highlights and lenses attach;
 * only the card and its row change. The store keeps the engine's kind: this is the drawing, never a save or a send.
 * ⛔ Zero imports: `layoutGraph` reads this, and the store reaches the layout through a static import chain.
 */
type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)

const NONE: ReadonlySet<string> = new Set()

/** The living model's factor ids whose kind is `outcome`; empty without a living model. */
export function livingOutcomeIdsOf(graph: unknown): ReadonlySet<string> {
  if (!isRec(graph) || !isRec(graph.living_model) || !Array.isArray(graph.living_model.factors)) return NONE
  const ids = graph.living_model.factors.flatMap((f) => (isRec(f) && f.kind === 'outcome' && typeof f.id === 'string' ? [f.id] : []))
  return ids.length === 0 ? NONE : new Set(ids)
}

/** The engine's factor cards drawn as the outcomes the living model says they are. Input returned when nothing changes. */
export function withLivingKinds<N extends { id: string; type?: string }>(nodes: readonly N[], outcomeIds: ReadonlySet<string>): N[] {
  if (outcomeIds.size === 0 || !nodes.some((n) => n.type === 'factor' && outcomeIds.has(n.id))) return nodes as N[]
  return nodes.map((n) => (n.type === 'factor' && outcomeIds.has(n.id) ? { ...n, type: 'outcome' } : n))
}

/**
 * The outcome ids for the scenario on screen, published by the canvas (`useDrawnLivingModel`) so the store's layout
 * lays them out in the consequence row. Another scenario's ids are never returned.
 */
let published: { scenarioId: string | null; ids: ReadonlySet<string> } = { scenarioId: null, ids: NONE }
export function publishLivingOutcomeIds(scenarioId: string | null, ids: ReadonlySet<string>): void {
  published = { scenarioId, ids }
}
export function livingOutcomeIdsFor(scenarioId: string | null): ReadonlySet<string> {
  return scenarioId !== null && published.scenarioId === scenarioId ? published.ids : NONE
}

/**
 * The items drawn from the living model alone, for the scenario on screen (`useDrawnLivingModel`). They arrive with the
 * saved-graph read, after the landing or restore fit framed the engine's cards, so the camera frames them once more
 * when they first appear (`useFitViewOnLayoutVersion`). '' while there are none.
 */
let drawnOnly = ''
const drawnOnlyListeners = new Set<() => void>()
export function publishDrawnOnlyKey(key: string): void {
  if (key === drawnOnly) return
  drawnOnly = key
  for (const listener of drawnOnlyListeners) listener()
}
export const drawnOnlyKey = (): string => drawnOnly
export function subscribeDrawnOnly(listener: () => void): () => void {
  drawnOnlyListeners.add(listener)
  return () => { drawnOnlyListeners.delete(listener) }
}
