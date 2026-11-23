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
import { OkIcon } from '../../look/icons'
import { useAnchoredTip } from '../../look/Tip'
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
  const { handlers, tip, describedBy, dismiss } = useAnchoredTip(shown ? RETURN_TO_BEFORE : SHOW_IN_WORKSPACE)
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
    <div className="flex flex-wrap items-center gap-1" data-testid="show-in-workspace">
      <button ref={button} type="button" data-shown={shown || undefined} aria-busy={busy || undefined} data-testid="show-in-workspace-button"
        onClick={() => { dismiss(); void (shown ? returnToBefore() : showInWorkspace(turn, next)) }}
        {...handlers} aria-describedby={describedBy}
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 ${shown ? 'text-text-body' : 'text-text-light'} hover:bg-panel-hover hover:text-text-body`}>
        {shown
          ? <OkIcon id="back" size={14} decorative />
          : <OkIcon id="show-in-workspace" size={14} decorative />}
        {/* v10 review item 6: an icon in the reply's one row; the words stay for readers and on hover (the Return words are drawn while shown). */}
        <span className={shown ? '' : 'sr-only'}>{shown ? RETURN_TO_BEFORE : SHOW_IN_WORKSPACE}</span>
      </button>
      {tip}
      {said === null ? null : <span role="status" className={`${typography.viewPanelMeta} text-text-body`} data-testid="show-in-workspace-said">{said}</span>}
    </div>
  )
}
