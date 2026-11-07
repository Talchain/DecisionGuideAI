/**
 * V11: one revealed view, opened from its mark on the canvas (./RevealMarks.tsx), in the dock. Top to bottom: the person's own words and
 * figure; Olumi's model consequence of their figure (core's effects, drawn by the Team tab's own `Effects`); the other revealed views, each
 * opening the same way; and at the foot Olumi's one "what matters next" line. Every word and value is core's, drawn as given.
 *
 * "What matters next" is core's requested `collab.next` (./reveal.ts nextOf); until core sends it, core's current most-likely line for the
 * model (`model.run.most_likely.text`), which is the line core has today that says what the result rests on.
 *
 * V11 change 4, "Try <person>'s figure" in place: their figure run by core's what-if on a copy of the version shown (./whatif.ts, olumi-core
 * `POST …/whatif`, no AI call, nothing saved), typed as core words their figure. Each option's saved chance beside its what-if chance, in
 * core's rows (./WhatIfCompare.tsx, the What if lens's own); the card their view sits on and the options whose chance line changes are lit
 * on the canvas (v10's ring); "Back to the model" drops the what-if. Saving the what-if or proposing it as a shared change needs core
 * routes this build does not have yet (asked of the DL).
 */
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { WHAT_IF_COPY } from '../canvas/artefacts/whatIfCopy'
import { TeamApiError } from '../olumiCore/team/api'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { Effects } from '../olumiCore/team/ViewsPanel'
import { AVATAR, BODY, CARD, H, META } from '../olumiCore/team/ui'
import type { View } from './client'
import { effectHeadingsOf, effectsOf } from './standin'
import { cardOfQuantity, nextOf, revealOf, useReveal, type Shared } from './reveal'
import { useViewStore } from './store'
import { clearWhatIf, tryWhatIf, useWhatIf } from './whatif'
import { Compare } from './WhatIfCompare'
import { ringCards } from './ring'

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
  const text = nextOf(view)?.text ?? view.model?.run?.most_likely?.text ?? null
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
    const moved = current.variant.rows.filter((o) => {
      const saved = model.cards.find((c) => c.id === o.option_id)?.rows.filter((r) => r.kind === 'chance').map((r) => r.value).join('|')
      return saved !== o.rows.filter((r) => r.kind === 'chance').map((r) => r.value).join('|')
    }).map((o) => o.option_id)
    const at = cardOfQuantity(view, f.quantity)
    ringCards([...(at === null ? [] : [at]), ...moved])
    return () => ringCards([])
  }, [current, model, f, view])
  if (current === null || model === null) return null
  return (
    <div className={`${CARD} gap-3`} data-testid="reveal-dock-tried">
      {current.variant.edits.map((e, i) => <p key={e.quantity} className={`${BODY} font-medium text-text-header`} data-view={`whatif.edits.${i}.words`}>{e.words}</p>)}
      <p className={META}>{WHAT_IF_COPY.nothingSaved}</p>
      <div className={BODY}><Compare model={model} shown={current} /></div>
    </div>
  )
}

/** The dock's foot actions: try their figure, or go back to the model as it is. */
function TryActions({ view, v }: { view: View; v: Shared }): JSX.Element | null {
  const { sid, base, f, current } = useTried(view, v)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setError(null) }, [v.id])
  if (f === null || sid === null || base === null) return null
  const run = async () => {
    if (running) return
    setRunning(true); setError(null)
    try { await tryWhatIf(sid, base, f.quantity, f.text) } catch (e) {
      setError(e instanceof TeamApiError ? e.message : WHAT_IF_COPY.unusable)
    } finally { setRunning(false) }
  }
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {current === null
          ? <Button size="sm" variant="secondary" data-testid="reveal-dock-try" disabled={running} onClick={() => void run()}>{running ? WHAT_IF_COPY.running : `Try ${v.by}’s figure`}</Button>
          : <Button size="sm" variant="secondary" data-testid="reveal-dock-untry" onClick={clearWhatIf}>Back to the model</Button>}
      </div>
      {error === null ? null : <p role="alert" className={`${META} text-danger`} data-testid="reveal-dock-try-error">{error}</p>}
    </div>
  )
}

/** True when the dock should draw the open view: one is selected and the View holds it among its revealed views. */
export function revealDockShown(view: View | null, selected: number | null): boolean {
  return selected !== null && revealOf(view)?.views.some((v) => v.id === selected) === true
}

export function RevealDock({ view }: { view: View }): JSX.Element | null {
  const selected = useReveal((s) => s.selected)
  const select = useReveal((s) => s.select)
  const shown = useWhatIf((s) => s.shown)
  const head = useRef<HTMLHeadingElement>(null)
  // Opening a view from the canvas moves focus here, so a keyboard user lands on what they opened.
  useEffect(() => { if (selected !== null) head.current?.focus() }, [selected])
  // A figure tried from one view is not left standing behind another, or after the dock closes.
  useEffect(() => () => { if (useWhatIf.getState().shown !== null) clearWhatIf() }, [selected])
  const r = revealOf(view)
  const v = r?.views.find((x) => x.id === selected) ?? null
  if (r === null || v === null) return null
  const others = r.views.filter((x) => x.id !== v.id)
  // While their figure is tried, the side-by-side chances say what it does; core's effect summary steps aside.
  const tried = shown !== null && v.figures[0] !== undefined && shown.quantity === v.figures[0].quantity && shown.typed === v.figures[0].text
  return (
    <section data-testid="reveal-dock" aria-label={view.collab.heading} className="grid min-h-full content-start gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 ref={head} tabIndex={-1} className={`${H} outline-none`} data-testid="reveal-dock-heading">{view.collab.heading}</h2>
        <button type="button" aria-label="Close" data-testid="reveal-dock-close" onClick={() => select(null)}
          className="inline-grid h-7 w-7 cursor-pointer place-items-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-header">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      <article className={CARD} data-testid={`reveal-dock-view-${v.id}`}>
        <p className={`${BODY} flex items-center gap-2 font-medium text-text-header`}>
          <span aria-hidden="true" className={AVATAR}>{initial(v.by)}</span>{v.by}
        </p>
        <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="reveal-dock-words">{v.text}</p>
        <Figures v={v} />
      </article>

      <Tried view={view} v={v} />

      {/* Olumi's model consequence of their figure: core's effects, in core's words (the Team tab's own component). */}
      {tried || effectsOf(v).length === 0 ? null : (
        <div className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2" data-testid="reveal-dock-consequence">
          <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px]" />
          <Effects at={`reveal-dock-${v.id}`} view={view} by={v.by_id} figures={v.figures} effects={effectsOf(v)} headings={effectHeadingsOf(view.collab)} />
        </div>
      )}

      {others.length === 0 ? null : (
        <ul className="m-0 grid list-none gap-2 p-0" data-testid="reveal-dock-others">
          {others.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => select(o.id)} data-testid={`reveal-dock-other-${o.id}`}
                className={`grid min-h-[44px] w-full cursor-pointer grid-cols-[22px_minmax(0,1fr)] items-center gap-2.5 rounded-xl border border-panel-border bg-panel px-3 py-2 text-left hover:bg-panel-hover`}>
                <span aria-hidden="true" className={AVATAR}>{initial(o.by)}</span>
                <span className="grid min-w-0">
                  <span className={`${META} font-medium text-text-header`}>{o.by}</span>
                  <span className={`${META} truncate`}>{o.figures[0] ? `${o.figures[0].label}: ${o.figures[0].text}` : o.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto grid gap-3 pt-2">
        <Next view={view} />
        <TryActions view={view} v={v} />
      </div>
    </section>
  )
}
