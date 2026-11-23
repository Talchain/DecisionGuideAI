/**
 * The header's opener for the Strategy Overview (strategy lane, 7 Nov; by agreement with the UI session, which owns the top bar): one
 * pressable control beside the scenario name, in core's words (`strategy.headings.overview`), pressed while the Overview stands in place
 * of the canvas stage. The UI session's three rules: the pressed state is `aria-pressed` with the system's pressed look (never Olumi's
 * blue), the scenario name's words and size are untouched, and the target is at least 24px. Nothing renders without core's key.
 */
import { useEffect, useRef } from 'react'
import { OkIcon } from '../../look/icons'
import { useViewStore } from '../../store'
import { TOOLBAR_LABEL } from '../../look/toolbar'
import { useOverview } from './useOverview'
import { useCompare } from '../../v12/views/useCompare'
import { useEscapeLayer } from '../../v12/edit/escapeLayers'

export function StrategyOverviewOpener(): JSX.Element | null {
  const words = useViewStore((s) => s.view?.strategy?.headings.overview ?? null)
  const open = useOverview((s) => s.open)
  if (words === null) return null
  return (
    <button
      type="button" aria-pressed={open} data-testid="strategy-overview-opener"
      onClick={() => (open ? useOverview.getState().hide() : (useCompare.getState().hide(), useOverview.getState().show()))}
      className={TOOLBAR_LABEL}
    >
      <OkIcon id="strategy-overview" size={14} decorative inherit />
      {words}
    </button>
  )
}

/**
 * The Overview in place of the stage while it is open, as the approved board draws it (overview-1232): the full width under the top bar,
 * over the board and the outputs dock (both keep their place underneath and return as they were). Above the dock (fixed, 900) and the viewport controls (fixed, 1100), under
 * the top bar (fixed, 3000), so the scenario name and the opener stay in reach.
 */
export function StrategyOverviewStage({ children }: { children: (view: NonNullable<ReturnType<typeof useViewStore.getState>['view']>, close: () => void) => JSX.Element }): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const open = useOverview((s) => s.open)
  const shown = open && view !== null && view.strategy !== undefined
  // Esc closes the page, and however it closes (Esc, Close, the opener pressed again), focus goes back to the control that opened it.
  const opener = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!shown || typeof document === 'undefined') return
    const a = document.activeElement
    opener.current = a instanceof HTMLElement && a !== document.body ? a : document.querySelector<HTMLElement>('[data-testid="strategy-overview-opener"]')
    // An Esc meant for an open menu or dialog (the header's Explore menu) closes that alone.
    return () => {
      const o = opener.current
      if (o !== null && o.isConnected) o.focus({ preventScroll: true })
    }
  }, [shown])
  // Escape closes it by the one shared rule (v12/edit/escapeLayers.ts): a menu or dialog over it handles its own press first.
  useEscapeLayer(shown, () => useOverview.getState().hide())
  if (!shown) return null
  return <div className="fixed inset-0 z-[1200] bg-panel pt-[52px]" data-testid="strategy-overview-stage">{children(view!, () => useOverview.getState().hide())}</div>
}
