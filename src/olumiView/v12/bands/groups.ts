/**
 * V12 Simple: fewer cards at rest (the owner's ruling, 17 Nov; the lead's D1). Pure: the View in, the groups out. Detailed draws every card.
 *  - D1a: a card Olumi proposed that the person has not approved, of kind driver, risk, result or note, is not drawn on Simple; ONE group card per row
 *    stands for them, their links run to it, and one press opens that row's group in place for the session. Options, aims and positions are never
 *    grouped; the person's own cards and approved cards never are.
 *  - D1a on a FIRST model (the lead, 18 Nov, on Paul's first-model complaint): while nothing is approved yet (`view.version === null`: types.ts View.version,
 *    core's own "no saved version"), Olumi's proposed figures, drivers, results and risks are DRAWN, each keeping its proposed mark and its accept, edit and
 *    reject; drawing is never approving. Its proposed NOTES still fold into the group. Once a version is approved, a proposal adds to an approved model and folds as above.
 *  - D1b (DL 17 Nov, after looking at the approved funding board): on Simple an APPROVED record that is only a sentence (core's kind `note`: a claim,
 *    an assumption, evidence, a left-out note, an earlier statement; no figure) folds into ONE notes stack per row, whoever wrote it, as v1 drew it.
 *    Structural cards (options, figures, risks, results, aims, positions) are never folded once approved. Detailed draws every note. (v2 had briefly
 *    dropped this stack; the approved board became a tangle of sentence cards and crossing lines.)
 * Read from the View's own fields only, never from words:
 *  - "Olumi proposed and unreviewed": the card is in the pending proposal (`card.change` set: core's per-card mark of a change waiting for approval)
 *    and is Olumi's (`card.author.by === 'olumi'`); a card the person gave in a reply carries `change` with `author.by` 'person' and stays drawn.
 *  - "approved": `card.change` null (the card stands in the saved version, not in a change waiting for approval).
 *  - the kind: core's `card.kind` through the fields adapter (fields.ts cardKind; today's rule where an older core sends none).
 */
import type { View, ViewCard, ViewModel } from '../../client'
import { cardKind, type CardKindName } from '../fields/fields'
import { unsizedWords } from '../cards/words'
import { useWhatIf } from '../../whatif'
import { useWhatIfFocus } from '../inspect/whatIfFocus'
import { detailsOf, useLaneInspector } from '../edit/inspectorStore'
import { bandOf, type BandId } from './bands'

/**
 * D1c (v9; pilot loop 12:17Z: all nine journeys called the canvas cluttered; Codex UI reviewer 008 v8 clutter answers): on Simple an APPROVED
 * driver or result that OLUMI wrote and that holds a figure with no value yet folds into ONE count per row, "N more from Olumi", with Olumi's mark.
 * "No value yet" is core's own state, never the absence of a figure: core's gap words on an empty figure (`unsizedWords`: "not given yet · …") or a
 * calculation waiting on an input (`figure.state === 'waits'`). A qualitative card (no figure) is never swept in; options, aims, positions, risks and
 * notes are not in this rule; the person's, the brief's and mixed cards never fold. What the newest reply points at, the figure being tried and the
 * card open in the details panel stay drawn (`foldKeepOf`). Detailed draws every card; the existing one-press open reveals the row's cards.
 */
export type GroupKind = 'proposed' | 'notes' | 'olumi'
export type GroupBand = Exclude<BandId, 'ideas'>
export type CardGroup = { readonly id: string; readonly kind: GroupKind; readonly band: GroupBand; readonly cards: readonly string[]; readonly kinds: readonly CardKindName[] }

/** Node ids of the group cards: `group:<kind>:<band>` (the folded inputs' own group is `group:inputs`, bands.ts FOLD_ID). */
export const GROUP_ID_PREFIX = 'group:'
export const groupIdOf = (kind: GroupKind, band: GroupBand): string => `${GROUP_ID_PREFIX}${kind}:${band}`
/** The band a group card stands in, from its id; null for any other id. */
export function groupBandOf(id: string): GroupBand | null {
  const m = /^group:(?:proposed|notes|olumi):(options|inputs|outcomes|aims)$/.exec(id)
  return m === null ? null : (m[1] as GroupBand)
}

/** The kinds a proposal group may hold (D1a); options, aims and positions never. */
const PROPOSAL_KINDS: ReadonlySet<CardKindName> = new Set<CardKindName>(['driver', 'risk', 'result', 'note'])
/** The scenario has no approved version yet: core sends `version: null` (types.ts View.version; schema view.v3.json "version" anyOf object | null). */
export const firstModelOf = (view: View | null): boolean => view != null && view.version === null
/** Olumi proposed it and the person has not approved it (see the header for the fields). */
export const olumiUnreviewed = (card: ViewCard): boolean => card.change != null && card.author?.by === 'olumi'
/** An approved record that is only a sentence (D1b): core's kind `note`, no change pending, no figure. */
const approvedNote = (card: ViewCard, kind: CardKindName): boolean => kind === 'note' && card.change == null && card.figure == null

/** D1c: an approved Olumi driver or result whose figure core holds with no value yet (see the rule above `GroupKind`). */
const UNSIZED_KINDS: ReadonlySet<CardKindName> = new Set<CardKindName>(['driver', 'result'])
const olumiUnsized = (card: ViewCard, kind: CardKindName): boolean =>
  card.change == null && card.author?.by === 'olumi' && UNSIZED_KINDS.has(kind) && (unsizedWords(card) !== null || card.figure?.state === 'waits')

/** The active cards D1c keeps drawn, as the canvas hook subscribes to them (Codex UI reviewer 008 v9 reactivity: a getState() read alone is not an
 *  input the board is derived from). `tried`: the what-if shown on this View's scenario; `pressed`: What if just pressed; `inspected`: the card
 *  open in details. */
export type FoldActive = { readonly tried: string | null; readonly pressed: string | null; readonly inspected: string | null }
/** The same ids read once from the existing stores, for a caller that is not subscribed (Show in workspace's targets, a one-off layout). */
export function foldActiveNow(view: View | null): FoldActive {
  const shown = useWhatIf.getState().shown, open = detailsOf(useLaneInspector.getState())
  return { tried: shown !== null && (view === null || shown.sid === view.id) ? shown.quantity : null, pressed: useWhatIfFocus.getState().id, inspected: open?.kind === 'card' ? open.id : null }
}

/** The cards D1c never folds: what the newest reply points at (its `next.at` and `next.about`), the figure being tried (the what-if shown, or the
 *  one just pressed) and the card open in the details panel. Read from the View and the active ids; nothing is worked out. */
export function foldKeepOf(view: View | null, active: FoldActive = foldActiveNow(view)): ReadonlySet<string> {
  const keep = new Set<string>(), chat = view?.chat ?? []
  for (let i = chat.length - 1; i >= 0; i--) {
    const a = chat[i]!.answer
    if (a == null) continue
    if (a.next.at != null) keep.add(a.next.at)
    for (const id of a.next.about) keep.add(id)
    break
  }
  for (const id of [active.tried, active.pressed, active.inspected]) if (id !== null) keep.add(id)
  return keep
}

/** Which group a card folds into on Simple, or null where it is drawn. `keep`: the cards D1c leaves drawn (foldKeepOf). */
export function groupKindOf(card: ViewCard, model: ViewModel, view: View | null, keep: ReadonlySet<string> = new Set()): GroupKind | null {
  const { kind } = cardKind(card, model, view)
  if (olumiUnreviewed(card) && PROPOSAL_KINDS.has(kind)) return kind !== 'note' && firstModelOf(view) ? null : 'proposed'
  if (approvedNote(card, kind)) return 'notes'
  return olumiUnsized(card, kind) && !keep.has(card.id) ? 'olumi' : null
}

/** The groups of the drawn model, per row (band), in band order then proposed, notes and Olumi's in the order their cards come; a group stands for
 *  one card or more. */
export function cardGroupsOf(model: ViewModel, view: View | null, keep: ReadonlySet<string> = foldKeepOf(view)): CardGroup[] {
  const by = new Map<string, { kind: GroupKind; band: GroupBand; cards: string[]; kinds: CardKindName[] }>()
  for (const card of model.cards) {
    const g = groupKindOf(card, model, view, keep)
    if (g === null) continue
    const band = bandOf(card, model), id = groupIdOf(g, band), kind = cardKind(card, model, view).kind
    const at = by.get(id) ?? { kind: g, band, cards: [], kinds: [] }
    at.cards.push(card.id)
    if (!at.kinds.includes(kind)) at.kinds.push(kind)
    by.set(id, at)
  }
  return [...by].map(([id, g]) => ({ id, ...g }))
}

/** The model with the groups' cards left out. Its links stay as they are: a link with an end not drawn is not drawn (layout.ts cardLinks), so every
 *  drawn link keeps its place in the list (`i`), the one the lenses number by. */
export function withoutGrouped(model: ViewModel, groups: readonly CardGroup[]): ViewModel {
  const gone = new Set(groups.flatMap((g) => g.cards))
  return gone.size === 0 ? model : { ...model, cards: model.cards.filter((c) => !gone.has(c.id)) }
}

/** A group connector: an aggregate of the grouped cards' links between two drawn ends. It names no single relationship: no record, no removal, no
 *  title, sign, strength or place in the View's links, so nothing drawn for it can describe or act on one member (Codex P1, 17 Nov). Opening the
 *  group draws the real links with their own controls. */
export type GroupLink = { readonly from: string; readonly to: string; readonly count: number }

/** The links of the groups' cards, run to the group card, and of an aim's bars (layout.ts barsOf), run to the aim: one connector per pair of drawn ends,
 *  none inside one group, none to an end not drawn, none where the pair already has a link of its own. `drawn`: the node ids on the board. */
export function groupLinksOf(model: ViewModel, groups: readonly CardGroup[], drawn: ReadonlySet<string>, bars: ReadonlyMap<string, string> = new Map()): GroupLink[] {
  const into = new Map([...groups.flatMap((g) => g.cards.map((c) => [c, g.id] as const)), ...bars])
  const out = new Map<string, GroupLink>()
  const have = new Set(model.links.map((k) => `${k.from}>${k.to}`))
  for (const link of model.links) {
    const from = into.get(link.from) ?? link.from, to = into.get(link.to) ?? link.to
    if (from === link.from && to === link.to) continue
    if (from === to || !drawn.has(from) || !drawn.has(to) || have.has(`${from}>${to}`)) continue
    const key = `${from}>${to}`
    out.set(key, { from, to, count: (out.get(key)?.count ?? 0) + 1 })
  }
  return [...out.values()]
}

/** What a folded group holds that is challenged: its cards core marks `challenged` and the links at them that carry core's alert. A folded group
 *  says so on its card: folding never hides dissent. */
export function challengedIn(model: ViewModel, group: CardGroup): number {
  const ids = new Set(group.cards)
  return model.cards.filter((c) => ids.has(c.id) && c.challenged === true).length + model.links.filter((l) => l.alert === true && (ids.has(l.from) || ids.has(l.to))).length
}
