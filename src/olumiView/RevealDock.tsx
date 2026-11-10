/**
 * V11: the revealed views on one card, opened from its chip on the canvas (./RevealMarks.tsx), in the dock, as Paul approved (7 Nov v2.1):
 * the people's views first, in their own words with a stance word; Olumi's reading, unconfirmed and correctable; Olumi's one question at
 * the foot with one primary action and a quiet "Keep it open". Every model word and value is core's, drawn as given.
 *
 * "What matters next" is core's requested `collab.next` (./reveal.ts nextOf); until core sends it, core's current most-likely line for the
 * model (`model.run.most_likely.text`), which is the line core has today that says what the result rests on.
 *
 * V11 change 4, a person's range tried in place: while a chip is open, the option cards themselves show core's words for what that mark's
 * figures do to their chance (`marks[].options`, ./RevealMarks.tsx OptionMarkLine). The panel does not repeat it, and holds no try of its
 * own: one primary action and a quiet second one (approved v2.1).
 */
import { useEffect, useRef } from 'react'
import { Eye, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { Effects } from '../olumiCore/team/ViewsPanel'
import { AVATAR, BODY, H, META } from '../olumiCore/team/ui'
import type { View } from './client'
import { effectHeadingsOf, effectsOf } from './standin'
import { chipOf, nextOf, openChipOf, revealOf, stanceOf, useReveal, type CardChip, type Shared } from './reveal'
import { useViewStore } from './store'
import { returnFromLanded } from './revealReturn'
import { otherViewsOn, withEffects } from './layout'
import { StrategyHerePill, StrategyViewLines } from './strategy/StrategyViewLines'
import { viewLinesOf } from './strategy/strategy'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import { drawKindOf } from './layout'

const initial = (by: string) => (Array.from(by)[0] ?? '').toUpperCase()

/**
 * The control that opened a dock gets focus back when the dock closes, if it is still on the page (the chip or initials on the canvas). A
 * control inside the dock that opens another item keeps the first opener.
 */
export function useReturnFocus(open: number | null): (close: () => void) => void {
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open === null || typeof document === 'undefined') return
    // Only a control outside the docks is an opener. A press inside the dock (its button may be gone, leaving focus on the body) or a
    // click that gave nothing focus keeps the opener already held; the dock unmounts on close, so none outlives it.
    const a = document.activeElement
    if (!(a instanceof HTMLElement) || a === document.body || a.closest('[data-testid="reveal-dock"], [data-testid="evidence-dock"]') !== null) return
    opener.current = a
  }, [open])
  return (close) => {
    const o = opener.current
    opener.current = null
    close()
    if (o === null || typeof window === 'undefined') return
    window.requestAnimationFrame(() => { if (o.isConnected) o.focus({ preventScroll: true }) })
  }
}

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
function Next({ view, chip }: { view: View; chip: CardChip | null }): JSX.Element | null {
  // The open chip's own closing question (core `marks[].question`) first; else core's one question for the round, null when core says
  // nothing qualifies. Only a core that sends neither field falls back to core's most-likely line.
  const next = nextOf(view)
  const text = chip?.question ?? (next === undefined ? view.model?.run?.most_likely?.text ?? null : next?.text ?? null)
  if (text === null || text === '') return null
  return (
    <p className={`${BODY} flex items-start gap-2`} data-testid="reveal-dock-next">
      <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px] flex-none" />
      <span>{text}</span>
    </p>
  )
}

/** True when the dock should draw the open view: one is selected and the View holds it among its revealed views. */
export function revealDockShown(view: View | null, selected: number | null): boolean {
  return selected !== null && revealOf(view)?.views.some((v) => v.id === selected) === true
}

/** One person's view in the panel: who, their stance word (core's, when sent), their words and their figure. */
function Person({ v, card = null }: { v: Shared; card?: string | null }): JSX.Element {
  const view = useViewStore((s) => s.view) // the View the dock reads, for the strategy lane's lines under this person
  const stance = stanceOf(v)
  const here = card !== null && view !== null && viewLinesOf(view, v.id).some((l) => l.about.id === card)
  return (
    <article className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5" data-testid={`reveal-dock-view-${v.id}`}>
      <span aria-hidden="true" className={AVATAR}>{initial(v.by)}</span>
      <div className="grid min-w-0 gap-1">
        <p className={`${BODY} flex flex-wrap items-center gap-2 font-medium text-text-header`}>
          {v.by}
          {/* P1 (the comp): opened on a card, their pill for THIS card ("Observed, two rollouts") is the one beside their name; else the view's
              own stance word. */}
          {here ? <StrategyHerePill view={view} v={v} card={card} />
            : stance === null ? null : <span className={`${META} rounded-full border border-panel-border px-2 py-0.5 font-normal text-text-body`} data-testid={`reveal-dock-stance-${v.id}`}>{stance}</span>}
        </p>
        <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="reveal-dock-words">{v.text}</p>
        <Figures v={v} />
        {view === null ? null : <StrategyViewLines view={view} v={v} card={card} />}
      </div>
    </article>
  )
}

/** Olumi's reading for the card: core's `reading` with its correctable note when sent; else core's effect lines for these views. */
function Reading({ view, chip, lead }: { view: View; chip: CardChip | null; lead: readonly Shared[] }): JSX.Element | null {
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
  const ran = withEffects(lead, effectsOf)
  if (ran.length === 0) return null
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2" data-testid="reveal-dock-consequence">
      <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px]" />
      <div className="grid gap-3">
        {ran.map((v) => (
          <div key={v.id} className="grid gap-1.5">
            {/* Core's one sentence for a figure that changes which option is most likely (`effects[].chip`), first. */}
            {[...new Set(effectsOf(v).flatMap((e) => { const c = chipOf(e); return c === null ? [] : [c] }))].map((c) => <p key={c} className={`${BODY} text-text-header`} data-testid="reveal-dock-chip">{c}</p>)}
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
    // The way to add evidence, never the first button there ("Ask Olumi to consider this" is an Olumi turn): the open form's words field,
    // else the Team tab's own "Add evidence" opener.
    const at = document.querySelector<HTMLElement>('[data-testid="team-evidence-body"]') ?? document.querySelector<HTMLElement>('[data-testid="team-evidence-open"]')
    at?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true ? 'auto' : 'smooth' })
    at?.focus({ preventScroll: true })
  }))
}

/**
 * The panel Paul approved (7 Nov, v2.1): the card's heading and "Revealed together"; the people's views first, each in their own words with
 * a stance word; then Olumi's reading, unconfirmed and correctable; then Olumi's one question, with one primary action ("Bring evidence")
 * and a quiet "Keep it open". Opened from a chip, it leads with every person that chip gathers; from initials, with that one person.
 */
export function RevealDock({ view }: { view: View }): JSX.Element | null {
  const open = useReveal((s) => s)
  const selected = open.selected
  const select = open.select
  const head = useRef<HTMLHeadingElement>(null)
  const returning = useReturnFocus(selected)
  // Opening a view from the canvas moves focus here, so a keyboard user lands on what they opened; closing returns it to the opener.
  useEffect(() => { if (selected !== null) head.current?.focus() }, [selected])
  const r = revealOf(view)
  const v = r?.views.find((x) => x.id === selected) ?? null
  if (r === null || v === null) return null
  // A panel that landed by itself hands the dock back as it was (revealReturn); one the person opened closes back to Team.
  const close = () => returning(() => { const c = open.chip; select(null); returnFromLanded(c) })
  const chip = openChipOf(r, open)
  const lead = chip === null ? [v] : chip.views.flatMap((id) => { const x = r.views.find((y) => y.id === id); return x === undefined ? [] : [x] })
  // Others whose view also sits on this card, after Olumi's reading.
  const here = chip === null ? [] : otherViewsOn(r.marks, chip.card, chip.views)
  const others = here.flatMap((id) => { const x = r.views.find((y) => y.id === id); return x === undefined ? [] : [x] })
  const model = view.model
  const shown = chip === null ? undefined : model?.cards.find((c) => c.id === chip.card)
  const heading = chip === null ? view.collab.heading : shown?.heading ?? view.collab.heading
  return (
    <section data-testid="reveal-dock" aria-label={heading} className="flex min-h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h2 ref={head} tabIndex={-1} className={`${H} flex items-center gap-2 outline-none`} data-testid="reveal-dock-heading">
            {/* The comp's panel: the card's own shape before its name, so the panel reads as that card's. */}
            {shown === undefined || model == null ? null : <span aria-hidden="true" className="inline-flex flex-none" data-reveal-dock-shape=""><NodeShapeIndicator nodeKind={drawKindOf(shown, model)} size={12} /></span>}
            {heading}
          </h2>
          <p className={`${META} flex items-center gap-1.5`}><Eye aria-hidden="true" className="h-3 w-3" />{view.reveal_words.revealedTogether}</p>
        </div>
        <button type="button" aria-label={view.reveal_words.close} data-testid="reveal-dock-close" onClick={close}
          className="inline-grid h-7 w-7 flex-none cursor-pointer place-items-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-header">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-4">{lead.map((x) => <Person key={x.id} v={x} card={chip?.card ?? null} />)}</div>

      <Reading view={view} chip={chip} lead={lead} />

      {others.length === 0 ? null : <div className="grid gap-4" data-testid="reveal-dock-others">{others.map((x) => <Person key={x.id} v={x} card={chip?.card ?? null} />)}</div>}

      {/* Olumi's one question for what matters next, with one primary action and a quiet way to leave the difference open. It stays at the
          dock's foot while the views above it scroll, so the action is always in reach (1232 x 704: the views alone fill the dock). It reaches
          down over the dock body's own padding, so nothing scrolls past beneath it. */}
      <div className="sticky -bottom-3 mt-auto bg-panel pb-3 pt-2">
        <div className="grid gap-2 rounded-2xl bg-panel-hover p-3" data-testid="reveal-dock-foot">
          <Next view={view} chip={chip} />
          {/* One row, as the comp: the primary action and the quiet one side by side. */}
          <div className="flex flex-nowrap items-center gap-2">
            <Button size="sm" variant="primary" className="min-h-[44px]" data-testid="reveal-dock-bring-evidence" onClick={() => bringEvidence(() => select(null))}>{view.reveal_words.bringEvidence}</Button>
            <button type="button" data-testid="reveal-dock-keep-open" onClick={close}
              className={`${BODY} inline-flex min-h-[44px] cursor-pointer items-center rounded-full px-3 text-text-body hover:text-text-header`}>{view.reveal_words.keepOpen}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
