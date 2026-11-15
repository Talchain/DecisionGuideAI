/**
 * UI restore stage 1, row 4 (DL ruling 10 Nov): the previous product's welcome. A scenario waiting for its brief shows Olumi's logo and one
 * composer, centred on the empty canvas left of the dock's rail; the composer is this lane's own (ViewComposer), so the brief goes to core's
 * brief route exactly as it did from the dock. No attach and no "Structure it": core has no route for either on a first brief. It leaves
 * the moment the brief is sent (the board then says the draft is running, DraftingBoard) or a model or proposal exists.
 */
import { useLayoutEffect, useState } from 'react'
import { create } from 'zustand'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { useViewStore, type ViewStatus } from './store'
import { typography } from '../styles/typography'
import { useCanvasStore } from '../canvas/store'
import type { View } from './client'
import { boardDraftOf } from './DraftingBoard'
import { takesBrief, ViewComposer } from './ViewChat'
import { holdsViewDrawing, retryViewDraw, useViewDrawState } from './canvas'

/** Whether the scenario on screen is waiting for its brief: core holds no scenario for it (a new one, not yet named or named), or holds
 *  one with no model and no proposal. Decided only once the View store is the scenario on screen's, never while another's View is held
 *  (a cold reload decides nothing until then). */
export const awaitsBriefOf = (s: { uuid: string | null; sid: string | null; view: View | null }, onScreen: string | null): boolean =>
  s.uuid === onScreen && (s.sid === null || (s.view !== null && s.view.version === null && s.view.proposal === null && takesBrief(s.sid, s.view) && boardDraftOf(s.view) === null))

/** The canvas's words while a scenario's model is being read and drawn, and when a failed read gave no reason of its own. */
export const READING_WORDS = 'Opening this scenario…', READ_FAILED_WORDS = 'Olumi could not open this scenario just now.'
/** Said when the scenario was read but its model could not be drawn (the layout engine would not load): the saved scenario is intact. */
export const DRAW_FAILED_WORDS = 'Olumi could not draw this scenario just now. Your scenario is saved.'

/**
 * What the canvas says while the scenario on screen opens, from the moment core holds it until its model is ON the canvas (14 Nov, cold
 * reopen: the line left as soon as the View was read, and the canvas then stood empty with no words while the layout engine loaded and the
 * board was first laid out and drawn). 'reading' while its View is read, and on, once read, until the canvas holds the View's drawing
 * (`drawn`); 'error' when the read failed with no View. Null for another scenario's View, a past version, a View with no model (a
 * scenario waiting for its brief, or a draft running: the welcome or the drafting board speak there), and once the model is drawn.
 */
const readingOf = (s: { uuid: string | null; sid: string | null; view: View | null; at: number | null; status: ViewStatus }, onScreen: string | null, drawn: boolean, drawFailed = false): 'reading' | 'error' | 'draw' | null => {
  if (s.at !== null || s.uuid !== onScreen || s.sid === null) return null
  if (s.view === null) return s.status === 'error' ? 'error' : 'reading'
  if ((s.view.model?.cards.length ?? 0) === 0 || drawn) return null
  return drawFailed ? 'draw' : 'reading'
}

/** Whether the welcome (and so its composer) is wanted for the scenario on screen. */
function useWelcomeWanted(): boolean {
  const onScreen = useCanvasStore((s) => s.currentScenarioId ?? null)
  return useViewStore((s) => s.at === null && awaitsBriefOf(s, onScreen))
}
/** True while a welcome is MOUNTED and showing its composer (set by it, so a dock drawn without a welcome keeps its own composer). */
const useWelcomeUp = create<{ up: boolean }>(() => ({ up: false }))

/** The dock's composer, drawn only while the welcome's is on the canvas: a blank scenario's rail showed a second brief box that filled the
 *  first (pre-screen row 22, DL 10 Nov: one brief box on screen). */
export function DockComposer(): JSX.Element | null {
  return useWelcomeUp((s) => s.up) ? null : <ViewComposer />
}

export function ViewWelcome(): JSX.Element | null {
  const onScreen = useCanvasStore((s) => s.currentScenarioId ?? null)
  const show = useWelcomeWanted()
  useLayoutEffect(() => { useWelcomeUp.setState({ up: show }); return () => useWelcomeUp.setState({ up: false }) }, [show])
  const [right, setRight] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setRight(measureDockInset())
    measure()
    window.addEventListener('resize', measure); window.addEventListener('outputs-dock-opened', measure)
    const t = setInterval(measure, 500)
    return () => { clearInterval(t); window.removeEventListener('resize', measure); window.removeEventListener('outputs-dock-opened', measure) }
  }, [])
  // Pre-screen row 9 (DL 10 Nov): once core holds the scenario and its model is not on the canvas yet (right after Send on the brief, or a
  // cold open, through the read and then the first drawing), the canvas says so; a read that failed says why, with a retry. Never a blank
  // canvas with no words. One element throughout: ViewCanvas keeps this mounted until the drawing is on the canvas (readingOf).
  const drawn = useCanvasStore((s) => holdsViewDrawing(s.nodes))
  const drawFailed = useViewDrawState((s) => s.failed)
  const reading = useViewStore((s) => readingOf(s, onScreen, drawn, drawFailed))
  const error = useViewStore((s) => s.error)
  const [again, setAgain] = useState(false)
  if (reading !== null) return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center justify-center px-6" style={{ right }} data-testid="view-reading" data-reading={reading}>
      <div role={reading === 'reading' ? 'status' : 'alert'} aria-live="polite" className={`${typography.viewPanelBody} pointer-events-auto max-w-[420px] space-y-3 rounded-lg border border-border bg-panel px-6 py-5 text-center text-text-body shadow-sm`}>
        <p data-testid="view-reading-words">{reading === 'error' ? error ?? READ_FAILED_WORDS : reading === 'draw' ? DRAW_FAILED_WORDS : READING_WORDS}</p>
        {reading === 'error' ? (
          <button type="button" disabled={again} data-testid="view-reading-again" className="min-h-[44px] rounded-md border border-border px-4 text-text-header hover:bg-panel-hover disabled:cursor-not-allowed"
            onClick={() => { setAgain(true); void useViewStore.getState().refresh().finally(() => setAgain(false)) }}>Try again</button>
        ) : null}
        {reading === 'draw' ? (
          <button type="button" data-testid="view-draw-again" className="min-h-[44px] rounded-md border border-border px-4 text-text-header hover:bg-panel-hover" onClick={retryViewDraw}>Try again</button>
        ) : null}
      </div>
    </div>
  )
  if (!show) return null
  return (
    <div className="pointer-events-none fixed inset-y-0 left-0 z-[5] flex items-center justify-center px-6" style={{ right }} data-testid="view-welcome">
      <div className="pointer-events-auto flex w-full max-w-[640px] flex-col items-center gap-6">
        <img src="/olumi-logo.png" alt="Olumi" className="h-10 w-auto" />
        <div className="w-full rounded-2xl border border-border bg-panel shadow-sm"><ViewComposer /></div>
      </div>
    </div>
  )
}
