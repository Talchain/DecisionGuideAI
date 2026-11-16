/**
 * V12 "Compare views" in the main workspace (proposal 005, "The centre: member views"; Codex 16:52Z): after an authorised reveal, each member's
 * view side by side, their words, figures and whole view in words as core gives them, then core's differences in its three groups with the same
 * next steps as the Team dock (keep as a disagreement, agree to find out, commit). It stands over the canvas, beside the dock, and the canvas
 * stays mounted underneath, so "Back to the model" (or Esc) returns to the model exactly as it was.
 *
 * Gates are the data's, not this layout's: it draws nothing unless a reveal is authorised for this viewer (`revealedForYou`) and the View is for
 * this page's person; it reads only `collab.shared` and core's revealed differences. It closes itself the moment either stops holding.
 * Nothing is ranked, averaged or marked right; no backend change, no new data.
 */
import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useViewStore } from '../../store'
import type { View } from '../../client'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import { useUIStore } from '../../../stores/uiStore'
import { BODY } from '../../../olumiCore/team/ui'
import { typography } from '../../../styles/typography'
import { Figures } from '../../RevealDock'
import { useDockInset } from '../bands/KeyPill'
import { revealedForYou } from './differGroups'
import { FrameLines } from './FrameLines'
import { useCompare } from './useCompare'
import { COMPARE_WORDS, Differences } from './WhereWeDiffer'

type Shared = View['collab']['shared'][number]

/** One member's view as a column: their name, their words, their figures and their whole view in words, each only where core sends it. */
function Member({ v }: { v: Shared }): JSX.Element {
  const words = v.text.trim()
  return (
    <section className="grid content-start gap-3 rounded-xl border border-panel-border bg-panel p-4" data-testid={`compare-member-${v.id}`} data-by={v.by_id} aria-label={v.by}>
      <h3 className={`${typography.viewPanelBody} m-0 font-medium text-text-header`} data-testid={`compare-member-${v.id}-name`}>{v.by}</h3>
      {words !== '' && <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid={`compare-member-${v.id}-words`}>{words}</p>}
      <Figures v={v} at={`compare-member-${v.id}`} />
      <FrameLines at={`compare-member-${v.id}`} v={v} />
    </section>
  )
}

export function CompareViewsStage(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const past = useViewStore((s) => s.at)
  const refresh = useViewStore((s) => s.refresh)
  const me = useMe((s) => s.me)
  const open = useCompare((s) => s.open)
  const inset = useDockInset()
  const forPage = view !== null && isForThisPage(view, me) ? view : null
  const shown = open && sid !== null && forPage !== null && revealedForYou(forPage)
  // Closes itself when the gate stops holding (a reveal withdrawn, another person's page) or the scenario changes; a View still loading (null) waits.
  const opened = useRef<string | null>(null)
  useEffect(() => {
    if (!open) { opened.current = null; return }
    if (opened.current === null) opened.current = sid
    if (sid !== opened.current || (view !== null && !shown)) useCompare.getState().hide()
  }, [open, sid, view, shown])
  // Esc closes it (not an Esc meant for an open menu or dialog), and focus returns to the control that opened it, as the Strategy Overview does.
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!shown || typeof document === 'undefined') return
    const a = document.activeElement
    opener.current = a instanceof HTMLElement && a !== document.body ? a : document.querySelector<HTMLElement>('[data-testid="views-compare"]')
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('[role="menu"], [role="dialog"]') !== null) return
      e.preventDefault(); useCompare.getState().hide()
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      const o = opener.current
      if (o !== null && o.isConnected) o.focus({ preventScroll: true })
    }
  }, [shown])
  if (!shown) return null
  const v = forPage!
  const members = v.collab.shared.filter((x) => !x.skip)
  const hide = () => useCompare.getState().hide()
  // Commit opens the Team tab's commitment form beside the comparison (the row writes the draft; the form lives in the dock).
  const toCommit = () => useUIStore.getState().setActiveOutputTab('team')
  return (
    <div role="region" aria-label={COMPARE_WORDS.control} data-testid="compare-stage" className="absolute inset-y-0 left-0 z-[1250] overflow-y-auto bg-canvas" style={{ right: inset }}>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-6 pb-12 pt-16">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" data-testid="compare-back" onClick={hide}
            className={`${typography.viewPanelMeta} inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3 font-medium text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}>
            <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 flex-none" />{COMPARE_WORDS.back}
          </button>
          <h2 className={`${typography.viewPanelHeadline} m-0 text-text-header`} data-testid="compare-heading">{v.collab.heading}</h2>
        </div>
        {members.length === 0
          ? null
          : <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]" data-testid="compare-members">{members.map((m) => <Member key={m.id} v={m} />)}</div>}
        <fieldset disabled={past !== null} className="contents">
          <Differences sid={sid!} view={v} onWrote={refresh} wide onFocusCard={hide} onCommit={toCommit} />
        </fieldset>
      </div>
    </div>
  )
}
