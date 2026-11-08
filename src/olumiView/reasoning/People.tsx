/**
 * The people strip (the redesign's Z4; DL ruling 2, 7 Nov: read-only, shared or revealed views only, core's effects played with no AI
 * call; the Team tab stays the place to act). Disagreement made visible without averaging or deciding it:
 *   - one chip per view core shares with this viewer (`collab.shared`, a skipped view has nothing to play), up to 3 then "+N": a neutral
 *     initial, the person's name as core gives it, and one mark per kind of effect their figures have on the Run, by shape only (no colour,
 *     no stance), core's words for it (`collab.effect_headings`) on hover and for a reader;
 *   - hover or focus a chip: the cards their figures sit on are ringed on the canvas;
 *   - press a chip (one at a time): their figures and what each does to the Run, drawn by the Team tab's own components (`Figures`,
 *     `Effects`), every word core's: the same fact said by one component.
 * Nothing for a viewer core holds back (`gated`: core withholds the views until they give or skip their own), and nothing before anyone
 * has shared. No write: the strip reads the View it is given.
 */
import { useEffect, useState } from 'react'
import type { View } from '../client'
import { effectHeadingsOf, effectsOf, type ViewEffectRun } from '../standin'
import { Effects, Figures } from '../../olumiCore/team/ViewsPanel'
import { ringFrom } from './tabRing'
import { TYPE } from '../port/type'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'

export const PEOPLE_SHOWN = 3
type Status = ViewEffectRun['status']
const STATUSES: readonly Status[] = ['changes', 'moves', 'same']
/** Each effect's mark, by shape alone in the ink colour (no stance, no blue): solid, hollow, a dash. */
const MARK: Record<Status, string> = {
  changes: 'h-2 w-2 rounded-full bg-text-header',
  moves: 'h-2 w-2 rounded-full border border-text-header',
  same: 'h-0.5 w-2 bg-text-header',
}

/** The views the strip draws: core's shared views for a viewer it does not hold back, a skipped one left out (nothing to play). */
export function peopleOf(view: View | null): View['collab']['shared'] {
  if (view === null || view.gated || effectHeadingsOf(view.collab) === null) return []
  return view.collab.shared.filter((v) => !v.skip)
}

export function People({ view }: { view: View | null }) {
  const people = peopleOf(view)
  const [pressed, setPressed] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const cards = new Set((view?.model?.cards ?? []).map((c) => c.id))
  const about = (id: number | null) => (id === null ? [] : effectsOf(people.find((v) => v.id === id) ?? {}).map((e) => e.quantity).filter((q) => cards.has(q)))
  const key = [...new Set([...about(hover), ...about(focus)])].join('\n')
  useEffect(() => { ringFrom('people', key === '' ? [] : key.split('\n')) }, [key])
  useEffect(() => () => ringFrom('people', []), [])
  if (view === null || people.length === 0) return null
  const c = view.collab, headings = effectHeadingsOf(c)!
  const shown = people.slice(0, PEOPLE_SHOWN), more = people.length - shown.length
  const open = people.find((v) => v.id === pressed) ?? null
  return (
    <section data-testid="view-reasoning-people" aria-label={c.heading} className="space-y-2">
      <p className={`${TYPE.meta} m-0 text-text-body`} data-view="collab.heading">{c.heading}</p>
      <div className="flex flex-wrap items-center gap-2">
        {shown.map((v) => {
          const kinds = STATUSES.filter((st) => effectsOf(v).some((e) => !('refused' in e) && (e as ViewEffectRun).status === st))
          return (
            <button key={v.id} type="button" aria-pressed={pressed === v.id} data-people-chip={v.id} onClick={() => setPressed((p) => (p === v.id ? null : v.id))}
              onMouseEnter={() => setHover(v.id)} onMouseLeave={() => setHover((h) => (h === v.id ? null : h))}
              onFocus={() => setFocus(v.id)} onBlur={() => setFocus((f) => (f === v.id ? null : f))}
              className={`${TYPE.meta} inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border px-2 text-text-header ${pressed === v.id ? 'border-text-header bg-panel-hover' : 'border-panel-border hover:bg-panel-hover'} ${ACTION_FOCUS}`}>
              <span aria-hidden="true" className="inline-grid h-6 w-6 flex-none place-items-center rounded-full border border-panel-border bg-canvas text-text-body">{v.by.slice(0, 1).toUpperCase()}</span>
              <span data-people-by="">{v.by}</span>
              {kinds.map((st) => <span key={st} role="img" aria-label={headings[st]} title={headings[st]} data-people-status={st} className={`inline-block flex-none ${MARK[st]}`} />)}
            </button>
          )
        })}
        {more <= 0 ? null : <span className={`${TYPE.meta} tabular-nums text-text-body`} data-people-more data-count>{`+${more}`}</span>}
      </div>
      {open === null ? null : (
        <div className="space-y-1" data-testid="view-reasoning-people-open" data-people-open={open.id}>
          <Figures at={`reasoning-people-${open.id}`} figures={open.figures} />
          <Effects at={`reasoning-people-${open.id}`} view={view} by={open.by_id} figures={open.figures} effects={effectsOf(open)} headings={headings} alone />
        </div>
      )}
    </section>
  )
}
