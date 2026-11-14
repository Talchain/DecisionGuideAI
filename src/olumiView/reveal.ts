/**
 * V11 "reveal as a model event" (Paul, 6 Nov; design canvas HqdDCWJL19PVA8hiKh8BwZ, Main.dc.html): after the team's views are revealed, each
 * view is drawn on the card it is about, and selecting one opens it in the dock. This file only READS core's View; it composes no words and
 * formats no value.
 *
 * Where a view sits: on the card whose id is the figure's quantity, else on the card whose `badge.records` holds it (core folds an option's
 * own figures into that option's card, e.g. "Time to first signed contract for the paid diagnostic" into the diagnostic option). A view with
 * no figure sits on the cards core names in `about`; a card its words name beyond its figures gets its initials too. A view with
 * nothing to sit on is listed in the dock only.
 *
 * Which view is the chip (the consequential disagreement) and which are initials in their card:
 * - With core's `collab.marks` (wip/debate-r2 f3aedd9a): a chip for each mark core gives a card, of any kind, in core's own short words
 *   ("Priya and Tom differ", "Only Maya raised it", "Priya and Tom added evidence"), with the people's initials (Paul's approved grammar,
 *   7 Nov v2.1); a card with two marks has two chips, the disagreement first.
 * - Every view core's marks do not gather is initials in its card (N3: core always sends its marks; nothing is ranked or weighed here).
 *
 * Core's V11 fields (asked of the DL 7 Nov; shipped on core wip/debate eaab1331, src/view/reveal.ts, olumi.view/3 additive and optional):
 * read through the readers below, so a View from an older core draws by the interim rule.
 */
import { cardOfQuantity, marksOnCard, revealedViews } from './layout'
export { cardOfQuantity } from './layout'
import { create } from 'zustand'
import { useViewStore } from './store'
import type { View } from './client'
import { effectsOf, type ViewEffect, type ViewEffectRun } from './standin'

export type Shared = View['collab']['shared'][number]
export type SharedFigure = Shared['figures'][number]
export type Status = ViewEffectRun['status']

// ── Requested of core (7 Nov, DL "V11 core field requests"): absent today; a fixture of this shape is labelled as such ──────────────
/** `collab.shared[].kind`: what kind of revealed view this is. */
export type RevealKind = 'shared' | 'unique' | 'disagreement'
export function kindOf(v: Shared): RevealKind | null {
  const k = (v as { kind?: unknown }).kind
  return k === 'shared' || k === 'unique' || k === 'disagreement' ? k : null
}
/** `collab.shared[].effects[].chip`: core's one-line label for a consequential effect ("Priya sees a longer wait to the first contract"). */
export function chipOf(e: ViewEffect): string | null {
  const c = (e as { chip?: unknown }).chip
  return typeof c === 'string' && c !== '' ? c : null
}
/** Requested of core 7 Nov (`collab.shared[].stance`): the person's stance word for their view ("Observed, two rollouts", "Unsure"). */
export function stanceOf(v: Shared): string | null {
  const st = (v as { stance?: unknown }).stance
  return typeof st === 'string' && st !== '' ? st : null
}
/** `collab.shared[].about`: the card ids a view concerns, for a view with no figure. */
export function aboutOf(v: Shared): readonly string[] {
  return v.about ?? []
}
/** `collab.next`: Olumi's one "what matters next" question for the round, and the cards it is about. */
/** Undefined when core does not send the field (a core before wip/debate eaab1331); null when core says nothing qualifies this round. */
export function nextOf(view: View): { readonly text: string; readonly about: readonly string[] } | null | undefined {
  if (!('next' in view.collab)) return undefined
  const n = view.collab.next
  return n == null || n.text === '' ? null : n
}

/**
 * `collab.marks` (core wip/debate-r2 5a61369a): one per record the revealed views concern, with core's short words for the canvas (at most
 * 28 characters: "Priya and Tom differ", "Only Maya raised it"), its kind and the views it gathers. Undefined from an older core.
 */
/** A mark's kind: a revealed view's kind, or core's "evidence" mark (core f3aedd9a: evidence the team shared, on the card it concerns). */
export type MarkKind = RevealKind | 'evidence'
/** Core's mark as it comes, with its hover (`title`, a line each) and accessible name (`label`) in core's words (N3). */
export type CoreMark = NonNullable<View['collab']['marks']>[number]
export function coreMarksOf(view: View): readonly CoreMark[] | undefined {
  return view.collab.marks
}

/** Core's mark drawn as one chip under a card: its words, its views (in core's order) and their people. */
export interface CardChip {
  /** The original record, before mapping it onto a summary card. */
  readonly record: string
  /** Which mark this is, stable across reads: core's record id and the mark's kind (core gives one mark per record and kind). */
  readonly key: string
  readonly card: string
  readonly kind: MarkKind
  readonly text: string
  /** The revealed views it gathers (none on an evidence mark). */
  readonly views: readonly number[]
  /** The evidence it gathers (an evidence mark only). */
  readonly evidence: readonly number[]
  /** Whose: each view's or each piece of evidence's person, by that view's or evidence's id, in core's order. */
  readonly people: readonly { readonly id: number; readonly by: string }[]
  /** Core's `marks[].reading` (f3aedd9a; disagreement marks only): Olumi's reading for this card and its correctable note. */
  readonly reading: { readonly text: string; readonly note: string } | null
  /** Core's one closing question for this chip (`marks[].question`, olumi-core PR #22); null from a core that sends none. */
  readonly question: string | null
  /** Core's `marks[].options` (f3aedd9a; disagreement marks only): each option card's words while this mark is open. */
  readonly options: readonly { readonly option: string; readonly text: string }[]
  /** Core's hover for the mark (its words, then each person's figure or each piece of evidence, a line each) and its accessible name (N3). */
  readonly title: string
  readonly label: string
}

/** One view's mark on one card: whose, which figure (null for a view placed by `about`), and core's effect status for it. */
export interface Mark {
  readonly view: number
  readonly by: string
  readonly by_id: string
  readonly card: string
  readonly figure: SharedFigure | null
  /** Core's status for this figure (the first aim core ran it on whose status is highest); null when core did not run it. */
  readonly status: Status | null
  /** Core's label for it (requested `chip`), or null. */
  readonly chip: string | null
  /** Drawn as the chip below its card (the consequential disagreement), else as initials in the card. */
  readonly isChip: boolean
}

export interface Reveal {
  /** Every mark, in core's order of views and figures. */
  readonly marks: readonly Mark[]
  /** With core's `collab.marks`: every chip core gives a drawn card, a disagreement first, then unique, shared and evidence. */
  readonly cardChips: ReadonlyMap<string, readonly CardChip[]>
  /** The revealed views (not skipped), in core's order. */
  readonly views: readonly Shared[]
  /** Views with nothing to sit on: listed in the dock only. */
  readonly unplaced: readonly Shared[]
}

const RANK: Record<Status, number> = { changes: 3, moves: 2, same: 1 }

/** The status of one figure: its effects across aims, the highest core gives; null when core ran none (refused or absent). */
function statusOf(effects: readonly ViewEffect[], quantity: string): { status: Status | null; chip: string | null } {
  let best: ViewEffectRun | null = null, chip: string | null = null
  for (const e of effects) {
    if (e.quantity !== quantity || 'refused' in e) continue
    if (best === null || RANK[e.status] > RANK[best.status]) { best = e; chip = chipOf(e) }
  }
  return { status: best?.status ?? null, chip }
}

/**
 * The revealed views as marks on the model, or null when there is nothing to draw: a gated viewer (core withholds the views), no model, or
 * no revealed view.
 */
/** One reading per View: every card's marks and chips read the same Reveal (a View is replaced, never changed in place). */
const READ = new WeakMap<View, Reveal | null>()
export function revealOf(view: View | null): Reveal | null {
  if (view === null) return null
  if (!READ.has(view)) READ.set(view, readReveal(view))
  return READ.get(view) ?? null
}

function readReveal(view: View): Reveal | null {
  if (view.gated || view.model === null || view.model === undefined) return null
  const views = revealedViews(view)
  const core = coreMarksOf(view)
  // Evidence is shared, so core may mark it before any view is revealed.
  if (views.length === 0 && (core === undefined || core.length === 0)) return null
  const cards = new Set(view.model.cards.map((c) => c.id))
  const raw: Omit<Mark, 'isChip'>[] = []
  const unplaced: Shared[] = []
  for (const v of views) {
    const effects = effectsOf(v)
    const before = raw.length
    for (const f of v.figures) {
      const card = cardOfQuantity(view, f.quantity)
      if (card === null) continue
      const { status, chip } = statusOf(effects, f.quantity)
      raw.push({ view: v.id, by: v.by, by_id: v.by_id, card, figure: f, status, chip })
    }
    // Core's `about` (wip/debate eaab1331): the view's figures' quantities, then each card its words name. A card it names that none of its
    // figures already marks gets the person's initials too.
    const marked = new Set(raw.slice(before).map((m) => m.card))
    for (const id of aboutOf(v)) if (cards.has(id) && !marked.has(id)) { marked.add(id); raw.push({ view: v.id, by: v.by, by_id: v.by_id, card: id, figure: null, status: null, chip: null }) }
    if (raw.length === before) unplaced.push(v)
  }
  // Core's per-card marks, on the card each record is drawn on (an option's own record on the option).
  // Paul's approved grammar (7 Nov v2.1): every kind is a chip on the card's rail ("All three agree", "Priya and Tom differ", "Only Maya
  // raised it", "Maya added evidence"), so the kind reads without a click. Two marks on one card are two chips, in core's order: core gives a
  // card at most one mark from the views, before its evidence mark (olumi-core src/view/reveal.ts), so nothing is reordered here.
  const cardChips = new Map<string, CardChip[]>()
  for (const cm of core ?? []) {
    const card = cardOfQuantity(view, cm.card)
    if (card === null) continue
    const people = cm.kind === 'evidence'
      ? cm.evidence.flatMap((id) => { const e = view.evidence.find((x) => x.id === id); return e === undefined ? [] : [{ id, by: e.by }] })
      : cm.views.flatMap((id) => { const v = views.find((x) => x.id === id); return v === undefined ? [] : [{ id, by: v.by }] })
    if (people.length === 0) continue
    const key = `${cm.card}:${cm.kind}`
    if ((cardChips.get(card) ?? []).some((c) => c.key === key)) continue
    const chip: CardChip = { key, card, record: cm.card, kind: cm.kind, text: cm.text, views: cm.kind === 'evidence' ? [] : people.map((p) => p.id), evidence: cm.kind === 'evidence' ? people.map((p) => p.id) : [], people, reading: cm.reading ?? null, question: cm.question ?? null, options: cm.options ?? [], title: cm.title, label: cm.label }
    cardChips.set(card, [...(cardChips.get(card) ?? []), chip])
  }
  // A view is drawn as a chip on a card when core's mark there gathers it; otherwise it is initials in the card.
  const marks = raw.map((m): Mark => ({ ...m, isChip: (cardChips.get(m.card) ?? []).some((c) => c.views.includes(m.view)) }))
  return { marks, cardChips, views, unplaced }
}

/** The marks on one card: its chips (below it) and its initials (in it), each person once in the initials. */
export function marksOn(r: Reveal | null, card: string): { readonly chips: readonly Mark[]; readonly initials: readonly Mark[]; readonly cardChips: readonly CardChip[] } {
  if (r === null) return { chips: [], initials: [], cardChips: [] }
  return { ...marksOnCard(r.marks, card), cardChips: r.cardChips.get(card) ?? [] }
}

/**
 * What a person opens from the canvas, which the dock draws: one revealed view (`selected`) or one piece of evidence (`evidence`), never
 * both. Null when none is open.
 */
export const useReveal = create<{
  readonly selected: number | null
  readonly evidence: number | null
  /** The card whose chip was opened (its ring is the one selection ring on the board); null when opened another way. */
  readonly card: string | null
  /** Which of that card's chips was opened, by its key (a card may have several: "Priya and Tom differ", "Priya and Tom added evidence"). */
  readonly chip: string | null
  /** How many times something was opened: each selection, the same chip again included, brings its card to the centre (./revealCamera). */
  readonly opens: number
  readonly select: (id: number | null, card?: string | null, chip?: string | null) => void
  readonly selectEvidence: (id: number | null, card?: string | null, chip?: string | null) => void
}>()((set) => ({
  selected: null,
  evidence: null,
  card: null,
  chip: null,
  opens: 0,
  select: (id, card = null, chip = null) => set((s) => ({ selected: id, card: id === null ? null : card, chip: id === null || card === null ? null : chip, evidence: null, opens: s.opens + (id === null ? 0 : 1) })),
  selectEvidence: (id, card = null, chip = null) => set((s) => ({ evidence: id, card: id === null ? null : card, chip: id === null || card === null ? null : chip, selected: null, opens: s.opens + (id === null ? 0 : 1) })),
}))

/**
 * The chip open on the board now (core's mark), or null: the opened card's chip with the opened key that still holds the open view or
 * evidence; opened without a key (an older caller), the card's first chip that holds it. A key the View no longer has opens no chip.
 */
export function openChipOf(r: Reveal | null, open: { readonly selected: number | null; readonly evidence: number | null; readonly card: string | null; readonly chip: string | null }): CardChip | null {
  if (r === null || open.card === null) return null
  const holds = (c: CardChip) => (open.selected !== null ? c.views.includes(open.selected) : open.evidence !== null && c.evidence.includes(open.evidence))
  const list = r.cardChips.get(open.card) ?? []
  return list.find((c) => (open.chip === null || c.key === open.chip) && holds(c)) ?? null
}

/**
 * The canvas's nodes with each card that carries chips painted above the resting cards (z 1), so its rail, which hangs into the gap below
 * it, is never covered by the next row's card or its handles. A selected card still rises above (React Flow adds 1000).
 */
export function withChipsAbove<N extends { readonly id: string; readonly zIndex?: number }>(nodes: N[], cards: ReadonlySet<string>): N[] {
  if (cards.size === 0 || !nodes.some((n) => cards.has(n.id))) return nodes
  return nodes.map((n) => (cards.has(n.id) && (n.zIndex ?? 0) < 1 ? { ...n, zIndex: 1 } : n))
}

/** The canvas's nodes with the open card's node marked `v11-open` (ring.ts steps out of it: one focus per screen); the same array when none is open. */
export function withOpenCard<N extends { readonly id: string; readonly className?: string }>(nodes: N[], card: string | null): N[] {
  if (card === null || !nodes.some((n) => n.id === card)) return nodes
  return nodes.map((n) => (n.id === card ? { ...n, className: n.className ? `${n.className} v11-open` : 'v11-open' } : n))
}

/**
 * A selection never outlives what it was opened on: a new scenario, another version (an earlier one is drawn as it was, without the dock),
 * or a View that no longer holds the open view or evidence clears it, so no ring or option line is left on the board with nothing open.
 */
useViewStore.subscribe((s, prev) => {
  const r = useReveal.getState()
  if (r.selected === null && r.evidence === null && r.card === null) return
  const clear = () => useReveal.setState({ selected: null, evidence: null, card: null, chip: null })
  if (s.sid !== prev.sid || s.uuid !== prev.uuid || s.at !== prev.at) return clear()
  if (s.view === prev.view || s.view === null) return
  if (r.selected !== null && !s.view.collab.shared.some((v) => v.id === r.selected)) return clear()
  if (r.evidence !== null && !s.view.evidence.some((e) => e.id === r.evidence)) return clear()
})
