/**
 * WHILE A BRIEF IS DRAFTING, THE BOARD SAYS SO (plan v3: the drafting state checked in a real browser). Measured at 1232 on 7 Nov: for the
 * minutes a first model takes, the canvas (most of the screen, where the model will appear) stayed an empty dotted board, and the only sign
 * of work was a 12px line in the dock above the brief's own instructions. Now the empty board carries the drafting words, once, with the
 * seconds since the brief was sent (a line that never moves reads as stuck, PL 4 Nov); the dock keeps the sent brief, held. Nothing streams
 * and nothing is estimated: the words are the composer's own (DRAFTING_WORDS). A message being answered keeps the dock's "thinking" line.
 */
import { useEffect, useLayoutEffect, useState } from 'react'
import { typography } from '../styles/typography'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { DRAFTING_TITLE, DRAFTING_WORDS, takesBrief, useViewChat } from './ViewChat'
import { useViewStore } from './store'

export function DraftingBoard(): JSX.Element | null {
  const busy = useViewChat((s) => s.busy)
  const brief = useViewStore((s) => takesBrief(s.sid, s.view))
  // Until core answers the brief: the page then moves to the new scenario, and its first model takes the board.
  return busy && brief ? <Drafting /> : null
}

function Drafting(): JSX.Element {
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(started)
  const [right, setRight] = useState(0)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  useLayoutEffect(() => { const measure = () => setRight(measureDockInset()); measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }, [])
  const s = Math.floor((now - started) / 1000)
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center justify-center px-6" style={{ right }} data-testid="view-drafting-board">
      <div role="status" className="max-w-[420px] space-y-2 rounded-lg border border-border bg-panel px-6 py-5 text-center shadow-sm">
        <p className={`${typography.panelHeader} flex items-center justify-center gap-2 text-text-header`}>
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-info motion-safe:animate-pulse" />{DRAFTING_TITLE}
        </p>
        <p className={`${typography.viewPanelBody} text-text-body`}>{DRAFTING_WORDS}</p>
        <p className={`${typography.viewPanelMeta} text-text-light tabular-nums`} aria-hidden="true" data-testid="view-drafting-seconds">{s} s</p>
      </div>
    </div>
  )
}
