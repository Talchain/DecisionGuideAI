/**
 * V11: the revealed views on one card, opened from its chip on the canvas (./RevealMarks.tsx), in the dock, as Paul approved (7 Nov v2.1):
 * the people's views first, in their own words with a stance word; Olumi's reading, unconfirmed and correctable; Olumi's one question at
 * the foot with one primary action and a quiet "Keep it open". Every model word and value is core's, drawn as given.
 *
 * "What matters next" is core's requested `collab.next` (./reveal.ts nextOf); until core sends it, core's current most-likely line for the
 * model (`model.run.most_likely.text`), which is the line core has today that says what the result rests on.
 *
 * V11 change 4, "Try <person>'s figure" in place: their figure run by core's what-if on a copy of the version shown (./whatif.ts, olumi-core
 * `POST …/whatif`, no AI call, nothing saved), typed as core words their figure. Each option's saved chance beside its what-if chance, in
 * core's words (./WhatIfCompare.tsx SideBySide); the card their view sits on and the options whose chance line changes are lit
 * on the canvas in a neutral ring (the person's act, never Olumi's blue); "Back to the model" drops the what-if. The try sits in the
 * person's card beside their figure (Paul: the first useful action beside the affected claim); the foot holds only Olumi's question. Saving the what-if or proposing it as a shared change needs core
 * routes this build does not have yet (asked of the DL).
 */
import { useEffect, useRef, useState } from 'react'
import { Eye, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { WHAT_IF_COPY } from '../canvas/artefacts/whatIfCopy'
import { TeamApiError } from '../olumiCore/team/api'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { Effects } from '../olumiCore/team/ViewsPanel'
import { AVATAR, BODY, CARD, H, META } from '../olumiCore/team/ui'
import type { View } from './client'
import { effectHeadingsOf, effectsOf } from './standin'
import { cardOfQuantity, chipOf, movedOptions, nextOf, revealOf, stanceOf, triedPathLinks, useReveal, useTriedCards, type CardChip, type Shared } from './reveal'
import { useViewStore } from './store'
import { clearWhatIf, tryWhatIf, useWhatIf } from './whatif'
import { SideBySide } from './WhatIfCompare'

const initial = (by: string) => by.slice(0, 1).toUpperCase()

/** A view's figures, each as core words it: its label, then its text. */
function Figures({ v }: { v: Shared }): JSX.Element | null {
  if (v.figures.length === 0) return null
  return (
    <dl className="m-0 grid gap-1" data-testid={`reveal-dock-figures-${v.id}`}>
      {v.figures.map((f) => (
        <div key={f.quantity} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3" title={f.title}>
          <dt className={META}>{f.label}</dt>
          <dd className={`${META} m-0 font-medium text-text-header tabular-nums`}>{f.text}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Olumi's one line at the dock's foot, with Olumi's mark (the only blue). */
function Next({ view }: { view: View }): JSX.Element | null {
  // Core's one question for the round; null when core says nothing qualifies. Only a core that does not send the field falls back to core's
  // most-likely line.
  const next = nextOf(view)
  const text = next === undefined ? view.model?.run?.most_likely?.text ?? null : next?.text ?? null
  if (text === null || text === '') return null
  return (
    <p className={`${BODY} flex items-start gap-2`} data-testid="reveal-dock-next">
      <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px] flex-none" />
      <span>{text}</span>
    </p>
  )
}

/** The what-if this view's first figure is shown as, when it is the one shown now; else null. */
function useTried(view: View, v: Shared) {
  const sid = useViewStore((s) => s.sid)
  const shown = useWhatIf((s) => s.shown)
  const base = view.model?.edit_base ?? null
  const f = v.figures[0] ?? null
  const current = f !== null && shown !== null && shown.sid === sid && shown.base === base && shown.quantity === f.quantity && shown.typed === f.text ? shown : null
  return { sid, base, f, current }
}

/** Their figure tried on a copy: the options side by side (core's rows), what is lit on the canvas, and the way back. */
function Tried({ view, v }: { view: View; v: Shared }): JSX.Element | null {
  const { f, current } = useTried(view, v)
  const model = view.model ?? null
  // The card their view sits on, and each option whose chance line core words differently on the copy, are lit while it is shown.
  useEffect(() => {
    if (current === null || model === null || f === null) return
    const moved = movedOptions(model, current.variant.rows)
    const at = cardOfQuantity(view, f.quantity)
    useTriedCards.setState({ ids: [...(at === null ? [] : [at]), ...moved], links: triedPathLinks(model, at, moved) })
    return () => useTriedCards.setState({ ids: [], links: [] })
  }, [current, model, f, view])
  // What the try shows is brought into view as it appears (no motion when the person asks for less).
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (current === null) return
    const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    box.current?.scrollIntoView?.({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  }, [current])
  if (current === null || model === null) return null
  return (
    <div ref={box} className={`${CARD} scroll-mt-2 gap-3`} data-testid="reveal-dock-tried">
      {current.variant.edits.map((e, i) => <p key={e.quantity} className={`${BODY} font-medium text-text-header`} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={META}>{WHAT_IF_COPY.nothingSaved}</p>
        <Button size="sm" variant="secondary" data-testid="reveal-dock-untry" onClick={clearWhatIf}>Back to the model</Button>
      </div>
      <div className={BODY}><SideBySide model={model} shown={current} /></div>
    </div>
  )
}

/** Their figure's own action, beside it in their card (V11: the first useful action beside the affected claim): try it on a copy. */
function TryFigure({ view, v }: { view: View; v: Shared }): JSX.Element | null {
  const { sid, base, f, current } = useTried(view, v)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setError(null) }, [v.id])
  if (f === null || sid === null || base === null || current !== null) return null
  const run = async () => {
    if (running) return
    setRunning(true); setError(null)
    try { await tryWhatIf(sid, base, f.quantity, f.text) } catch (e) {
      setError(e instanceof TeamApiError ? e.message : WHAT_IF_COPY.unusable)
    } finally { setRunning(false) }
  }
  return (
    <div className="grid justify-items-start gap-2">
      {/* Quiet, beside their figure: the panel's one primary action is "Bring evidence" (approved v2.1). */}
      <button type="button" data-testid="reveal-dock-try" disabled={running} onClick={() => void run()}
        className={`${META} cursor-pointer text-text-body underline underline-offset-2 hover:text-text-header disabled:cursor-wait`}>{running ? WHAT_IF_COPY.running : `Try ${v.by}’s figure`}</button>
      {error === null ? null : <p role="alert" className={`${META} text-danger`} data-testid="reveal-dock-try-error">{error}</p>}
    </div>
  )
}

/** True when the dock should draw the open view: one is selected and the View holds it among its revealed views. */
export function revealDockShown(view: View | null, selected: number | null): boolean {
  return selected !== null && revealOf(view)?.views.some((v) => v.id === selected) === true
}

/** One person's view in the panel: who, their stance word (core's, when sent), their words, their figure, and the quiet try. */
function Person({ view, v }: { view: View; v: Shared }): JSX.Element {
  const stance = stanceOf(v)
  return (
    <article className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5" data-testid={`reveal-dock-view-${v.id}`}>
      <span aria-hidden="true" className={AVATAR}>{initial(v.by)}</span>
      <div className="grid min-w-0 gap-1.5">
        <p className={`${BODY} flex flex-wrap items-center gap-2 font-medium text-text-header`}>
          {v.by}
          {stance === null ? null : <span className={`${META} rounded-full border border-panel-border px-2 py-0.5 font-normal text-text-body`} data-testid={`reveal-dock-stance-${v.id}`}>{stance}</span>}
        </p>
        <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="reveal-dock-words">{v.text}</p>
        <Figures v={v} />
        <TryFigure view={view} v={v} />
      </div>
    </article>
  )
}

/** Olumi's reading for the card: core's `reading` with its correctable note when sent; else core's effect lines for these views. */
function Reading({ view, chip, lead, tried }: { view: View; chip: CardChip | null; lead: readonly Shared[]; tried: boolean }): JSX.Element | null {
  if (tried) return null
  if (chip?.reading != null) {
    return (
      <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2" data-testid="reveal-dock-reading">
        <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px]" />
        <div className="grid gap-1.5">
          <p className={BODY}>{chip.reading.text}</p>
          {chip.reading.note === '' ? null : <p className={META} data-testid="reveal-dock-reading-note">{chip.reading.note}</p>}
        </div>
      </div>
    )
  }
  const withEffects = lead.filter((v) => effectsOf(v).length > 0)
  if (withEffects.length === 0) return null
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2" data-testid="reveal-dock-consequence">
      <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px]" />
      <div className="grid gap-3">
        {withEffects.map((v) => (
          <div key={v.id} className="grid gap-1.5">
            {/* Core's one sentence for a figure that changes which option is most likely (`effects[].chip`), first. */}
            {effectsOf(v).flatMap((e) => { const c = chipOf(e); return c === null ? [] : [c] }).map((c) => <p key={c} className={`${BODY} text-text-header`} data-testid="reveal-dock-chip">{c}</p>)}
            <Effects at={`reveal-dock-${v.id}`} view={view} by={v.by_id} figures={v.figures} effects={effectsOf(v)} headings={effectHeadingsOf(view.collab)} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** "Bring evidence": back to the Team tab's evidence, in view and ready to type. */
function bringEvidence(close: () => void): void {
  close()
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const at = document.querySelector<HTMLElement>('[data-testid="team-evidence"]')
    at?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ? 'auto' : 'smooth' })
    at?.querySelector<HTMLElement>('button, textarea, input')?.focus({ preventScroll: true })
  }))
}

/**
 * The panel Paul approved (7 Nov, v2.1): the card's heading and "Revealed together"; the people's views first, each in their own words with
 * a stance word; then Olumi's reading, unconfirmed and correctable; then Olumi's one question, with one primary action ("Bring evidence")
 * and a quiet "Keep it open". Opened from a chip, it leads with every person that chip gathers; from initials, with that one person.
 */
export function RevealDock({ view }: { view: View }): JSX.Element | null {
  const selected = useReveal((s) => s.selected)
  const card = useReveal((s) => s.card)
  const select = useReveal((s) => s.select)
  const shown = useWhatIf((s) => s.shown)
  const head = useRef<HTMLHeadingElement>(null)
  // Opening a view from the canvas moves focus here, so a keyboard user lands on what they opened.
  useEffect(() => { if (selected !== null) head.current?.focus() }, [selected])
  // A figure tried from one view is not left standing behind another, or after the dock closes. Only that view's own try is dropped: a
  // what-if the person made in the What if lens stays.
  useEffect(() => () => {
    const shownNow = useWhatIf.getState().shown, was = useViewStore.getState().view?.collab.shared.filter((x) => x.id === selected || (card !== null && revealOf(useViewStore.getState().view)?.cardChips.get(card)?.views.includes(x.id) === true))
    if (shownNow !== null && was?.some((w) => w.figures.some((f) => f.quantity === shownNow.quantity && f.text === shownNow.typed)) === true) clearWhatIf()
  }, [selected, card])
  const r = revealOf(view)
  const v = r?.views.find((x) => x.id === selected) ?? null
  if (r === null || v === null) return null
  const chip = card === null ? null : r.cardChips.get(card) ?? null
  const lead = chip === null ? [v] : chip.views.flatMap((id) => { const x = r.views.find((y) => y.id === id); return x === undefined ? [] : [x] })
  // Others whose view also sits on this card, after Olumi's reading.
  const here = chip === null ? [] : [...new Set(r.marks.filter((m) => m.card === chip.card && !chip.views.includes(m.view)).map((m) => m.view))]
  const others = here.flatMap((id) => { const x = r.views.find((y) => y.id === id); return x === undefined ? [] : [x] })
  const heading = chip === null ? view.collab.heading : view.model?.cards.find((c) => c.id === chip.card)?.heading ?? view.collab.heading
  // While a figure is tried, the side-by-side chances say what it does; Olumi's reading steps aside.
  const tried = shown !== null && lead.some((x) => x.figures.some((f) => f.quantity === shown.quantity && f.text === shown.typed))
  return (
    <section data-testid="reveal-dock" aria-label={heading} className="grid min-h-full content-start gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 ref={head} tabIndex={-1} className={`${H} outline-none`} data-testid="reveal-dock-heading">{heading}</h2>
          <p className={`${META} flex items-center gap-1.5`}><Eye aria-hidden="true" className="h-3 w-3" />Revealed together</p>
        </div>
        <button type="button" aria-label="Close" data-testid="reveal-dock-close" onClick={() => select(null)}
          className="inline-grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-header">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5">{lead.map((x) => <Person key={x.id} view={view} v={x} />)}</div>

      {lead.map((x) => <Tried key={x.id} view={view} v={x} />)}

      <Reading view={view} chip={chip} lead={lead} tried={tried} />

      {others.length === 0 ? null : <div className="grid gap-5" data-testid="reveal-dock-others">{others.map((x) => <Person key={x.id} view={view} v={x} />)}</div>}

      {/* Olumi's one question for what matters next, with one primary action and a quiet way to leave the difference open. */}
      <div className="mt-auto grid gap-3 rounded-2xl bg-panel-hover p-4" data-testid="reveal-dock-foot">
        <Next view={view} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="primary" data-testid="reveal-dock-bring-evidence" onClick={() => bringEvidence(() => select(null))}>Bring evidence</Button>
          <button type="button" data-testid="reveal-dock-keep-open" onClick={() => select(null)}
            className={`${BODY} cursor-pointer rounded-full px-2 py-1 text-text-light hover:text-text-header`}>Keep it open</button>
        </div>
      </div>
    </section>
  )
}
