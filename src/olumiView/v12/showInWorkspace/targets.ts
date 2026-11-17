/**
 * "Show in the workspace": which cards an Olumi reply is about, and what must be unfolded before they can be seen. Pure: it reads the
 * reader's CURRENT View and what they have open, and nothing else. It never reads another member's View and never remembers an earlier one.
 *
 * The reply's ids are core's own (`answer.next.at`, then `answer.next.about`), each once, in core's order. For each id, the first rule
 * that matches:
 *   1. a card the board draws                         → that card
 *   2. a card Simple holds in a fold                  → that card, once the fold is opened: the folded inputs (rule 7), a row's closed
 *                                                       group (groups.ts: Olumi's unreviewed proposals, the approved notes), or both
 *                                                       where the group stands in the folded inputs' row
 *   3. a relation card the board draws as a link      → the two cards that link joins (read as `linkCards` reads them)
 *   4. a record a badge holds
 *      a. behind a badge that is already open         → the card (or the question) whose badge it is
 *      b. behind closed badges only                   → ONE badge is opened, chosen by the host rule; the id is resolved again after
 *   5. a record a drawn card names as a premise       → ONE card that holds it, chosen by the same host rule (nothing is unfolded)
 *   6. anything else                                  → nothing, and no trace of it
 *
 * Rule 6 is the stale id, the record the board never draws, and anything core does not send THIS reader. The three are not told apart
 * and none is counted, named or hinted at: an id that is not in the reader's View does not exist here.
 *
 * THE HOST RULE (4b and 5: several badges, or several cards, hold the same record). The hosts are a fixed greedy cover of the ids waiting:
 *   - the host that holds the most of those ids;
 *   - on a tie, the host that holds the fewest records in all (for a badge, the least is unfolded; for a card's premises, the card
 *     that rests on the least else is the one most about this record);
 *   - on a tie, the first in the View's order (the question, then its cards).
 * It is repeated until every such id has a host. Never "the first host found".
 *
 * AFTER UNFOLDING the caller resolves again on the View core then sends: a record that has become a card is its own target (rule 1), one
 * still inside an open badge is its host (4a). A second pass that still asks for a badge means the unfolding did not land: the caller
 * stops there and says so, it does not loop. (A card a badge handed out may stand behind one of Simple's folds, rule 2: the caller opens
 * those once and resolves a last time, show.ts.)
 */
import type { Box, Pane, Viewport } from './cameraPort'
import { QUESTION, cardGroupsOf, causalPathOf, drawnModelOf, failureStoriesOf, groupOpen, inputIdsOf, inputsFolded, layerEntries, linkCards, marksOf, type LayerId, type View, type ViewLens, type ViewModel, type ViewTurn } from './deps'

export type Next = NonNullable<ViewTurn['answer']>['next']

/** What the person has on screen that decides whether a card is drawn: the scenario, its level, and the folds they have opened (foldStore's record: the inputs, and each row's group). */
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
  /** Simple's row groups to open first (rule 2): the group cards' ids, each once, in the order the cards asked for them. */
  readonly groups: readonly string[]
}

/** Something that holds records: a badge (the question's or a card's) or a card's premises. `at` is its place in the View's order. */
interface Host { readonly id: string; readonly records: readonly string[]; readonly at: number }

type Badge = Host & { readonly open: boolean }

/** Every badge in the View, in the View's order: the question's, then each card's. */
function badgesOf(model: ViewModel): Badge[] {
  const out: Badge[] = []
  const q = model.question.badge
  if (q != null) out.push({ id: QUESTION, records: q.records, open: q.open, at: 0 })
  model.cards.forEach((c, i) => { if (c.badge != null) out.push({ id: c.id, records: c.badge.records, open: c.badge.open, at: i + 1 }) })
  return out
}

/** THE HOST RULE: the hosts that cover `ids`, in the order chosen, and the host each id went to. An id no host holds is left out. */
function coverOf(ids: readonly string[], hosts: readonly Host[]): { chosen: Host[]; hostOf: Map<string, string> } {
  const chosen: Host[] = [], hostOf = new Map<string, string>()
  let left = [...ids]
  while (left.length > 0) {
    let best: Host | null = null, bestHeld = 0
    for (const h of hosts) {
      const held = left.filter((id) => h.records.includes(id)).length
      if (held === 0) continue
      if (best === null || held > bestHeld || (held === bestHeld && (h.records.length < best.records.length || (h.records.length === best.records.length && h.at < best.at)))) { best = h; bestHeld = held }
    }
    if (best === null) break
    const host = best
    chosen.push(host)
    for (const id of left) if (host.records.includes(id)) hostOf.set(id, host.id)
    left = left.filter((id) => !host.records.includes(id))
  }
  return { chosen, hostOf }
}

/** The two cards a relation-as-link joins: the ends of its two reason links, as `linkCards` reads them. */
const endsOf = (model: ViewModel, relation: string): string[] => model.links.filter((l) => l.kind === 'reason' && l.from === relation).map((l) => l.to)

/** An id waiting for its host keeps its place in core's order under this mark until the host is chosen. */
const WAITING = '\u0000'

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
  const simple = board.level === 'simple'
  const folded = simple && inputsFolded(board.sid, drawn, board.inputsOpen)
  const foldedInputs = folded ? new Set(inputIdsOf(drawn)) : new Set<string>()
  // The closed row group each card stands behind on Simple (canvas.ts boardOf leaves those cards out). A group in the folded inputs' row is
  // not on the board either until the inputs are opened; its cards then need both.
  const groupOf = new Map<string, string>()
  if (simple) for (const g of cardGroupsOf(drawn, view)) if (!groupOpen(board.sid, g.id, board.inputsOpen)) for (const c of g.cards) groupOf.set(c, g.id)
  // Only a badge the board can show: the question's, or a drawn card's. A relation the board draws as a link is no card to open a badge on.
  const badges = badgesOf(model).filter((h) => h.id === QUESTION || onBoard.has(h.id))
  /** The drawn cards that name a record as a premise, as hosts (rule 5). */
  const premiseHosts: Host[] = []
  model.cards.forEach((c, i) => {
    if (!onBoard.has(c.id)) return
    const named = c.premises.flatMap((p) => (p.id == null ? [] : [p.id]))
    if (named.length > 0) premiseHosts.push({ id: c.id, records: named, at: i + 1 })
  })

  const cards: string[] = [], groups: string[] = []
  let inputs = false
  /** The folds a card stands behind are asked for (rule 2). */
  const unfold = (id: string): void => {
    if (foldedInputs.has(id)) inputs = true
    const g = groupOf.get(id)
    if (g !== undefined && !groups.includes(g)) groups.push(g)
  }
  /** A node the board draws (or will, once its folds are opened): rules 1 and 2. False for anything else. */
  const take = (id: string): boolean => {
    if (id !== QUESTION && !onBoard.has(id)) return false
    unfold(id)
    if (!cards.includes(id)) cards.push(id)
    return true
  }

  const behindBadges: string[] = [], inPremises: string[] = []
  for (const id of ids) {
    if (asLinks.has(id)) { for (const end of endsOf(model, id)) take(end); continue } // rule 3
    if (take(id)) continue // rules 1, 2
    const holding = badges.filter((h) => h.records.includes(id))
    const opened = holding.find((h) => h.open)
    if (opened !== undefined) { take(opened.id); continue } // rule 4a
    if (holding.length > 0) { behindBadges.push(id); cards.push(WAITING + id); continue } // rule 4b
    if (premiseHosts.some((h) => h.records.includes(id))) { inPremises.push(id); cards.push(WAITING + id); continue } // rule 5
    // rule 6: not in this reader's View
  }

  const toOpen = coverOf(behindBadges, badges.filter((h) => !h.open))
  const holders = coverOf(inPremises, premiseHosts)
  const hostOf = new Map([...toOpen.hostOf, ...holders.hostOf])

  // Each waiting id becomes its host, once, where core's order put it; a host that itself stands behind a fold needs that fold opened too.
  const placed: string[] = []
  for (const c of cards) {
    const id = c.startsWith(WAITING) ? hostOf.get(c.slice(WAITING.length)) : c
    if (id === undefined || placed.includes(id)) continue
    unfold(id)
    placed.push(id)
  }
  if (placed.length === 0) return null
  return { cards: placed, open: toOpen.chosen.map((h) => ({ host: h.id, records: h.records })), inputs, groups }
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

/**
 * Whether the lens that is on sets any of these cards back. Only "If it failed" does (lens.ts `usePreMortemOf`): with Olumi's failure
 * stories shown, every card no story rests on is drawn faint. A gate core says is closed shows no story, so nothing is set back; a View
 * with no gate state at all is read as open, the careful side (stepping the lens aside is undone on return).
 */
export function lensSetsBack(view: View | null, lens: ViewLens, cards: readonly string[]): boolean {
  const model = view?.model ?? null
  if (view === null || model === null || lens !== 'premortem') return false
  if (view.session?.pre_mortem?.state === 'closed') return false
  const stories = failureStoriesOf(model)
  return stories.length > 0 && cards.some((id) => !stories.some((s) => s.cards.some((c) => c.id === id)))
}

/**
 * Whether the card selected sets any of these cards back. In Simple a selected card dims every card off its causal path (ViewCanvas, with
 * `causalPathOf`); Detailed dims none, and a selected card with no causal neighbour dims none.
 */
export function selectionSetsBack(model: ViewModel | null, level: 'simple' | 'working', selected: string | null, cards: readonly string[]): boolean {
  if (model === null || level !== 'simple' || selected === null) return false
  const path = causalPathOf(drawnModelOf(model), selected)
  return path !== null && cards.some((id) => id !== QUESTION && !path.has(id))
}

/**
 * A card standing ON the free canvas's edge is in view. The board's own framing stands its outermost cards exactly on that edge (the same
 * insets, computeFitPadding), and edge = place x zoom + offset is not exact: without this a card of a board just framed whole read as out
 * of view by a rounding error, and the camera jumped to centre it (seen served at 2000 x 1205, 17 Nov). One screen pixel.
 */
export const ON_EDGE = 1

/**
 * Where the camera goes so that the whole of `box` is in the free canvas: null when it all is already (nothing moves). Centred on the
 * cards at the person's own zoom, lowered only as far as the cards need to fit and never raised. There is no floor: the person asked to
 * see these cards, so a zoom at which some of them stay out of view is never chosen.
 */
export function cameraFor(box: Box, pane: Pane, v: Viewport): Viewport | null {
  const i = pane.inset, pad = 24
  const fw = pane.size.w - i.left - i.right, fh = pane.size.h - i.top - i.bottom
  const sx = box.x * v.zoom + v.x, sy = box.y * v.zoom + v.y
  if (sx >= i.left - ON_EDGE && sy >= i.top - ON_EDGE && sx + box.w * v.zoom <= pane.size.w - i.right + ON_EDGE && sy + box.h * v.zoom <= pane.size.h - i.bottom + ON_EDGE) return null
  const zoom = Math.min(v.zoom, (fw - 2 * pad) / box.w, (fh - 2 * pad) / box.h)
  if (!(zoom > 0)) return null // no free canvas to show them in
  return { x: i.left + fw / 2 - (box.x + box.w / 2) * zoom, y: i.top + fh / 2 - (box.y + box.h / 2) * zoom, zoom }
}
