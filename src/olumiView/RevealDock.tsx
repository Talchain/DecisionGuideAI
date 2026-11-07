/**
 * V11: one revealed view, opened from its mark on the canvas (./RevealMarks.tsx), in the dock. Top to bottom: the person's own words and
 * figure; Olumi's model consequence of their figure (core's effects, drawn by the Team tab's own `Effects`); the other revealed views, each
 * opening the same way; and at the foot Olumi's one "what matters next" line. Every word and value is core's, drawn as given.
 *
 * "What matters next" is core's requested `collab.next` (./reveal.ts nextOf); until core sends it, core's current most-likely line for the
 * model (`model.run.most_likely.text`), which is the line core has today that says what the result rests on.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { Effects } from '../olumiCore/team/ViewsPanel'
import { AVATAR, BODY, CARD, H, META } from '../olumiCore/team/ui'
import type { View } from './client'
import { effectHeadingsOf, effectsOf } from './standin'
import { nextOf, revealOf, useReveal, type Shared } from './reveal'

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

/** True when the dock should draw the open view: one is selected and the View holds it among its revealed views. */
export function revealDockShown(view: View | null, selected: number | null): boolean {
  return selected !== null && revealOf(view)?.views.some((v) => v.id === selected) === true
}

export function RevealDock({ view }: { view: View }): JSX.Element | null {
  const selected = useReveal((s) => s.selected)
  const select = useReveal((s) => s.select)
  const head = useRef<HTMLHeadingElement>(null)
  // Opening a view from the canvas moves focus here, so a keyboard user lands on what they opened.
  useEffect(() => { if (selected !== null) head.current?.focus() }, [selected])
  const r = revealOf(view)
  const v = r?.views.find((x) => x.id === selected) ?? null
  if (r === null || v === null) return null
  const others = r.views.filter((x) => x.id !== v.id)
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

      {/* Olumi's model consequence of their figure: core's effects, in core's words (the Team tab's own component). */}
      {effectsOf(v).length === 0 ? null : (
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
      </div>
    </section>
  )
}
