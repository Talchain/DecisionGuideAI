/**
 * OutputsDock - Canonical right-side outputs dock (CURRENT UX)
 *
 * ✅ ARCHITECTURE NOTE:
 * This is the **canonical Results UX** for the canvas. It provides a streamlined,
 * dock-based interface with multiple tabs:
 *
 * Tabs:
 * - Results: Inline summary with KPI headline and range chips
 * - Insights: Key drivers and narratives
 * - Compare: Side-by-side run comparison
 * - Diagnostics: Streaming diagnostics and correlation IDs
 *
 * This component supersedes the legacy ResultsPanel (src/canvas/panels/ResultsPanel.tsx),
 * which is NOT currently rendered in the main canvas flow.
 *
 * Features:
 * - Auto-opens on run completion/error
 * - Resizable width
 * - Persistent state in localStorage
 * - Syncs with `showResultsPanel` store flag for UI coordination
 */

import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import { BarChart3, Sparkles, Shuffle, Activity, Clock } from 'lucide-react'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore, selectResultsStatus, selectReport } from '../store'
import { loadRuns, type StoredRun } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { typography } from '../../styles/typography'
import type { GraphHealth } from '../validation/types'
import { selectScenarioLastRun } from '../shared/lastRun'
import { trackCompareOpened } from '../utils/sandboxTelemetry'
import { KPIHeadline } from './KPIHeadline'
import { RangeChips } from './RangeChips'
import { DecisionReviewPanel, type DecisionReviewStatus } from './DecisionReviewPanel'
import { isDecisionReviewEnabled } from '../../flags'

type OutputsDockTab = 'results' | 'insights' | 'compare' | 'diagnostics'

interface OutputsDockState {
  isOpen: boolean
  activeTab: OutputsDockTab
}

const STORAGE_KEY = 'canvas.outputsDock.v1'

const OUTPUT_TABS: { id: OutputsDockTab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'insights', label: 'Insights' },
  { id: 'compare', label: 'Compare' },
  { id: 'diagnostics', label: 'Diagnostics' },
]

function buildHealthStrings(graphHealth: GraphHealth | null) {
  if (!graphHealth) {
    return {
      label: 'Health: Unknown',
      detail: 'No recent health check. Run diagnostics to analyse this graph.',
    }
  }

  const totalIssues = graphHealth.issues.length
  const issuesPart = totalIssues > 0 ? ` • ${totalIssues} issues` : ''

  if (graphHealth.status === 'healthy') {
    return {
      label: 'Health: Good',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'warnings') {
    return {
      label: 'Health: Warnings',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  if (graphHealth.status === 'errors') {
    return {
      label: 'Health: Errors',
      detail: `Score: ${graphHealth.score}/100${issuesPart}`,
    }
  }

  return {
    label: 'Health: Unknown',
    detail: 'No recent health check. Run diagnostics to analyse this graph.',
  }
}

export function OutputsDock() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<OutputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'results',
  })

  // Phase 2 Sprint 1B: Slow-run UX feedback (20s/40s thresholds)
  const [slowRunMessage, setSlowRunMessage] = useState<string | null>(null)
  const runStartTimeRef = useRef<number | null>(null)

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
  const graphHealth = useCanvasStore(s => s.graphHealth)
  const setShowIssuesPanel = useCanvasStore(s => s.setShowIssuesPanel)
  const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const healthView = buildHealthStrings(graphHealth ?? null)
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)
  const isPreRun = !hasCompletedFirstRun
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const report = useCanvasStore(selectReport)

  const canonicalBands = report?.run?.bands ?? null
  const mostLikelyValue = canonicalBands ? canonicalBands.p50 : report?.results.likely ?? null
  const conservativeValue = canonicalBands ? canonicalBands.p10 : report?.results.conservative ?? null
  const optimisticValue = canonicalBands ? canonicalBands.p90 : report?.results.optimistic ?? null
  const resultUnits = report?.results.units
  const resultUnitSymbol = report?.results.unitSymbol
  const hasInlineSummary = Boolean(report && resultsStatus === 'complete')

  const decisionReviewFlagOn = isDecisionReviewEnabled()
  const ceeReview = runMeta.ceeReview ?? null
  const ceeTrace = runMeta.ceeTrace ?? null
  const ceeError = runMeta.ceeError ?? null

  // Phase 1 Section 3: CEE degraded state (non-blocking overlay behavior)
  const ceeDegraded = ceeTrace?.degraded === true

  let decisionReviewStatus: DecisionReviewStatus | null = null
  if (decisionReviewFlagOn) {
    if (resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming') {
      decisionReviewStatus = 'loading'
    } else if (resultsStatus === 'complete' && report) {
      if (ceeError) {
        decisionReviewStatus = 'error'
      } else if (ceeReview) {
        decisionReviewStatus = 'ready'
      } else if (ceeTrace) {
        // CEE was engaged for this run (trace present) but no review/error was returned.
        // Treat this as an "empty" Decision Review state.
        decisionReviewStatus = 'empty'
      }
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const resolveTab = (): OutputsDockTab | null => {
        // Prefer real query string: /canvas?tab=insights
        const searchParams = new URLSearchParams(window.location.search)
        const fromSearch = searchParams.get('tab') as OutputsDockTab | null
        if (fromSearch && OUTPUT_TABS.some(tab => tab.id === fromSearch)) {
          return fromSearch
        }

        // Fallback: read from hash fragment: /#/canvas?tab=insights
        const hash = window.location.hash
        const qIndex = hash.indexOf('?')
        if (qIndex !== -1) {
          const hashQuery = hash.slice(qIndex + 1)
          const fromHash = new URLSearchParams(hashQuery).get('tab') as OutputsDockTab | null
          if (fromHash && OUTPUT_TABS.some(tab => tab.id === fromHash)) {
            return fromHash
          }
        }

        return null
      }

      const initialTab = resolveTab()
      if (!initialTab) return

      setState(prev => {
        if (prev.isOpen && prev.activeTab === initialTab) {
          return prev
        }
        return { ...prev, isOpen: true, activeTab: initialTab }
      })
    } catch {}
  }, [setState])

  useEffect(() => {
    // When results are running, complete, or error, ensure the dock is open on the Results tab.
    // Guard against infinite update loops by only updating when the state actually changes.
    if (resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming' || resultsStatus === 'complete' || resultsStatus === 'error') {
      setState(prev => {
        if (prev.isOpen && prev.activeTab === 'results') {
          return prev
        }
        return { ...prev, isOpen: true, activeTab: 'results' }
      })
    }
  }, [resultsStatus, setState])

  // Phase 2 Sprint 1B: Track elapsed time and show slow-run messages at 20s/40s
  // Cleanup ensures timers are always cleared on unmount or status change
  useEffect(() => {
    const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

    if (isRunning) {
      // Start tracking time when run begins
      if (runStartTimeRef.current === null) {
        runStartTimeRef.current = Date.now()
        setSlowRunMessage(null)
      }

      // Check elapsed time every 5 seconds
      const intervalId = setInterval(() => {
        if (runStartTimeRef.current === null) return

        const elapsedMs = Date.now() - runStartTimeRef.current
        const elapsedSeconds = Math.floor(elapsedMs / 1000)

        if (elapsedSeconds >= 40) {
          setSlowRunMessage('Still working...')
        } else if (elapsedSeconds >= 20) {
          setSlowRunMessage('Taking longer than expected...')
        }
      }, 5000)

      // Cleanup: always clear interval on unmount or status change
      return () => clearInterval(intervalId)
    } else {
      // Clear tracking when run completes/errors/cancels/navigates away
      runStartTimeRef.current = null
      setSlowRunMessage(null)
      // No cleanup function needed when not running (no interval to clear)
    }
  }, [resultsStatus])

  useEffect(() => {
    // When global Results visibility is toggled on (e.g. via toolbar, keyboard, or palette),
    // ensure the dock is open on the Results tab. We intentionally do not collapse the dock
    // when the flag is false to preserve the user's dock layout preferences.
    // Guard against infinite update loops by only updating when a change is needed.
    if (showResultsPanel) {
      setState(prev => {
        if (prev.isOpen && prev.activeTab === 'results') {
          return prev
        }
        return { ...prev, isOpen: true, activeTab: 'results' }
      })
    }
  }, [showResultsPanel, setState])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const value = state.isOpen ? 'var(--dock-right-expanded)' : 'var(--dock-right-collapsed)'
    root.style.setProperty('--dock-right-offset', value)

    return () => {
      root.style.setProperty('--dock-right-offset', '0rem')
    }
  }, [state.isOpen])
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('panel.results.width')
      if (!stored) return
      const parsed = Number(stored)
      if (!Number.isFinite(parsed)) return
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      if (!viewportWidth) return
      const minWidth = 280
      const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
      const clamped = Math.max(minWidth, Math.min(maxWidth, parsed))
      const root = document.documentElement
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
    } catch {}
  }, [])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-in-out'

  const toggleOpen = () => {
    setState(prev => {
      const nextIsOpen = !prev.isOpen
      // Keep showResultsPanel in sync primarily for highlighting & telemetry when
      // the dock is explicitly opened or closed.
      if (!nextIsOpen) {
        setShowResultsPanel(false)
      } else if (prev.activeTab === 'results') {
        setShowResultsPanel(true)
      }
      return { ...prev, isOpen: nextIsOpen }
    })
  }

  const handleTabClick = (tab: OutputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))

    // Treat the Results tab as the canonical "results visible" state for
    // highlight overlays and results-viewed telemetry.
    if (tab === 'results') {
      setShowResultsPanel(true)
    } else {
      setShowResultsPanel(false)
    }

    if (tab === 'compare') {
      trackCompareOpened()
    }

    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        if (tab === 'results') {
          url.searchParams.delete('tab')
        } else {
          url.searchParams.set('tab', tab)
        }
        window.history.replaceState({}, '', url.toString())
      } catch {}
    }
  }

  const handleResizeStart = (event: any) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    event.preventDefault()

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
    if (!viewportWidth) return

    const minWidth = 280
    const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
    const root = document.documentElement

    const handleMove = (e: MouseEvent) => {
      const fromRight = viewportWidth - e.clientX
      const nextWidth = fromRight
      const clamped = Math.max(minWidth, Math.min(maxWidth, nextWidth))
      root.style.setProperty('--dock-right-expanded', `${clamped}px`)
      try {
        localStorage.setItem('panel.results.width', String(clamped))
      } catch {}
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <aside
      className={`${transitionClass} fixed right-0 border-l border-sand-200 bg-paper-50 shadow-panel flex flex-col transition-shadow rounded-b-2xl relative pointer-events-auto`}
      style={{
        width: state.isOpen ? 'var(--dock-right-expanded, 24rem)' : 'var(--dock-right-collapsed, 2.5rem)',
        top: 'var(--topbar-h, 0px)',
        height: 'calc(100vh - var(--topbar-h, 0px) - var(--bottombar-h))',
        maxHeight: 'calc(100vh - var(--topbar-h, 0px) - var(--bottombar-h))',
      }}
      aria-label="Outputs dock"
      data-testid="outputs-dock"
    >
      {state.isOpen && (
        <div
          aria-hidden="true"
          onMouseDown={handleResizeStart}
          className="absolute inset-y-0 left-0 w-1 cursor-col-resize bg-transparent hover:bg-sand-200/60"
        />
      )}
      <div className="sticky top-0 z-10 bg-paper-50 border-b border-sand-200">
        <div className="flex items-center justify-between px-2 py-2">
          {state.isOpen && (
            <span className={`mr-2 ${typography.caption} font-medium text-ink-900/70 truncate`} aria-live="polite">
              {OUTPUT_TABS.find(tab => tab.id === state.activeTab)?.label ?? ''}
            </span>
          )}
          <button
            type="button"
            onClick={toggleOpen}
            className={`inline-flex items-center justify-center w-6 h-6 rounded border border-sand-200 ${typography.caption} text-ink-900/70 hover:bg-paper-50`}
            aria-label={state.isOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
          >
            {state.isOpen ? '>' : '<'}
          </button>
        </div>

        {state.isOpen && (
          <nav
            className="flex gap-1 px-2 py-2 border-t border-sand-200"
            aria-label="Outputs sections"
          >
            {OUTPUT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                data-testid={tab.id === 'diagnostics' ? 'outputs-dock-tab-diagnostics' : undefined}
                className={`flex-1 px-2 py-1 rounded ${typography.caption} font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-sky-200 text-sky-600 border-b-2 border-sky-500'
                    : 'text-ink-900/70 hover:bg-paper-50 hover:text-ink-900 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {!state.isOpen && (
        <nav
          className="flex flex-col items-center gap-2 py-3"
          aria-label="Outputs sections"
        >
          {OUTPUT_TABS.map(tab => {
            const Icon =
              tab.id === 'results'
                ? BarChart3
                : tab.id === 'insights'
                ? Sparkles
                : tab.id === 'compare'
                ? Shuffle
                : Activity
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${typography.caption} focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-sky-200 text-sky-600 border-sky-500'
                    : 'text-ink-900/70 bg-paper-50 border-sand-200 hover:bg-paper-50 hover:text-ink-900'
                }`}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </nav>
      )}

      {state.isOpen && (
        <div className={`flex-1 px-3 py-3 ${typography.caption} text-ink-900/70 space-y-3 overflow-y-auto`} data-testid="outputs-dock-body">
            {state.activeTab === 'results' && (
              <div className="space-y-3">
                <p>
                  {isPreRun
                    ? 'Results appear here after your first analysis.'
                    : 'View charts, confidence scores, and outcome breakdowns after each run.'}
                </p>
                {isPreRun && (
                  <p className={`${typography.code} text-ink-900/60`}>
                    Run your first analysis from the toolbar above.
                  </p>
                )}
                {/* Phase 2 Sprint 1B: Slow-run UX feedback */}
                {slowRunMessage && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-sky-50 border border-sky-200 rounded text-sky-800"
                    role="status"
                    aria-live="polite"
                    data-testid="slow-run-message"
                  >
                    <Clock className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className={`${typography.caption} text-sky-900`}>{slowRunMessage}</span>
                  </div>
                )}
                {!isPreRun && hasInlineSummary && (
                  <div className="space-y-2" data-testid="outputs-inline-summary">
                    <KPIHeadline
                      value={mostLikelyValue ?? null}
                      label="Expected Value"
                      units={resultUnits}
                      unitSymbol={resultUnitSymbol}
                    />
                    <div className="space-y-1">
                      <div className={`${typography.code} font-medium text-ink-900/70`}>Range</div>
                      <RangeChips
                        conservative={conservativeValue ?? null}
                        likely={mostLikelyValue ?? null}
                        optimistic={optimisticValue ?? null}
                        units={resultUnits}
                        unitSymbol={resultUnitSymbol}
                      />
                    </div>
                    {decisionReviewStatus && (
                      <div
                        className="mt-3 pt-3 border-t border-sand-200"
                        data-testid="outputs-decision-review"
                      >
                        <div className={`${typography.code} font-medium text-ink-900/70 mb-1`}>
                          Decision Review
                        </div>
                        {ceeDegraded && (
                          <div
                            className={`mb-2 p-2 bg-sun-50 border border-sun-200 rounded ${typography.code} text-sun-900`}
                            data-testid="cee-degraded-banner"
                            role="alert"
                            aria-live="polite"
                          >
                            <span className="font-medium">Partial analysis:</span> Decision Review ran with reduced functionality. Core results remain accurate.
                          </div>
                        )}
                        <DecisionReviewPanel
                          status={decisionReviewStatus}
                          review={ceeReview ?? undefined}
                          error={ceeError ?? undefined}
                          trace={ceeTrace ?? undefined}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {state.activeTab === 'insights' && (
              <div className="space-y-2">
                <p>
                  {isPreRun
                    ? 'Key drivers and narratives appear after your first analysis.'
                    : 'Explore key drivers and detailed narratives for your latest run.'}
                </p>
                {isPreRun && (
                  <p className={`${typography.code} text-ink-900/70`}>
                    Run your first analysis from the toolbar above.
                  </p>
                )}
              </div>
            )}
            {state.activeTab === 'compare' && (
              <CompareTabBody />
            )}
            {state.activeTab === 'diagnostics' && (
              <div className="space-y-3" data-testid="diagnostics-tab">
                <div className={`${typography.label} text-ink-900 uppercase tracking-wide`}>
                  Streaming diagnostics
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between" data-testid="diag-resumes" title="Resumes: times the stream reconnected.">
                    <span className="text-ink-900/70">Resumes</span>
                    <span className="tabular-nums text-ink-900">{hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="diag-recovered" title="Recovered events: events caught up after a resume.">
                    <span className="text-ink-900/70">Recovered events</span>
                    <span className="tabular-nums text-ink-900">{hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="diag-trims" title="Buffer trimmed: older events were dropped to keep streaming responsive.">
                    <span className="text-ink-900/70">Buffer trimmed</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${typography.code} font-medium border`} aria-label={hasTrim ? 'Buffer was trimmed' : 'Buffer was not trimmed'}>
                      {hasTrim ? (
                        <span className="bg-sun-50 text-sun-800 border-sun-200 px-1.5 py-0.5 rounded">Yes</span>
                      ) : (
                        <span className="text-ink-900/80 border-sand-200 px-1.5 py-0.5 rounded">No</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-sand-200">
                  <div className="flex items-center justify-between" title="Correlation ID: include this when reporting issues.">
                    <span className="text-ink-900/70">Correlation ID</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono ${typography.code} text-ink-900 max-w-[10rem] truncate`}
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
                          className={`inline-flex items-center px-1.5 py-0.5 rounded border border-sand-200 ${typography.code} text-ink-900/80 hover:bg-paper-50`}
                          data-testid="diag-correlation-copy"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                  {correlationMismatch && (
                    <p
                      className={`${typography.code} text-sun-700`}
                      data-testid="diag-correlation-mismatch"
                    >
                      Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
                    </p>
                  )}
                </div>

                <div className="space-y-1 pt-2 border-t border-sand-200" data-testid="graph-health-card">
                  <div className={`${typography.label} text-ink-900`}>Graph health</div>
                  <div className={`${typography.code} text-ink-900`} aria-live="polite">
                    {healthView.label}
                  </div>
                  <div className={`${typography.code} text-ink-900/70`} aria-live="polite">
                    {healthView.detail}
                  </div>
                  {graphHealth && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowIssuesPanel(true)}
                        className={`mt-1 inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 ${typography.code} font-medium hover:bg-blue-50`}
                        data-testid="graph-health-open-issues"
                      >
                        Open graph issues
                      </button>
                      <p className={`${typography.code} text-ink-900/60 mt-1`}>
                        See Graph Issues panel for fixable problems detected here.
                      </p>
                    </>
                  )}
                </div>

                <p className={`${typography.code} text-ink-900/60`}>
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

type CompareSelection = {
  baselineId: string | null
  currentId: string | null
}

function CompareTabBody() {
  // Read scenario metadata and current results hash once per render without
  // subscribing this component to store updates. This avoids nested
  // subscription/update loops while still giving CompareTabBody the
  // information it needs to choose sensible defaults.
  const canvasState = useCanvasStore.getState()
  const scenarioTitle = canvasState.currentScenarioFraming?.title ?? null
  const scenarioLastResultHash = canvasState.currentScenarioLastResultHash ?? null
  const currentResultsHash = canvasState.results.hash ?? null
  // TODO: When run history includes scenario identifiers, filter runs to the current scenario here.
  // For now, CompareTabBody works over all stored runs.
  const [runs, setRuns] = useState<StoredRun[]>(() => loadRuns())
  const [selection, setSelection] = useState<CompareSelection>({ baselineId: null, currentId: null })

  useEffect(() => {
    const unsubscribe = runsBus.on(() => {
      setRuns(loadRuns())
    })
    return unsubscribe
  }, [])

  const contextLine = scenarioTitle
    ? `Comparing runs for: ${scenarioTitle}`
    : 'Comparing runs for this decision.'

  if (runs.length === 0) {
    return (
      <div className="space-y-2" data-testid="compare-tab-empty">
        <p className={`${typography.body} text-ink-900/80`}>{contextLine}</p>
        <p className={`${typography.caption} text-ink-900/70`}>
          No runs to compare yet. Run an analysis to build history for this canvas.
        </p>
      </div>
    )
  }

  if (runs.length === 1) {
    const [onlyRun] = runs
    return (
      <div className="space-y-2" data-testid="compare-tab-single">
        <p className={`${typography.body} text-ink-900/80`}>{contextLine}</p>
        <p className={`${typography.caption} text-ink-900/70`}>
          Only one run is available. Run analysis again to compare changes over time.
        </p>
        <p className={`${typography.code} text-ink-900/70`}>Latest run: {formatRunLabel(onlyRun)}</p>
      </div>
    )
  }

  const defaults = selectDefaultRuns(runs, scenarioLastResultHash, currentResultsHash)

  // Decide which run should be treated as "current" for this scenario.
  // Prefer an explicit user selection when valid, otherwise fall back to scenario-aware defaults.
  let currentId = selection.currentId && runs.some(r => r.id === selection.currentId)
    ? selection.currentId
    : defaults.currentId

  // Decide baseline: prefer explicit selection when valid and distinct from current,
  // otherwise choose the first different run (or null when not available).
  let baselineId = selection.baselineId && runs.some(r => r.id === selection.baselineId)
    ? selection.baselineId
    : defaults.baselineId

  if (currentId && baselineId === currentId) {
    baselineId = runs.find(r => r.id !== currentId)?.id ?? null
  }

  const resolvedCurrentRun = (() => {
    const fromSelection = currentId ? runs.find(r => r.id === currentId) : null
    if (fromSelection) return fromSelection
    if (defaults.currentId) {
      const fromDefaults = runs.find(r => r.id === defaults.currentId)
      if (fromDefaults) return fromDefaults
    }
    return runs[0]
  })()

  const resolvedBaselineRun = (() => {
    if (baselineId && baselineId !== resolvedCurrentRun.id) {
      const fromSelection = runs.find(r => r.id === baselineId)
      if (fromSelection) return fromSelection
    }

    if (defaults.baselineId && defaults.baselineId !== resolvedCurrentRun.id) {
      const fromDefaults = runs.find(r => r.id === defaults.baselineId)
      if (fromDefaults) return fromDefaults
    }

    return runs.find(r => r.id !== resolvedCurrentRun.id) ?? resolvedCurrentRun
  })()

  const handleBaselineChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null
    setSelection(prev => ({ ...prev, baselineId: nextId }))
  }

  const handleCurrentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value || null
    setSelection(prev => ({ ...prev, currentId: nextId }))
  }

  return (
    <div className="space-y-3" data-testid="compare-tab-body">
      <p className={`${typography.body} text-ink-900/80`} data-testid="compare-context">{contextLine}</p>

      <div className="space-y-2">
        <label className="flex flex-col gap-1">
          <span className={`${typography.code} font-medium text-ink-900 uppercase tracking-wide`}>Reference run</span>
          <select
            className={`rounded border border-sand-200 px-2 py-1 ${typography.caption} text-ink-900 bg-white`}
            value={resolvedBaselineRun?.id ?? ''}
            onChange={handleBaselineChange}
            data-testid="compare-baseline-select"
          >
            {runs.map(run => (
              <option key={run.id} value={run.id} disabled={run.id === (resolvedCurrentRun?.id ?? null)}>
                {formatRunLabel(run)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className={`${typography.code} font-medium text-ink-900 uppercase tracking-wide`}>Current run</span>
          <select
            className={`rounded border border-sand-200 px-2 py-1 ${typography.caption} text-ink-900 bg-white`}
            value={resolvedCurrentRun?.id ?? ''}
            onChange={handleCurrentChange}
            data-testid="compare-current-select"
          >
            {runs.map(run => (
              <option key={run.id} value={run.id} disabled={run.id === (resolvedBaselineRun?.id ?? null)}>
                {formatRunLabel(run)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <OutcomeComparison baselineRun={resolvedBaselineRun} currentRun={resolvedCurrentRun} />
    </div>
  )
}

interface OutcomeComparisonProps {
  baselineRun: StoredRun | null
  currentRun: StoredRun | null
}

function OutcomeComparison({ baselineRun, currentRun }: OutcomeComparisonProps) {
  if (!baselineRun || !currentRun) {
    return (
      <div className={`${typography.caption} text-ink-900/70`} data-testid="compare-outcome">
        Select two runs to see an outcome comparison.
      </div>
    )
  }

  const baselineBands = extractOutcomeBands(baselineRun)
  const currentBands = extractOutcomeBands(currentRun)
  const units = currentBands.units || baselineBands.units
  const unitSymbol = currentBands.unitSymbol ?? baselineBands.unitSymbol

  return (
    <div className="space-y-2" data-testid="compare-outcome">
      <div className={`grid grid-cols-1 gap-2 ${typography.caption} text-ink-900/80`}>
        <OutcomeSummary label="Reference run" run={baselineRun} bands={baselineBands} />
        <OutcomeSummary label="Current run" run={currentRun} bands={currentBands} />
      </div>
      <p className={`${typography.code} text-ink-900/80`} data-testid="compare-delta-text">
        {describeDelta(baselineBands.p50, currentBands.p50, units, unitSymbol)}
      </p>
    </div>
  )
}

interface OutcomeSummaryProps {
  label: string
  run: StoredRun
  bands: OutcomeBands
}

function OutcomeSummary({ label, run, bands }: OutcomeSummaryProps) {
  const cells = [
    { label: 'Conservative', value: bands.p10 },
    { label: 'Most likely', value: bands.p50 },
    { label: 'Optimistic', value: bands.p90 },
  ]

  return (
    <div className="rounded-lg border border-sand-200 p-2.5 bg-paper-50">
      <div className={`${typography.code} font-medium text-ink-900`}>{label}</div>
      <div className={`${typography.code} text-ink-900/70 mb-1 tabular-nums`}>{formatRunLabel(run)}</div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {cells.map(cell => (
          <div key={`${label}-${cell.label}`} className="rounded bg-white/80 border border-sand-100 p-1">
            <div className={`${typography.code} font-medium uppercase text-ink-900/70 tracking-wide`}>
              {cell.label}
            </div>
            <div className={`${typography.code} font-semibold text-ink-900`}>
              {formatOutcomeValue(cell.value, bands.units, bands.unitSymbol)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface OutcomeBands {
  p10: number | null
  p50: number | null
  p90: number | null
  units: OutcomeUnits
  unitSymbol?: string
}

type OutcomeUnits = 'currency' | 'percent' | 'count'

function selectDefaultRuns(
  runs: StoredRun[],
  scenarioLastResultHash: string | null,
  currentResultsHash: string | null,
): CompareSelection {
  if (!runs.length) {
    return { baselineId: null, currentId: null }
  }

  const selected = selectScenarioLastRun({
    runs,
    scenarioLastResultHash,
    currentResultsHash,
  })

  const current = selected ?? runs[0]
  const baseline = runs.find(run => run.id !== current.id) ?? null
  return {
    currentId: current.id,
    baselineId: baseline?.id ?? null,
  }
}

function extractOutcomeBands(run: StoredRun): OutcomeBands {
  const units: OutcomeUnits = run.report?.results?.units ?? 'percent'
  const unitSymbol = run.report?.results?.unitSymbol

  const bands = run.report?.run?.bands

  if (bands) {
    // Canonical SSOT: trust bands even when individual values are null
    return {
      p10: bands.p10 ?? null,
      p50: bands.p50 ?? null,
      p90: bands.p90 ?? null,
      units,
      unitSymbol,
    }
  }

  // Legacy fallback when canonical bands are absent
  return {
    p10: run.report?.results?.conservative ?? null,
    p50: run.report?.results?.likely ?? null,
    p90: run.report?.results?.optimistic ?? null,
    units,
    unitSymbol,
  }
}

function formatOutcomeValue(value: number | null, units: OutcomeUnits, unitSymbol?: string): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }

  if (units === 'currency') {
    const symbol = unitSymbol || '$'
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    if (absolute >= 1_000_000) {
      return `${prefix}${symbol}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${symbol}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${symbol}${absolute.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }

  if (units === 'count') {
    const absolute = Math.abs(value)
    const prefix = value < 0 ? '-' : ''
    if (absolute >= 1_000_000) {
      return `${prefix}${(absolute / 1_000_000).toFixed(1)}M`
    }
    if (absolute >= 1_000) {
      return `${prefix}${(absolute / 1_000).toFixed(1)}K`
    }
    return `${prefix}${absolute.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }

  return `${value.toFixed(1)}%`
}

function describeDelta(
  baseline: number | null,
  current: number | null,
  units: OutcomeUnits,
  unitSymbol?: string,
): string {
  if (baseline === null || current === null) {
    return 'Most likely outcome could not be compared for these runs.'
  }

  const diff = current - baseline
  if (Math.abs(diff) < 0.05) {
    return 'Most likely outcome is unchanged vs the reference run.'
  }

  const direction = diff > 0 ? 'increased' : 'decreased'
  const deltaText = formatDeltaValue(diff, units, unitSymbol)
  return `Most likely outcome ${direction} by ${deltaText} vs the reference run.`
}

function formatDeltaValue(value: number, units: OutcomeUnits, unitSymbol?: string): string {
  if (value === 0) {
    return formatOutcomeValue(0, units, unitSymbol)
  }

  const prefix = value > 0 ? '+' : '-'
  const formatted = formatOutcomeValue(Math.abs(value), units, unitSymbol)
  return `${prefix}${formatted}`
}

function formatRunLabel(run: StoredRun): string {
  return `${getHashSnippet(run.hash)} · ${formatRunTimestamp(run.ts)}`
}

function getHashSnippet(hash?: string): string {
  if (!hash) {
    return 'No hash'
  }
  return hash.length > 8 ? `${hash.slice(0, 8)}…` : hash
}

function formatRunTimestamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace('T', ' ')
}
