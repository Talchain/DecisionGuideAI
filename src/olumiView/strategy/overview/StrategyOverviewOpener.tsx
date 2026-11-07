/**
 * The header's opener for the Strategy Overview (strategy lane, 7 Nov; by agreement with the UI session, which owns the top bar): one
 * pressable control beside the scenario name, in core's words (`strategy.headings.overview`), pressed while the Overview stands in place
 * of the canvas stage. The UI session's three rules: the pressed state is `aria-pressed` with the system's pressed look (never Olumi's
 * blue), the scenario name's words and size are untouched, and the target is at least 24px. Nothing renders without core's key.
 */
import { LayoutList } from 'lucide-react'
import { useViewStore } from '../../store'
import { typography } from '../../../styles/typography'
import { useOverview } from './useOverview'

export function StrategyOverviewOpener(): JSX.Element | null {
  const words = useViewStore((s) => s.view?.strategy?.headings.overview ?? null)
  const open = useOverview((s) => s.open)
  if (words === null) return null
  return (
    <button
      type="button" aria-pressed={open} data-testid="strategy-overview-opener"
      onClick={() => (open ? useOverview.getState().hide() : useOverview.getState().show())}
      className={`inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-0.5 ${typography.viewPanelMeta} text-text-body transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/50 ${open ? 'border-text-header bg-panel-hover text-text-header' : 'border-panel-border bg-transparent hover:bg-panel-hover'}`}
    >
      <LayoutList aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
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
  if (!open || view === null || view.strategy === undefined) return null
  return <div className="fixed inset-0 z-[1200] bg-panel pt-[52px]" data-testid="strategy-overview-stage">{children(view, () => useOverview.getState().hide())}</div>
}
