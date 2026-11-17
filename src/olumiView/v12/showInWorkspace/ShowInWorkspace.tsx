/**
 * "Show in the workspace" under an Olumi reply: one quiet control that shows, on the canvas, the cards the reply is about (targets.ts),
 * unfolding what hides them, and then reads "Return to where you were" and puts the person back exactly there (show.ts). It points into
 * the person's own model and adds no answer; nothing is written and no AI is called.
 *
 * It is the SAME button before and after, so keyboard focus stays on it: a click or the Return key goes back. No key is listened for
 * anywhere else. It is not drawn where nothing the reply names is in the reader's View, or where there is no canvas to show it in; a
 * reply about several cards, some of which this reader is not sent, shows the ones they are sent and says nothing of the rest.
 *
 * Both labels are this control's chrome. Focus is the page's own neutral ring (`*:focus-visible`), not one of its own.
 */
import { useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, LocateFixed } from 'lucide-react'
import { useHasShowCamera } from './cameraPort'
import { typography, useInputsOpen, useLevel, useViewStore } from './deps'
import { leave, returnToBefore, showInWorkspace, useShown } from './show'
import { planShow, type Next } from './targets'

export const SHOW_IN_WORKSPACE = 'Show in the workspace'
export const RETURN_TO_BEFORE = 'Return to where you were'

export function ShowInWorkspace({ turn, next }: { turn: number; next: Next | null }): JSX.Element | null {
  const canvas = useHasShowCamera()
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const level = useLevel(), inputsOpen = useInputsOpen((s) => s.open)
  const plan = useMemo(() => planShow(view, next, { sid, level, inputsOpen }), [view, next, sid, level, inputsOpen])
  const shown = useShown((s) => s.turn === turn)
  const said = useShown((s) => (s.said !== null && s.said.turn === turn ? s.said.words : null))
  const busy = useShown((s) => s.busy && s.turn === turn)
  useEffect(() => () => leave(turn), [turn])
  // The show changes the reply above this control (its "About" chips name the unfolded cards), which can push the control out of the
  // panel's view just when it has become the way back. Through its own show and return, and never otherwise, it is kept in view.
  const button = useRef<HTMLButtonElement>(null), was = useRef(shown)
  useEffect(() => {
    const flipped = was.current !== shown
    was.current = shown
    if (!flipped && !busy) return
    const el = button.current
    if (el !== null && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' })
  }, [shown, busy, view])
  if (!canvas || (plan === null && !shown)) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="show-in-workspace">
      <button ref={button} type="button" data-shown={shown || undefined} data-testid="show-in-workspace-button"
        onClick={() => { void (shown ? returnToBefore() : showInWorkspace(turn, next)) }}
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 ${shown ? 'text-text-body' : 'text-text-light'} hover:bg-panel-hover hover:text-text-body`}>
        {shown
          ? <ArrowLeft className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} aria-hidden="true" />
          : <LocateFixed className="h-3.5 w-3.5 flex-none" strokeWidth={1.75} aria-hidden="true" />}
        {shown ? RETURN_TO_BEFORE : SHOW_IN_WORKSPACE}
      </button>
      {said === null ? null : <span role="status" className={`${typography.viewPanelMeta} text-text-body`} data-testid="show-in-workspace-said">{said}</span>}
    </div>
  )
}
