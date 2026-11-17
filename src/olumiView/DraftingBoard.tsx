/**
 * WHILE A BRIEF IS DRAFTING, THE BOARD SAYS SO, IN CORE'S WORDS (plan v3: the drafting state checked in a real browser; AI jobs, core API
 * v1.26, 8 Nov). Core accepts a brief at once and drafts it in the server; the View's `draft` carries the job's state. The empty board shows
 * `draft.words` verbatim (the stage while it runs, "Reading the brief" → "Building the model" → "Running the analysis and guidance"; the
 * plain reason when it failed or was lost), announced as a status, with the seconds since the brief was ACCEPTED (core's `started`, so a
 * reload or another device counts from the same moment; a line that never moves reads as stuck, PL 4 Nov). Nothing streams, nothing is
 * estimated, and no word here is the page's own but the Try again control. A failed or lost draft offers Try again: a new attempt on the
 * saved brief (a new op); so does a stopped one, whose words core says ('You stopped this draft…'). While it drafts, its author sees core's
 * Stop (`draft.stop`, label and hover verbatim; core API v1.34): it stops the job and the View is read again. The poller reads the View about every 1.5 s while it drafts (poll.ts).
 */
import { useEffect, useLayoutEffect, useState } from 'react'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { stopDraft, tryAgain, useViewChat } from './ViewChat'
import { OkIcon } from './look/icons'
import { useViewStore } from './store'
import type { View } from './client'
import { EARLY_FAILED, earlyOf } from './early'
import { EarlyAnswer } from './EarlyAnswer'

type Draft = NonNullable<View['draft']>

/** The board shows a first draft that is running, or one that failed, was lost or was stopped before any model or proposal exists. */
export const boardDraftOf = (view: View | null): Draft | null => {
  const d = view?.draft ?? null
  if (d === null || view === null || view.version !== null || view.proposal !== null || typeof d.words !== 'string') return null
  return d.status === 'drafting' || d.status === 'failed' || d.status === 'lost' || d.status === 'stopped' ? d : null
}

export function DraftingBoard(): JSX.Element | null {
  const draft = useViewStore((s) => (s.at === null ? boardDraftOf(s.view) : null))
  return draft === null ? null : <Drafting draft={draft} />
}

function Drafting({ draft }: { draft: Draft }): JSX.Element {
  const brief = useViewStore((s) => s.view?.brief ?? null)
  const running = draft.status === 'drafting'
  const busy = useViewChat((s) => s.busy)
  const [now, setNow] = useState(() => Date.now())
  const [right, setRight] = useState(0)
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running])
  useLayoutEffect(() => { const measure = () => setRight(measureDockInset()); measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])
  const early = earlyOf(draft)
  const from = draft.started === undefined ? Number.NaN : Date.parse(draft.started)
  const s = Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 1000)) : null
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center justify-center px-6" style={{ right }} data-testid="view-drafting-board" data-draft={draft.status}>
      <div role="status" aria-live="polite" className={`pointer-events-auto space-y-2 rounded-lg border border-panel-border bg-panel px-6 py-5 text-center shadow-sm ${early === null ? 'max-w-[420px]' : 'max-h-[80vh] max-w-[560px] overflow-y-auto'}`}>
        <p className={`${typography.panelHeader} flex items-center justify-center gap-2 text-text-header`}>
          {running ? <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" /> : null}
          <span data-view="draft.words" data-testid="view-drafting-words">{draft.words}</span>
        </p>
        {early === null ? null : <EarlyAnswer text={early} testid="view-drafting-early" />}
        {early === null || running ? null : <p className={`${typography.viewPanelBody} text-text-body`} data-testid="view-drafting-early-failed">{EARLY_FAILED}</p>}
        {/* 17 Nov (the calm panel): Stop is a quiet icon beside the timer, not a box. Core's own label is its name and its title the hover. */}
        {running
          ? (s === null && draft.stop == null ? null : (
            <div className="flex items-center justify-center gap-1">
              {s === null ? null : <p className={`${typography.viewPanelMeta} text-text-light tabular-nums`} aria-hidden="true" data-testid="view-drafting-seconds">{s} s</p>}
              {draft.stop == null ? null : (
                <button type="button" disabled={busy} title={draft.stop.title} aria-label={draft.stop.label} data-view="draft.stop.label" data-testid="view-drafting-stop" onClick={() => void stopDraft()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header disabled:cursor-not-allowed">
                  <OkIcon id="stop" size={14} decorative /><span className="sr-only">{draft.stop.label}</span>
                </button>
              )}
            </div>
          ))
          : <button type="button" disabled={busy} data-testid="view-drafting-again" onClick={() => void tryAgain()}
              className="min-h-[44px] rounded-md border border-panel-border px-4 text-info hover:bg-panel-hover disabled:text-text-light disabled:cursor-not-allowed">Try again</button>}
        {running || typeof brief !== 'string' || brief.trim() === '' ? null : <details className="text-left" data-testid="view-draft-brief"><summary className="cursor-pointer text-info">Your brief</summary><p className="max-h-[28vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">{brief}</p></details>}
      </div>
    </div>
  )
}
