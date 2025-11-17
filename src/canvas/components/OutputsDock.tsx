import { useEffect } from 'react'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore } from '../store'

type OutputsDockTab = 'results' | 'insights' | 'compare' | 'diagnostics'

interface OutputsDockState {
  isOpen: boolean
  activeTab: OutputsDockTab
}

interface OutputsDockProps {
  onShowResults?: () => void
}

const STORAGE_KEY = 'canvas.outputsDock.v1'

const OUTPUT_TABS: { id: OutputsDockTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'insights', label: 'Insights' },
  { id: 'compare', label: 'Compare' },
  { id: 'diagnostics', label: 'Diagnostics' },
]

export function OutputsDock({ onShowResults }: OutputsDockProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<OutputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'results',
  })
  const runMeta = useCanvasStore(s => s.runMeta)
  const diagnostics = runMeta.diagnostics
  const correlationIdHeader = runMeta.correlationIdHeader
  const effectiveCorrelationId = correlationIdHeader || diagnostics?.correlation_id
  const hasTrim = diagnostics?.trims === 1
  const hasDiagnostics = !!diagnostics
  const correlationMismatch =
    diagnostics?.correlation_id &&
    correlationIdHeader &&
    diagnostics.correlation_id !== correlationIdHeader

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const value = state.isOpen ? 'var(--dock-right-expanded)' : 'var(--dock-right-collapsed)'
    root.style.setProperty('--dock-right-offset', value)

    return () => {
      root.style.setProperty('--dock-right-offset', '0rem')
    }
  }, [state.isOpen])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-in-out'

  const toggleOpen = () => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }))
  }

  const handleTabClick = (tab: OutputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))
  }

  return (
    <aside
      className={`${transitionClass} fixed right-0 border-l border-gray-200 bg-white flex flex-col`}
      style={{
        width: state.isOpen ? 'var(--dock-right-expanded, 24rem)' : 'var(--dock-right-collapsed, 2.5rem)',
        top: 'var(--topbar-h)',
        bottom: 'var(--bottombar-h)',
      }}
      aria-label="Outputs dock"
      data-testid="outputs-dock"
    >
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-2 py-2">
          {state.isOpen && (
            <span className="mr-2 text-xs font-medium text-gray-600 truncate" aria-live="polite">
              {OUTPUT_TABS.find(tab => tab.id === state.activeTab)?.label ?? ''}
            </span>
          )}
          <button
            type="button"
            onClick={toggleOpen}
            className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 text-xs text-gray-600 hover:bg-gray-100"
            aria-label={state.isOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
          >
            {state.isOpen ? '>' : '<'}
          </button>
        </div>

        {state.isOpen && (
          <nav
            className="flex gap-1 px-2 py-2 border-t border-gray-100"
            aria-label="Outputs sections"
          >
            {OUTPUT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                data-testid={tab.id === 'diagnostics' ? 'outputs-dock-tab-diagnostics' : undefined}
                className={`flex-1 px-2 py-1 rounded text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {state.isOpen && (
        <div className="flex-1 px-3 py-3 text-xs text-gray-500 space-y-3 overflow-y-auto" data-testid="outputs-dock-body">
            {state.activeTab === 'results' && (
              <div className="space-y-2">
                <p>
                  Run results, KPIs, confidence, and driver breakdowns are available in the
                  analysis panel.
                </p>
                {onShowResults && (
                  <button
                    type="button"
                    onClick={onShowResults}
                    className="inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                    data-testid="outputs-dock-open-results"
                  >
                    Open results panel
                  </button>
                )}
              </div>
            )}
            {state.activeTab === 'insights' && (
              <div className="space-y-2">
                <p>
                  Key drivers, narratives, and detailed explanations live in the
                  results panel&apos;s Latest tab today.
                </p>
                {onShowResults && (
                  <button
                    type="button"
                    onClick={onShowResults}
                    className="inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                  >
                    Open results panel
                  </button>
                )}
              </div>
            )}
            {state.activeTab === 'compare' && (
              <div className="space-y-2">
                <p>
                  Side-by-side comparisons and EdgeDiff tables are available via the
                  History and Compare tabs inside the results panel.
                </p>
                {onShowResults && (
                  <button
                    type="button"
                    onClick={onShowResults}
                    className="inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                  >
                    Open results panel
                  </button>
                )}
              </div>
            )}
            {state.activeTab === 'diagnostics' && (
              <div className="space-y-3" data-testid="diagnostics-tab">
                <div className="text-xs font-medium text-gray-700">
                  Streaming diagnostics
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between" data-testid="diag-resumes" title="Resumes: times the stream reconnected.">
                    <span className="text-gray-600">Resumes</span>
                    <span className="tabular-nums text-gray-900">{hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="diag-recovered" title="Recovered events: events caught up after a resume.">
                    <span className="text-gray-600">Recovered events</span>
                    <span className="tabular-nums text-gray-900">{hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="diag-trims" title="Buffer trimmed: older events were dropped to keep streaming responsive.">
                    <span className="text-gray-600">Buffer trimmed</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border" aria-label={hasTrim ? 'Buffer was trimmed' : 'Buffer was not trimmed'}>
                      {hasTrim ? (
                        <span className="bg-amber-50 text-amber-800 border-amber-200 px-1.5 py-0.5 rounded">Yes</span>
                      ) : (
                        <span className="text-gray-600 border-gray-200 px-1.5 py-0.5 rounded">No</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between" title="Correlation ID: include this when reporting issues.">
                    <span className="text-gray-600">Correlation ID</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[11px] text-gray-900 max-w-[10rem] truncate"
                        data-testid="diag-correlation-value"
                      >
                        {effectiveCorrelationId ?? '—'}
                      </span>
                      {effectiveCorrelationId && (
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                                navigator.clipboard.writeText(effectiveCorrelationId)
                              }
                            } catch {}
                          }}
                          className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 text-[11px] text-gray-700 hover:bg-gray-50"
                          data-testid="diag-correlation-copy"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                  {correlationMismatch && (
                    <p
                      className="text-[11px] text-amber-700"
                      data-testid="diag-correlation-mismatch"
                    >
                      Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
                    </p>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">
                  For deeper engine instrumentation, use the on-canvas diagnostics overlay via
                  <code className="mx-1">?diag=1</code> and the debug tray configuration when needed.
                </p>
              </div>
            )}
          </div>
        )}
    </aside>
  )
}
