/**
 * "Show in the workspace": which cards an Olumi reply is about, and what must be unfolded before they can be seen. Pure: it reads the
 * reader's CURRENT View and what they have open, and nothing else. It never reads another member's View and never remembers an earlier one.
 *
 * The reply's ids are core's own (`answer.next.at`, then `answer.next.about`), each once, in core's order. For each id, the first rule
 * that matches:
 *   1. a card the board draws                         → that card
 *   2. a card Simple holds in the folded inputs       → that card, once the inputs are opened
 *   3. a relation card the board draws as a link      → the two cards that link joins (read as `linkCards` reads them)
 *   4. a record a badge holds
 *      a. behind a badge that is already open         → the card (or the question) whose badge it is
 *      b. behind closed badges only                   → ONE badge is opened, chosen by the rule below; the id is resolved again after
 *   5. anything else                                  → nothing, and no trace of it
 *
 * Rule 5 is the stale id, the record the board never draws, and anything core does not send THIS reader. The three are not told apart
 * and none is counted, named or hinted at: an id that is not in the reader's View does not exist here.
 *
 * SEVERAL BADGES HOLD THE SAME RECORD (4b). The badges to open are a fixed greedy cover of the ids still behind closed badges:
 *   - the badge that holds the most of those ids;
 *   - on a tie, the badge that holds the fewest records in all (the least is unfolded);
 *   - on a tie, the first in the View's order (the question, then its cards).
 * It is repeated until every such id has a badge. Never "the first badge found".
 *
 * AFTER UNFOLDING the caller resolves again on the View core then sends: a record that has become a card is its own target (rule 1), one
 * still inside an open badge is its host (4a). A second pass that still asks for a badge means the unfolding did not land: the caller
 * stops there and says so, it does not loop.
 */
import { QUESTION, drawnModelOf, inputIdsOf, inputsFolded, layerEntries, linkCards, marksOf, type LayerId, type View, type ViewModel, type ViewTurn } from './deps'

export type Next = NonNullable<ViewTurn['answer']>['next']

/** What the person has on screen that decides whether a card is drawn: the scenario, its level, and the inputs they have opened (foldStore's record). */
export interface BoardNow {
  readonly sid: string | null
  readonly level: 'simple' | 'working'
  readonly inputsOpen: Readonly<Record<string, boolean>>
}

/** A badge to open: the node whose badge it is (a card's id, or the question's) and the records the View says it holds, exactly as handed out. */
export interface BadgeToOpen { readonly host: string; readonly records: readonly string[] }

export interface ShowPlan {
  /** The nodes to bring into view, each once, in core's order. With `open` or `inputs` pending, these are the hosts and cards as they stand now. */
  readonly cards: readonly string[]
  /** Closed badges to open first (rule 4b). Empty when nothing is behind a closed badge. */
  readonly open: readonly BadgeToOpen[]
  /** Simple's folded inputs must be opened first (rule 2). */
  readonly inputs: boolean
}

interface Host { readonly id: string; readonly records: readonly string[]; readonly open: boolean; readonly at: number }

/** Every badge in the View, in the View's order: the question's, then each card's. */
function hostsOf(model: ViewModel): Host[] {
  const out: Host[] = []
  const q = model.question.badge
  if (q != null) out.push({ id: QUESTION, records: q.records, open: q.open, at: 0 })
  model.cards.forEach((c, i) => { if (c.badge != null) out.push({ id: c.id, records: c.badge.records, open: c.badge.open, at: i + 1 }) })
  return out
}

/** The two cards a relation-as-link joins: the ends of its two reason links, as `linkCards` reads them. */
const endsOf = (model: ViewModel, relation: string): string[] => model.links.filter((l) => l.kind === 'reason' && l.from === relation).map((l) => l.to)

/**
 * The plan for one reply against the View now: null when nothing it names can be shown to this reader (no control is drawn then).
 * `next` null is a turn core has not answered.
 */
export function planShow(view: View | null, next: Next | null, board: BoardNow): ShowPlan | null {
  const model = view?.model ?? null
  if (view === null || model === null || next === null) return null
  const ids = [...new Set([...(next.at == null ? [] : [next.at]), ...next.about])]
  if (ids.length === 0) return null

  const drawn = drawnModelOf(model)
  const onBoard = new Set(drawn.cards.map((c) => c.id))
  const asLinks = linkCards(model)
  const folded = board.level === 'simple' && inputsFolded(board.sid, drawn, board.inputsOpen)
  const foldedInputs = folded ? new Set(inputIdsOf(drawn)) : new Set<string>()
  const hosts = hostsOf(model)

  const cards: string[] = []
  let inputs = false
  /** A node the board draws (or will, once the inputs are opened): rules 1 and 2. False for anything else. */
  const take = (id: string): boolean => {
    if (id !== QUESTION && !onBoard.has(id)) return false
    if (foldedInputs.has(id)) inputs = true
    if (!cards.includes(id)) cards.push(id)
    return true
  }

  /** Ids behind closed badges only (4b). Each holds its place in `cards` with a placeholder until its badge is chosen. */
  const behind: string[] = []
  for (const id of ids) {
    if (asLinks.has(id)) { for (const end of endsOf(model, id)) take(end); continue } // rule 3
    if (take(id)) continue // rules 1, 2
    const holding = hosts.filter((h) => h.records.includes(id))
    if (holding.length === 0) continue // rule 5: not in this reader's View
    const opened = holding.find((h) => h.open)
    if (opened !== undefined) { take(opened.id); continue } // rule 4a
    behind.push(id)
    cards.push(`\u0000${id}`) // a placeholder, so the chosen host keeps core's order; replaced below
  }

  // Rule 4b: the fixed greedy cover.
  const open: BadgeToOpen[] = []
  const hostOf = new Map<string, string>()
  let left = [...behind]
  while (left.length > 0) {
    let best: Host | null = null, bestHeld = 0
    for (const h of hosts) {
      if (h.open) continue
      const held = left.filter((id) => h.records.includes(id)).length
      if (held === 0) continue
      if (best === null || held > bestHeld || (held === bestHeld && (h.records.length < best.records.length || (h.records.length === best.records.length && h.at < best.at)))) { best = h; bestHeld = held }
    }
    if (best === null) break // unreachable: every id in `left` has a closed host
    const chosen = best
    open.push({ host: chosen.id, records: chosen.records })
    for (const id of left) if (chosen.records.includes(id)) hostOf.set(id, chosen.id)
    left = left.filter((id) => !chosen.records.includes(id))
  }

  // Each placeholder becomes its chosen host, once, where core's order put it; a host that is itself a folded input needs the inputs too.
  const placed: string[] = []
  for (const c of cards) {
    const id = c.startsWith('\u0000') ? hostOf.get(c.slice(1)) : c
    if (id === undefined || placed.includes(id)) continue
    if (foldedInputs.has(id)) inputs = true
    placed.push(id)
  }
  if (placed.length === 0) return null
  return { cards: placed, open, inputs }
}

/** The layer that is really on (lenses/store.ts `useActiveLayer`, as a pure rule): one the View can still fill for this scenario, else the full model. */
export function activeLayerOf(view: View | null, sid: string | null, chosen: { readonly layer: LayerId; readonly sid: string | null }): LayerId {
  return chosen.layer === 'full' || (chosen.sid === sid && layerEntries(view).some((e) => e.id === chosen.layer)) ? chosen.layer : 'full'
}

/**
 * The layer to show the cards in: the one that is on, unless it sets any of them back (a layer that dims every card outside its own);
 * then the full model. The question is never set back by a layer.
 */
export function layerFor(view: View | null, active: LayerId, cards: readonly string[]): LayerId {
  const m = marksOf(view, active)
  if (m === null || !m.dim) return active
  return cards.some((id) => id !== QUESTION && !m.on.has(id)) ? 'full' : active
}
