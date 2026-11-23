/**
 * WHAT A CARD IS CONNECTED TO, FOR ITS ONE BOX (surfaces step A, 18 Nov): the cards the DRAWN links join it to, by name, each with the shape the board
 * draws it in (`drawKindOf`, from the View; never the canvas node's type, which on the lane is not a kind: the old pop-up listed options under
 * "Driven by" for that reason). An option "Changes" what its links lead to; any other card "Affects" what its links lead to and is "Driven by" the
 * non-option cards whose links lead into it. Reason links (a card explaining a link, evidence for a card) are not listed. Names are core's headings; the headings here and the "+N" are the board's fixed notation words.
 */
import type { ViewCard, ViewModel } from '../../client'
import { drawKindOf } from '../../layout'
import { isDashedCardKind } from '../cards/kind'

export const CONNECTION_WORDS = { changes: 'Changes', affects: 'Affects', drivenBy: 'Driven by' } as const
/** Names drawn per group; the rest are counted. */
export const CONNECTIONS_SHOWN = 3

export type Connected = { readonly id: string; readonly name: string; readonly kind: ReturnType<typeof drawKindOf>; readonly dashed: boolean }
export type ConnectionGroup = { readonly heading: string; readonly items: readonly Connected[]; readonly more: number }
type Drawn = { readonly source: string; readonly target: string; readonly data?: unknown }
/** A drawn link that says one card bears on another. A reason link (a card that explains a link, evidence for a card) is not that, and neither end of one is listed. */
const bears = (e: Drawn): boolean => (e.data as { link?: { kind?: unknown } } | undefined)?.link?.kind !== 'reason'

export function connectionsOf(model: ViewModel, card: ViewCard, edges: readonly Drawn[]): ConnectionGroup[] {
  const byId = new Map(model.cards.map((c) => [c.id, c]))
  const named = (ids: readonly string[], keep: (c: ViewCard) => boolean = () => true): Connected[] => {
    const out: Connected[] = []
    for (const id of new Set(ids)) {
      const c = byId.get(id)
      if (c === undefined || c.id === card.id || c.heading === '' || !keep(c)) continue
      out.push({ id: c.id, name: c.heading, kind: drawKindOf(c, model), dashed: isDashedCardKind(c) })
    }
    return out
  }
  const group = (heading: string, all: Connected[]): ConnectionGroup | null => (all.length === 0 ? null : { heading, items: all.slice(0, CONNECTIONS_SHOWN), more: Math.max(0, all.length - CONNECTIONS_SHOWN) })
  const drawn = edges.filter(bears)
  const to = named(drawn.filter((e) => e.source === card.id).map((e) => e.target), (c) => drawKindOf(c, model) !== 'option')
  if (drawKindOf(card, model) === 'option') return [group(CONNECTION_WORDS.changes, to)].filter((g): g is ConnectionGroup => g !== null)
  const from = named(drawn.filter((e) => e.target === card.id).map((e) => e.source), (c) => drawKindOf(c, model) !== 'option')
  return [group(CONNECTION_WORDS.affects, to), group(CONNECTION_WORDS.drivenBy, from)].filter((g): g is ConnectionGroup => g !== null)
}
