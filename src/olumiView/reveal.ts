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
 * - With core's `kind` (requested field) the chip is a `disagreement`, every other view is initials.
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
  const marks = raw.map((m): Mark => ({
    ...m,
    isChip: anyKind ? kinds.get(m.view) === 'disagreement' && m.figure !== null : top > 0 && m.status !== null && RANK[m.status] === top,
  }))
  return { marks, views, unplaced }
}

/** The marks on one card: its chips (below it) and its initials (in it), each person once in the initials. */
export function marksOn(r: Reveal | null, card: string): { readonly chips: readonly Mark[]; readonly initials: readonly Mark[] } {
  if (r === null) return { chips: [], initials: [] }
  const here = r.marks.filter((m) => m.card === card)
  const chips = here.filter((m) => m.isChip)
  const chipped = new Set(chips.map((m) => m.view))
  const initials = here.filter((m, i) => !m.isChip && !chipped.has(m.view) && here.findIndex((x) => !x.isChip && x.by_id === m.by_id) === i)
  return { chips, initials }
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
  readonly select: (id: number | null) => void
  readonly selectEvidence: (id: number | null) => void
}>()((set) => ({
  selected: null,
  evidence: null,
  select: (id) => set({ selected: id, evidence: null }),
  selectEvidence: (id) => set({ evidence: id, selected: null }),
}))
