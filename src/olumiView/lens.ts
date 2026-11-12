/**
 * The lenses on the core lane's canvas (DL 4 Nov: the hidden surfaces back on, fed from core's View only). The legacy lens bar reads the
 * legacy node shapes, which a View card does not carry; this lane draws its own (`ViewLensBar`), with the lenses the View can fill:
 * Model (no lens), Rests on (`restsOnOf`), What would change (`driversOf`, core's `driver.figure`) and What if (core's what-if on a copy,
 * `ViewWhatIfKey`), Trade-offs (core's option rows by aim, `ViewTradeOffsKey`) and If it failed (core's failure stories on the cards they rest on, `cards[].failed`,
 * behind "Write mine first": `ViewPreMortemKey`). View only: a lens writes nothing.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { cardNumbersOf, driverLinksOf, driversOf, restsOnOf, tryOnCardOf, type RestsOnItem, type TryOnCard } from './layout'
import type { ViewCard } from './client'
import { useViewStore } from './store'
import { useWhatIf } from './whatif'
import { failedOf, failedReasonOf } from './k5'

export type ViewLens = 'full' | 'tradeoffs' | 'rests_on' | 'premortem' | 'what_changes' | 'what_if'
/** In the legacy bar's order (LENS_ORDER); Trade-offs is core's option rows side by side (ViewTradeOffsKey, DL ruling 3, 5 Nov). */
export const VIEW_LENSES: readonly ViewLens[] = ['full', 'tradeoffs', 'rests_on', 'premortem', 'what_changes', 'what_if']
export const useViewLens = create<{ lens: ViewLens }>(() => ({ lens: 'full' }))

/** What the model on screen rests on, worked out once per View. */
export function useRestsOn(): { items: ReadonlyMap<string, RestsOnItem>; olumi: number } {
  const model = useViewStore((s) => s.view?.model ?? null)
  return useMemo(() => (model === null ? { items: new Map(), olumi: 0 } : restsOnOf(model)), [model])
}

/** The card's place in the Rests on lens while it is on, else null. */
export function useRestsOnItem(id: string): RestsOnItem | null {
  const on = useViewLens((s) => s.lens === 'rests_on')
  const { items } = useRestsOn()
  return on ? items.get(id) ?? null : null
}

/** The figures the model's options move most with, by the card that draws each, worked out once per View. */
export function useDrivers(): ReadonlyMap<string, readonly ViewCard[]> {
  const model = useViewStore((s) => s.view?.model ?? null)
  return useMemo(() => (model === null ? new Map() : driversOf(model)), [model])
}

/** The options whose chance moves most with this card's figure, while What would change is on; else null. */
export function useDriverOf(id: string): readonly ViewCard[] | null {
  const on = useViewLens((s) => s.lens === 'what_changes')
  const drivers = useDrivers()
  return on ? drivers.get(id) ?? null : null
}

/** An option's heading as core names it (the card's own words): what a per-option row on a figure card is labelled with, now the canvas
 *  draws no card codes (DL 8 Nov, the V11 audit: the prototype has none). */
export function useOptionHeading(id: string): string | null {
  return useViewStore((s) => s.view?.model?.cards.find((c) => c.id === id)?.heading ?? null)
}

/** The card's number on the canvas (O1, F1, OC1, …), worked out once per View. */
export function useCardNumber(id: string): string | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const numbers = useMemo(() => (model === null ? new Map<string, string>() : cardNumbersOf(model)), [model])
  return numbers.get(id) ?? null
}

/** The figure the person tried on this card, as they typed it, while the What if lens is on and core's answer is for the version shown. */
export function useTriedOn(id: string): string | null {
  const on = useViewLens((s) => s.lens === 'what_if')
  const sid = useViewStore((s) => s.sid)
  const base = useViewStore((s) => s.view?.model?.edit_base ?? null)
  const shown = useWhatIf((s) => s.shown)
  return on && shown !== null && shown.sid === sid && shown.base === base && shown.quantity === id ? shown.typed : null
}

/** While What would change is on: whether the link at `i` leaves (or is sized by) a figure an option's chance moves most with. */
export function useDriverLink(i: number): boolean {
  const on = useViewLens((s) => s.lens === 'what_changes')
  const model = useViewStore((s) => s.view?.model ?? null)
  const drivers = useDrivers()
  const links = useMemo(() => (model === null ? new Set<number>() : driverLinksOf(model, drivers)), [model, drivers])
  return on && links.has(i)
}


/** The opening of the person's own sentence ("Write mine first"; the same words as v10's `V10_WRITE_MINE_COPY.draft`, kept here so the lens pulls in no canvas panel). */
export const WRITE_MINE_DRAFT = 'My reasons it failed: '

/** One of Olumi's failure stories as the cards carry it: core's number and words, and every card it rests on. */
export interface FailureStory { n: number; text: string; olumi: { glyph: string; title: string }; cards: ViewCard[]; control: string | null }

/** Olumi's failure stories, by core's story number, each with the cards (in core's order) whose `failed` names it; `control` is core's words on the option whose `failed_reason` is that story. */
export function failureStoriesOf(model: { cards: ViewCard[] }): FailureStory[] {
  const by = new Map<number, FailureStory>()
  for (const c of model.cards) for (const f of failedOf(c)) {
    const st = by.get(f.n) ?? { n: f.n, text: f.title, olumi: f.olumi, cards: [], control: null }
    st.cards.push(c)
    by.set(f.n, st)
  }
  for (const c of model.cards) {
    const r = failedReasonOf(c)
    if (r !== null) for (const st of by.values()) if (st.text === r.title) st.control = r.text
  }
  // Core's own numbers, read in turn from 1 (never a sort of View values: contract.spec).
  const out: FailureStory[] = []
  for (let n = 1; n <= Math.max(0, ...by.keys()); n += 1) { const st = by.get(n); if (st !== undefined) out.push(st) }
  return out
}

export function useFailureStories(): FailureStory[] {
  const model = useViewStore((s) => s.view?.model ?? null)
  return useMemo(() => (model === null ? [] : failureStoriesOf(model)), [model])
}

/** The pre-mortem gate's own panel state (R19: `session.pre_mortem`): what they have typed, and core's words for a write that did not go through. */
export const usePreMortemGate = create<{ text: string; said: string | null }>(() => ({ text: '', said: null }))

/**
 * Whether Olumi's failure stories are open to this person. Core's gate is typed and per member (`session.pre_mortem.state`: 'wrote' once they
 * submitted their own reasons, 'chose' once they asked for Olumi's); it is never read from chat. Only a View with no gate state at all (an export
 * with none) falls back to the earlier rule: a turn of theirs opening with the "Write mine first" words, bound to them by the member's id
 * (`chat[].by_id` against `you_id`), never by their display name (two members can share one).
 */
export function useMineWritten(): boolean {
  const view = useViewStore((s) => s.view)
  if (view === null) return false
  const gate = view.session?.pre_mortem ?? null
  if (gate !== null) return gate.state !== 'closed'
  const opening = WRITE_MINE_DRAFT.trimEnd()
  return view.chat.some((t) => t.by_id !== null && t.by_id === view.you_id && t.said.trimStart().startsWith(opening))
}

/** 'rests' for a card Olumi's stories rest on, 'other' for any other card, while the If it failed lens is on with Olumi's stories shown; else null. */
export function usePreMortemOf(id: string): 'rests' | 'other' | null {
  const on = useViewLens((s) => s.lens === 'premortem')
  const mine = useMineWritten()
  const stories = useFailureStories()
  if (!on || !mine || stories.length === 0) return null
  return stories.some((st) => st.cards.some((c) => c.id === id)) ? 'rests' : 'other'
}

/**
 * TM-27: the try on this card's face (layout.ts tryOnCardOf), in every lens, while core's answer is for the version shown: the same gate as
 * the dock's what-if box (ViewChances useWhatIfOn), so the card and the dock never disagree about whether a try is on screen.
 */
export function useTryOn(card: ViewCard | null): TryOnCard | null {
  const sid = useViewStore((s) => s.sid)
  const base = useViewStore((s) => s.view?.model?.edit_base ?? null)
  const shown = useWhatIf((s) => s.shown)
  return useMemo(() => (card === null || shown === null || shown.sid !== sid || shown.base !== base ? null : tryOnCardOf(shown.variant, shown.quantity, shown.typed, card)), [shown, sid, base, card])
}
