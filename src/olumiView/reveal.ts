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
 * - With core's `collab.marks` (wip/debate-r2 5a61369a): ONE chip per card core marks, of any kind, in core's own short words ("Priya and
 *   Tom differ", "Only Maya raised it"), with the people's initials (Paul's approved grammar, 7 Nov v2.1).
 * - With core's `kind` only (wip/debate eaab1331) the chips are the `disagreement` views, every other view is initials.
 * - Until core sends `kind`, by core's own effect status only: the views at the highest status present among `changes` then `moves` are
 *   chips; `same`, a refused figure and a view with no figure are initials. Nothing is ranked or weighed here.
 *
 * Core's V11 fields (asked of the DL 7 Nov; shipped on core wip/debate eaab1331, src/view/reveal.ts, olumi.view/3 additive and optional):
 * read through the readers below, so a View from an older core draws by the interim rule.
 */
import { create } from 'zustand'
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
  const a = (v as { about?: unknown }).about
  return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : []
}
/** `collab.next`: Olumi's one "what matters next" question for the round, and the cards it is about. */
/** Undefined when core does not send the field (a core before wip/debate eaab1331); null when core says nothing qualifies this round. */
export function nextOf(view: View): { readonly text: string; readonly about: readonly string[] } | null | undefined {
  if (!('next' in view.collab)) return undefined
  const n = (view.collab as { next?: unknown }).next as { text?: unknown; about?: unknown } | null | undefined
  if (n == null || typeof n.text !== 'string' || n.text === '') return null
  return { text: n.text, about: Array.isArray(n.about) ? n.about.filter((x): x is string => typeof x === 'string') : [] }
}

/**
 * `collab.marks` (core wip/debate-r2 5a61369a): one per record the revealed views concern, with core's short words for the canvas (at most
 * 28 characters: "Priya and Tom differ", "Only Maya raised it"), its kind and the views it gathers. Undefined from an older core.
 */
export type CoreMark = {
  readonly card: string; readonly kind: RevealKind; readonly views: readonly number[]; readonly text: string
  readonly reading: CardChip['reading']; readonly options: CardChip['options']
}
export function coreMarksOf(view: View): readonly CoreMark[] | undefined {
  const m = (view.collab as { marks?: unknown }).marks
  if (!Array.isArray(m)) return undefined
  return m.flatMap((x): CoreMark[] => {
    const y = (x ?? {}) as Record<string, unknown>
    const kind = y.kind === 'shared' || y.kind === 'unique' || y.kind === 'disagreement' ? y.kind : null
    if (typeof y.card !== 'string' || kind === null || typeof y.text !== 'string' || y.text === '' || !Array.isArray(y.views)) return []
    const r = (y.reading ?? null) as { text?: unknown; note?: unknown } | null
    const reading = r !== null && typeof r.text === 'string' && r.text !== '' ? { text: r.text, note: typeof r.note === 'string' ? r.note : '' } : null
    const options = Array.isArray(y.options) ? y.options.flatMap((o) => { const z = (o ?? {}) as Record<string, unknown>; return typeof z.option === 'string' && typeof z.text === 'string' && z.text !== '' ? [{ option: z.option, text: z.text }] : [] }) : []
    return [{ card: y.card, kind, views: y.views.filter((v): v is number => typeof v === 'number'), text: y.text, reading, options }]
  })
}

/** Core's mark drawn as one chip under a card: its words, its views (in core's order) and their people. */
export interface CardChip {
  readonly card: string
  readonly kind: RevealKind
  readonly text: string
  readonly views: readonly number[]
  readonly people: readonly { readonly view: number; readonly by: string }[]
  /** Requested of core 7 Nov (`marks[].reading`): Olumi's reading for this card and its correctable note. */
  readonly reading: { readonly text: string; readonly note: string } | null
  /** Requested of core 7 Nov (`marks[].options`): each option card's words while this mark is open ("71% → 34% with Priya's range"). */
  readonly options: readonly { readonly option: string; readonly text: string }[]
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
  /** With core's `collab.marks`: one chip per card core marks as a disagreement, by drawn card id. */
  readonly cardChips: ReadonlyMap<string, CardChip>
  /** With core's `collab.marks`: core's words for every other card it marks (the initials' hover), by drawn card id. */
  readonly cardWords: ReadonlyMap<string, string>
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

/** The card a figure's quantity is drawn on: its own card, else the card whose badge holds that record; null when the canvas has neither. */
export function cardOfQuantity(view: View, quantity: string): string | null {
  const cards = view.model?.cards ?? []
  if (cards.some((c) => c.id === quantity)) return quantity
  return cards.find((c) => c.badge?.records.includes(quantity) === true)?.id ?? null
}

/**
 * The revealed views as marks on the model, or null when there is nothing to draw: a gated viewer (core withholds the views), no model, or
 * no revealed view.
 */
export function revealOf(view: View | null): Reveal | null {
  if (view === null || view.gated || view.model === null || view.model === undefined) return null
  const views = view.collab.shared.filter((v) => !v.skip)
  if (views.length === 0) return null
  const cards = new Set(view.model.cards.map((c) => c.id))
  const raw: Omit<Mark, 'isChip'>[] = []
  const unplaced: Shared[] = []
  const kinds = new Map<number, RevealKind | null>()
  for (const v of views) {
    kinds.set(v.id, kindOf(v))
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
  const anyKind = [...kinds.values()].some((k) => k !== null)
  const top = raw.reduce((m, x) => (x.status === 'changes' || x.status === 'moves' ? Math.max(m, RANK[x.status]) : m), 0)
  // Core's per-card marks, on the card each record is drawn on (an option's own record on the option).
  const cardChips = new Map<string, CardChip>(), cardWords = new Map<string, string>()
  const core = coreMarksOf(view)
  for (const cm of core ?? []) {
    const card = cardOfQuantity(view, cm.card)
    if (card === null) continue
    // Paul's approved grammar (7 Nov v2.1): every kind is a chip on the card's rail ("All three agree", "Priya and Tom differ", "Only Maya
    // raised it"), so the kind reads without a click.
    const people = cm.views.flatMap((id) => { const v = views.find((x) => x.id === id); return v === undefined ? [] : [{ view: id, by: v.by }] })
    if (people.length > 0 && !cardChips.has(card)) cardChips.set(card, { card, kind: cm.kind, text: cm.text, views: people.map((p) => p.view), people, reading: cm.reading, options: cm.options })
    else if (!cardWords.has(card)) cardWords.set(card, cm.text)
  }
  const marks = raw.map((m): Mark => ({
    ...m,
    isChip: core !== undefined ? cardChips.get(m.card)?.views.includes(m.view) === true
      : anyKind ? kinds.get(m.view) === 'disagreement' && m.figure !== null : top > 0 && m.status !== null && RANK[m.status] === top,
  }))
  return { marks, cardChips, cardWords, views, unplaced }
}

/** The marks on one card: its chips (below it) and its initials (in it), each person once in the initials. */
export function marksOn(r: Reveal | null, card: string): { readonly chips: readonly Mark[]; readonly initials: readonly Mark[]; readonly chip: CardChip | null; readonly words: string | null } {
  if (r === null) return { chips: [], initials: [], chip: null, words: null }
  const here = r.marks.filter((m) => m.card === card)
  const chips = here.filter((m) => m.isChip)
  const chipped = new Set(chips.map((m) => m.view))
  const initials = here.filter((m, i) => !m.isChip && !chipped.has(m.view) && here.findIndex((x) => !x.isChip && x.by_id === m.by_id) === i)
  return { chips, initials, chip: r.cardChips.get(card) ?? null, words: r.cardWords.get(card) ?? null }
}

/**
 * The cards lit while a person's figure is tried from the dock (the card their view sits on, and each option whose chance moves): the
 * person's own act, so a neutral ring in the header ink, never Olumi's blue (v10's `v10-lit` ring is Olumi's pointing).
 */
export const useTriedCards = create<{ readonly ids: readonly string[] }>()(() => ({ ids: [] }))

/**
 * What a person opens from the canvas, which the dock draws: one revealed view (`selected`) or one piece of evidence (`evidence`), never
 * both. Null when none is open.
 */
export const useReveal = create<{
  readonly selected: number | null
  readonly evidence: number | null
  /** The card whose chip was opened (its ring is the one selection ring on the board); null when a view was opened another way. */
  readonly card: string | null
  readonly select: (id: number | null, card?: string | null) => void
  readonly selectEvidence: (id: number | null) => void
}>()((set) => ({
  selected: null,
  evidence: null,
  card: null,
  select: (id, card = null) => set({ selected: id, card: id === null ? null : card, evidence: null }),
  selectEvidence: (id) => set({ evidence: id, selected: null, card: null }),
}))
