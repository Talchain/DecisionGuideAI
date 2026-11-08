/**
 * WHILE A BRIEF IS DRAFTING, THE BOARD SAYS SO, IN CORE'S WORDS (plan v3: the drafting state checked in a real browser; AI jobs, core API
 * v1.26, 8 Nov). Core accepts a brief at once and drafts it in the server; the View's `draft` carries the job's state. The empty board shows
 * `draft.words` verbatim (the stage while it runs, "Reading the brief" → "Building the model" → "Running the analysis and guidance"; the
 * plain reason when it failed or was lost), announced as a status, with the seconds since the brief was ACCEPTED (core's `started`, so a
 * reload or another device counts from the same moment; a line that never moves reads as stuck, PL 4 Nov). Nothing streams, nothing is
 * estimated, and no word here is the page's own but the Try again control. A failed or lost draft offers Try again: a new attempt on the
 * saved brief (a new op). The poller reads the View about every 1.5 s while it drafts (poll.ts).
 */
import { useEffect, useLayoutEffect, useState } from 'react'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { tryAgain, useViewChat } from './ViewChat'
import { useViewStore } from './store'
import type { View } from './client'

type Draft = NonNullable<View['draft']>

/** The board shows a first draft that is running, or one that failed or was lost before any model or proposal exists. */
export const boardDraftOf = (view: View | null): Draft | null => {
  const d = view?.draft ?? null
  if (d === null || view === null || view.version !== null || view.proposal !== null || typeof d.words !== 'string') return null
  return d.status === 'drafting' || d.status === 'failed' || d.status === 'lost' ? d : null
}

export function DraftingBoard(): JSX.Element | null {
  const draft = useViewStore((s) => (s.at === null ? boardDraftOf(s.view) : null))
  return draft === null ? null : <Drafting draft={draft} />
}

function Drafting({ draft }: { draft: Draft }): JSX.Element {
  const running = draft.status === 'drafting'
  const busy = useViewChat((s) => s.busy)
  const [now, setNow] = useState(() => Date.now())
  const [right, setRight] = useState(0)
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [running])
  useLayoutEffect(() => { const measure = () => setRight(measureDockInset()); measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])
  const from = draft.started === undefined ? Number.NaN : Date.parse(draft.started)
  const s = Number.isFinite(from) ? Math.max(0, Math.floor((now - from) / 1000)) : null
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center justify-center px-6" style={{ right }} data-testid="view-drafting-board" data-draft={draft.status}>
      <div role="status" aria-live="polite" className="pointer-events-auto max-w-[420px] space-y-2 rounded-lg border border-border bg-panel px-6 py-5 text-center shadow-sm">
        <p className={`${typography.panelHeader} flex items-center justify-center gap-2 text-text-header`}>
          {running ? <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" /> : null}
          <span data-view="draft.words" data-testid="view-drafting-words">{draft.words}</span>
        </p>
        {running
          ? (s === null ? null : <p className={`${typography.viewPanelMeta} text-text-light tabular-nums`} aria-hidden="true" data-testid="view-drafting-seconds">{s} s</p>)
          : <button type="button" disabled={busy} data-testid="view-drafting-again" onClick={() => void tryAgain()}
              className="min-h-[44px] rounded-md border border-border px-4 text-info hover:bg-panel-hover disabled:opacity-40">Try again</button>}
      </div>
    </div>
  )
}
