/**
 * V12 Simple: fewer cards at rest (the owner's ruling, 17 Nov; the lead's D1). Pure: the View in, the groups out. Detailed draws every card.
 *  - D1a: Olumi's unreviewed notes fold into one proposed group per row on Simple. Non-note cards stay drawn.
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
import { bandOf, type BandId } from './bands'

export type GroupKind = 'proposed' | 'notes'
export type GroupBand = Exclude<BandId, 'ideas'>
export type CardGroup = { readonly id: string; readonly kind: GroupKind; readonly band: GroupBand; readonly cards: readonly string[]; readonly kinds: readonly CardKindName[] }

/** Node ids of the group cards: `group:<kind>:<band>` (the folded inputs' own group is `group:inputs`, bands.ts FOLD_ID). */
export const GROUP_ID_PREFIX = 'group:'
export const groupIdOf = (kind: GroupKind, band: GroupBand): string => `${GROUP_ID_PREFIX}${kind}:${band}`
/** The band a group card stands in, from its id; null for any other id. */
export function groupBandOf(id: string): GroupBand | null {
  const m = /^group:(?:proposed|notes):(options|inputs|outcomes|aims|points)$/.exec(id)
  return m === null ? null : (m[1] as GroupBand)
}

/** Olumi proposed it and the person has not approved it (see the header for the fields). */
export const olumiUnreviewed = (card: ViewCard): boolean => card.change != null && card.author?.by === 'olumi'
/** An approved record that is only a sentence (D1b): core's kind `note`, no change pending, no figure. */
const approvedNote = (card: ViewCard, kind: CardKindName): boolean => kind === 'note' && card.change == null && card.figure == null

/** Which group a card folds into on Simple, or null where it is drawn. */
export function groupKindOf(card: ViewCard, model: ViewModel, view: View | null): GroupKind | null {
  const { kind } = cardKind(card, model, view)
  if (olumiUnreviewed(card) && kind === 'note') return 'proposed'
  if (approvedNote(card, kind)) return 'notes'
  return null
}

/** The groups of the drawn model, per row (band); a group stands for one card or more. */
export function cardGroupsOf(model: ViewModel, view: View | null): CardGroup[] {
  const by = new Map<string, { kind: GroupKind; band: GroupBand; cards: string[]; kinds: CardKindName[] }>()
  for (const card of model.cards) {
    const g = groupKindOf(card, model, view)
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
export function withoutGrouped(model: ViewModel, groups: readonly Pick<CardGroup, 'cards'>[]): ViewModel {
  const gone = new Set(groups.flatMap((g) => g.cards))
  return gone.size === 0 ? model : { ...model, cards: model.cards.filter((c) => !gone.has(c.id)) }
}

/** A group connector: an aggregate of the grouped cards' links between two drawn ends. It names no single relationship: no record, no removal, no
 *  title, sign, strength or place in the View's links, so nothing drawn for it can describe or act on one member (Codex P1, 17 Nov). Opening the
 *  group draws the real links with their own controls. */
export type GroupLink = { readonly from: string; readonly to: string; readonly count: number; readonly mixedDirection?: true }

/** The links of the groups' cards, run to the group card, and of an aim's bars (layout.ts barsOf), run to the aim: one connector per pair of drawn ends,
 *  none inside one group, none to an end not drawn, none where the pair already has a link of its own. A one-way group connector keeps its direction;
 *  opposing links share one undirected connector. `drawn`: the node ids on the board. */
export function groupLinksOf(model: ViewModel, groups: readonly Pick<CardGroup, 'id' | 'cards'>[], drawn: ReadonlySet<string>, bars: ReadonlyMap<string, string> = new Map()): GroupLink[] {
  const into = new Map([...groups.flatMap((g) => g.cards.map((c) => [c, g.id] as const)), ...bars])
  const groupIds = new Set(groups.map((g) => g.id))
  const out = new Map<string, GroupLink>()
  const have = new Set(model.links.map((k) => `${k.from}>${k.to}`))
  for (const link of model.links) {
    const from = into.get(link.from) ?? link.from, to = into.get(link.to) ?? link.to
    if (from === link.from && to === link.to) continue
    if (from === to || !drawn.has(from) || !drawn.has(to) || have.has(`${from}>${to}`)) continue
    const key = `${from}>${to}`
    out.set(key, { from, to, count: (out.get(key)?.count ?? 0) + 1 })
  }
  const links: GroupLink[] = []
  for (const link of out.values()) {
    const fromGroup = groupIds.has(link.from), toGroup = groupIds.has(link.to)
    const reverse = fromGroup || toGroup ? out.get(`${link.to}>${link.from}`) : undefined
    if (reverse === undefined) {
      links.push(link)
      continue
    }
    // Give the undirected connector a stable endpoint order independent of its members' counts.
    const first = fromGroup === toGroup ? link.from < link.to : fromGroup
    if (first) {
      links.push({ ...link, count: link.count + reverse.count, mixedDirection: true })
    }
  }
  return links
}

/** What a folded group holds that is challenged: its cards core marks `challenged` and the links at them that carry core's alert. A folded group
 *  says so on its card: folding never hides dissent. */
export function challengedIn(model: ViewModel, group: CardGroup): number {
  const ids = new Set(group.cards)
  return model.cards.filter((c) => ids.has(c.id) && c.challenged === true).length + model.links.filter((l) => l.alert === true && (ids.has(l.from) || ids.has(l.to))).length
}
