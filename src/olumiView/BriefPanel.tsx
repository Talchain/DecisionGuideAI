/**
 * J1 step 4 (DL 8 Nov, Codex's order): on a scenario's first look (layout.ts isFirstLook), the dock is one focused panel, the brief's
 * account, instead of the tabs: the brief as the person wrote it, then what the model used from it, what Olumi inferred, what was left out
 * and what is not there yet, then Olumi's one question. Every item is core's own words (layout.ts briefAccountOf); the few labels are the
 * panel's. Core's own notes on what Olumi used, inferred and left out (ED-12) are not served yet, so the panel says that and composes none.
 * "All tabs" goes back to the dock as it was; the dock's own composer stays below it for a reply, and a reply sent from it shows here.
 */
import { useEffect, useRef } from 'react'
import { FileText } from 'lucide-react'
import { create } from 'zustand'
import { typography } from '../styles/typography'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { useViewStore } from './store'
import { briefAccountOf, isFirstLook } from './layout'
import { TurnInFlight } from './ViewChat'

/** The scenarios whose brief's account the person has left for the tabs, this session. */
export const useBriefPanelLeft = create<{ left: ReadonlySet<string> }>(() => ({ left: new Set() }))
export const leaveBriefPanel = (sid: string) => useBriefPanelLeft.setState((s) => ({ left: new Set([...s.left, sid]) }))

/** Whether the dock shows the brief's account now. */
export function useBriefPanelShown(): boolean {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const left = useBriefPanelLeft((s) => (sid === null ? true : s.left.has(sid)))
  return sid !== null && !left && isFirstLook(view)
}

const list = (items: readonly string[]) => items.join(', ')

export function BriefPanel(): JSX.Element | null {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  // The turn is brought into view as it starts and as it ends: the brief's account fills the panel, so it would sit below the fold.
  const turnAt = useRef<HTMLDivElement | null>(null), turnKey = view?.turn == null ? null : `${view.turn.job}:${view.turn.status}`
  useEffect(() => { if (turnKey !== null) turnAt.current?.scrollIntoView?.({ block: 'nearest' }) }, [turnKey])
  if (view === null || sid === null || !isFirstLook(view)) return null
  const a = briefAccountOf(view)
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="brief-panel" aria-label="Your brief">
      <div className="space-y-2.5 px-3.5 pb-2 pt-3.5">
        <header className="space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`${typography.viewPanelBody} flex items-center gap-2 font-semibold text-text-header`}><FileText aria-hidden="true" className="h-4 w-4" />Your brief, as you wrote it</h2>
            <button type="button" className={`${typography.viewPanelMeta} flex-none cursor-pointer text-text-body underline underline-offset-2 hover:text-text-header`} data-testid="brief-panel-all-tabs" onClick={() => leaveBriefPanel(sid)}>All tabs</button>
          </div>
          {a.version === null && a.by === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="brief-panel-meta">{a.version}{a.version !== null && a.by !== null ? ' · ' : null}{a.by}</p>}
        </header>
        <blockquote className={`${typography.viewPanelBody} text-text-body`} data-testid="brief-panel-brief">“{a.brief}”</blockquote>
        <dl className={`${typography.viewPanelBody} space-y-1.5 text-text-body`}>
          {a.used.length === 0 ? null : <div data-testid="brief-panel-used"><dt className="inline font-semibold text-text-header">Used: </dt><dd className="inline">{list(a.used)}.</dd></div>}
          {a.inferred.length === 0 ? null : <div data-testid="brief-panel-inferred"><dt className="inline font-semibold text-text-header">Inferred</dt> <dd className="inline">(dashed): {list(a.inferred)}. Yours to change.</dd></div>}
          {a.leftOut.length === 0 ? null : (
            <div data-testid="brief-panel-left-out"><dt className="inline font-semibold text-text-header">Left out: </dt>
              {/* Each part as the brief has it, in quotes (core's `quote`); a part not in the brief's words is named by its label, unquoted.
                  Core's note on why follows it. */}
              {a.leftOut.map((x) => (
                <dd key={x.id} className="inline" data-left-out={x.id}>
                  {x.quote !== null ? <>“<span data-view={`collab.records.${x.id}.quote`}>{x.quote}</span>”</> : <span data-view={`collab.records.${x.id}.label`}>{x.label}</span>}
                  {x.why === null ? '. ' : <>. <span className="text-text-light" data-view={`collab.records.${x.id}.why`}>{x.why}</span> </>}
                </dd>
              ))}
            </div>
          )}
          {!a.noAim && !a.noChances ? null : <div data-testid="brief-panel-not-yet"><dt className="inline font-semibold text-text-header">Not yet: </dt><dd className="inline">{a.noAim ? 'an aim' : null}{a.noAim && a.noChances ? ', ' : null}{a.noChances ? 'chances' : null}.</dd></div>}
        </dl>
        <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="brief-panel-notes-missing">{a.leftOut.some((x) => x.why !== null) ? 'Olumi’s own notes on why it used or inferred each part are not available yet.' : 'Olumi’s own notes on why it used, inferred or left out each part are not available yet.'}</p>
      </div>
      {a.question === null ? null : (
        <div className="mt-auto space-y-2 bg-[#FEF9F3] px-3.5 pb-1 pt-3" data-testid="brief-panel-question">
          <p className={`${typography.viewPanelBody} flex gap-2 text-text-header`}><OlumiAiIcon size={16} aria-hidden="true" className="mt-0.5 flex-none" /><span>{a.question.text}</span></p>
        </div>
      )}
      {/* A reply sent from this panel is a turn core holds (the View's `turn`): their words, core's status while it runs, and core's plain
          reason with Try again when it ends unanswered, here where it was sent (the same turn the Olumi tab draws, ViewChat TurnInFlight). */}
      {view.turn == null ? null : <div ref={turnAt} className="bg-[#FEF9F3] px-3.5 pb-2 pt-1" data-testid="brief-panel-turn"><TurnInFlight turn={view.turn} me={view.you_id ?? null} /></div>}
    </section>
  )
}
