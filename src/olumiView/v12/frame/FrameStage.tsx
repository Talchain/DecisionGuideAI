import { useEffect, useLayoutEffect, useRef } from 'react'
import { useViewStore } from '../../store'
import { OkIcon } from '../../look/icons'
import { typography } from '../../../styles/typography'
import { useOverview } from '../../strategy/overview/useOverview'
import { useCompare } from '../views/useCompare'
import { useDockInset } from '../bands/KeyPill'
import { FramePage, FRAME_WORDS } from './FramePage'
import { useFrameStage } from './useFrameStage'

/** The header's opener, beside the Strategy Overview's: pressed while the Frame stands over the canvas; drawn only with a model. */
export function FrameOpener(): JSX.Element | null {
  const has = useViewStore((s) => s.view?.model != null)
  const open = useFrameStage((s) => s.open)
  if (!has) return null
  return (
    <button type="button" aria-pressed={open} data-testid="frame-opener"
      onClick={() => { if (open) useFrameStage.getState().hide(); else { useOverview.getState().hide(); useCompare.getState().hide(); useFrameStage.getState().show() } }}
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-0.5 ${typography.viewPanelMeta} text-text-body transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50 ${open ? 'border-text-header bg-panel-hover text-text-header' : 'border-panel-border bg-transparent hover:bg-panel-hover'}`}>
      <OkIcon id="goal" size={14} decorative inherit />{FRAME_WORDS.question}
    </button>
  )
}

/**
 * The Frame over the canvas region only: the same box the Compare stage uses, so the dock (chat) stays visible and usable. It opens by itself
 * once per scenario load (first time a model is there); one stage at a time (the Overview or Compare opening shuts it); Esc closes it and
 * focus returns to the opener.
 */
export function FrameStage(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const open = useFrameStage((s) => s.open)
  const armedFor = useFrameStage((s) => s.armedFor)
  const overview = useOverview((s) => s.open)
  const compare = useCompare((s) => s.open)
  const inset = useDockInset()
  const hasModel = view?.model != null
  useEffect(() => { if (hasModel && sid !== null && armedFor !== sid) useFrameStage.getState().arm(sid) }, [hasModel, sid, armedFor])
  useEffect(() => { if (overview || compare) useFrameStage.getState().hide() }, [overview, compare])
  const shown = open && hasModel && !overview && !compare
  const box = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => { if (box.current !== null) box.current.style.right = `${inset}px` }, [inset, shown])
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!shown || typeof document === 'undefined') return
    const a = document.activeElement
    opener.current = a instanceof HTMLElement && a !== document.body ? a : document.querySelector<HTMLElement>('[data-testid="frame-opener"]')
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (e.target instanceof Element && e.target.closest('[role="menu"], [role="dialog"], [data-testid="lens-bar"]') !== null) return
      e.preventDefault(); useFrameStage.getState().hide()
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      const o = opener.current
      if (o !== null && o.isConnected) o.focus({ preventScroll: true })
    }
  }, [shown])
  if (!shown) return null
  return <div ref={box} role="region" aria-label={FRAME_WORDS.question} data-testid="frame-stage" className="absolute inset-y-0 left-0 z-[1250] overflow-y-auto bg-canvas"><FramePage view={view!} onClose={() => useFrameStage.getState().hide()} /></div>
}
