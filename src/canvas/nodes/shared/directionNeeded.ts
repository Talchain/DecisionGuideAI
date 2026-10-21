/**
 * ⭐ A LINK WHOSE DIRECTION NOBODY GAVE IS SHOWN, NEVER LOST (DL, buddy BLOCK A2, 21 Oct 2026: the canvas shows the AI's model;
 * only the engine filters). Core's mapper leaves a living-model link with no sign out of the engine graph (mapper.ts:453,
 * `link_sign_unknown`), so it vanished from the canvas. This reader lists each such link whose two ends are cards on the
 * canvas and that no drawn edge already joins, with who stated it. Display only: never an edge, a Run or the engine graph.
 */
import type { OtherAimSource } from './otherAims'

export interface DirectionNeededLink {
  readonly id: string
  readonly from: string
  readonly to: string
  readonly source: OtherAimSource
  readonly party: string | null
  /** A drawn edge already runs the other way between these two cards: a different claim, drawn beside it, not on it. */
  readonly besideReverse: boolean
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)
const SOURCES: ReadonlySet<string> = new Set(['user', 'party', 'olumi', 'unverified'])

export function directionNeededLinksOf(
  graph: unknown, onCanvas: ReadonlySet<string>, drawn: ReadonlySet<string>,
): DirectionNeededLink[] {
  if (!isRec(graph) || !isRec(graph.living_model) || !Array.isArray(graph.living_model.links)) return []
  return graph.living_model.links.filter(isRec).flatMap((l): DirectionNeededLink[] => {
    const effect = isRec(l.effect) ? l.effect : {}
    const { id, from, to } = l
    if (effect.sign != null || typeof id !== 'string' || typeof from !== 'string' || typeof to !== 'string') return []
    // The same claim already drawn is not drawn again. One the other way round is a DIFFERENT claim (buddy on #2886): drawn.
    if (!onCanvas.has(from) || !onCanvas.has(to) || drawn.has(`${from}->${to}`)) return []
    const source = typeof l.source === 'string' && SOURCES.has(l.source) ? l.source as OtherAimSource : 'unverified'
    return [{ id, from, to, source, party: source === 'party' && typeof l.party === 'string' ? l.party : null, besideReverse: drawn.has(`${to}->${from}`) }]
  })
}

export const DIRECTION_NEEDED = 'Direction needed'
