/**
 * ResultsPanel - Legacy comprehensive results panel (NOT currently in use)
 *
 * ⚠️ ARCHITECTURE NOTE:
 * This component is NOT currently rendered in the main canvas flow.
 * The canonical Results UX is now **OutputsDock** (src/canvas/components/OutputsDock.tsx),
 * which provides a streamlined dock-based interface with tabs for Results, Insights, Compare, and Diagnostics.
 *
 * This panel remains for:
 * - Test coverage and backwards compatibility
 * - Potential future use if a full-screen results view is needed
 * - Reference implementation for results features
 *
 * The store flag `showResultsPanel` is used for UI coordination, NOT for rendering this component.
 *
 * Original Features:
 * - 3-tab structure (Latest Run, History, Compare)
 * - Keyboard navigation (Cmd+1-3 to switch tabs)
 * - Streaming progress with cancel
 * - Error handling with retry
 * - Auto-save runs to localStorage
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { History as HistoryIcon, GitCompare as CompareIcon, BarChart3, Play } from 'lucide-react'
import { useCanvasStore, hasValidationErrors, selectResultsStatus, selectProgress, selectReport, selectError, selectSeed, selectHash } from '../store'
import { ProgressStrip } from '../components/ProgressStrip'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { useLayerRegistration } from '../components/LayerProvider'
import { DriverChips } from '../components/DriverChips'
import { RunHistory } from '../components/RunHistory'
import { CompareView } from '../components/CompareView'
import { KPIHeadline } from '../components/KPIHeadline'
import { RangeChips } from '../components/RangeChips'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { loadRuns } from '../store/runHistory'
import { useToast } from '../ToastContext'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'
import { plot, adapterName } from '../../adapters/plot'
import { useResultsRun } from '../hooks/useResultsRun'
import { ValidationBanner, type ValidationError } from '../components/ValidationBanner'
import { useValidationFeedback } from '../hooks/useValidationFeedback'
import { ResultsSkeleton } from '../components/ResultsSkeleton'
import { Tooltip } from '../components/Tooltip'
import { useEngineLimits } from '../hooks/useEngineLimits'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { useRunEligibilityCheck } from '../hooks/useRunEligibilityCheck'
import { trackCompareOpened } from '../utils/sandboxTelemetry'
import { typography } from '../../styles/typography'
import type { GraphHealth } from '../validation/types'
import { DecisionReviewPanel, type DecisionReviewStatus } from '../components/DecisionReviewPanel'
import { isDecisionReviewEnabled } from '../../flags'

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

interface ResultsPanelProps {
  isOpen: boolean
  onClose: () => void
  onCancel?: () => void
  onRunAgain?: () => void
}

type TabId = 'latest' | 'history' | 'compare'

export function ResultsPanel({ isOpen, onClose, onCancel, onRunAgain }: ResultsPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  const status = useCanvasStore(selectResultsStatus)
  const progress = useCanvasStore(selectProgress)
  const report = useCanvasStore(selectReport)
  const error = useCanvasStore(selectError)
  const seed = useCanvasStore(selectSeed)
  const hash = useCanvasStore(selectHash)
  const runMeta = useCanvasStore(s => s.runMeta)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const framing = useCanvasStore(s => s.currentScenarioFraming)
  const graphHealth = useCanvasStore(s => s.graphHealth)
  const setShowIssuesPanel = useCanvasStore(s => s.setShowIssuesPanel)

  const resultsReset = useCanvasStore(s => s.resultsReset)
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)
  const { showToast } = useToast()
  const { run } = useResultsRun()
  const { formatErrors, focusError } = useValidationFeedback()
  const { limits } = useEngineLimits()
  const checkRunEligibility = useRunEligibilityCheck()

  const limitsStatusForStory = limits ? deriveLimitsStatus(limits, nodes.length, edges.length) : null
  const healthView = buildHealthStrings(graphHealth ?? null)

  const canonicalBands = report?.run?.bands ?? null
  const mostLikelyValue = canonicalBands ? canonicalBands.p50 : report?.results.likely ?? null
  const conservativeValue = canonicalBands ? canonicalBands.p10 : report?.results.conservative ?? null
  const optimisticValue = canonicalBands ? canonicalBands.p90 : report?.results.optimistic ?? null
  const resultUnits = report?.results.units
  const resultUnitSymbol = report?.results.unitSymbol

  const [isRunning, setIsRunning] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationViolations, setValidationViolations] = useState<ValidationError[]>([]) // v1.2: coaching warnings

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('latest')

  // Compare state
  const [compareRunIds, setCompareRunIds] = useState<string[]>([])
  const [hasTrackedCompare, setHasTrackedCompare] = useState(false)

  // Register with LayerProvider for panel exclusivity and Esc handling
  useLayerRegistration('results-panel', 'panel', isOpen, onClose)

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>('button')
      firstFocusable?.focus()
    }
  }, [isOpen])

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === '1') {
        e.preventDefault()
        setActiveTab('latest')
      } else if (isMod && e.key === '2') {
        e.preventDefault()
        setActiveTab('history')
      } else if (isMod && e.key === '3') {
        e.preventDefault()
        if (compareRunIds.length >= 2) {
          if (!hasTrackedCompare) {
            trackCompareOpened()
            setHasTrackedCompare(true)
          }
          setActiveTab('compare')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, compareRunIds, hasTrackedCompare])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    resultsReset()
    setActiveTab('latest')
    setCompareRunIds([])
    setHasTrackedCompare(false)
  }, [resultsReset])

  const handleCompare = useCallback((runIds: string[]) => {
    const next = runIds.slice(0, 2)
    setCompareRunIds(next)
    if (!hasTrackedCompare && next.length >= 2) {
      trackCompareOpened()
      setHasTrackedCompare(true)
    }
    setActiveTab('compare')
  }, [hasTrackedCompare])

  const handleCloseCompare = useCallback(() => {
    setActiveTab('latest')
  }, [])

  const handleCompareSelectionChange = useCallback((runIds: string[]) => {
    const next = runIds.slice(0, 2)
    setCompareRunIds(next)
    if (!hasTrackedCompare && next.length >= 2) {
      trackCompareOpened()
      setHasTrackedCompare(true)
    }
  }, [hasTrackedCompare])

  const handleRunAgain = useCallback(async () => {
    // v1.2: Force re-run with current graph state, bypassing hash dedupe
    setIsRunning(true)

    try {
      // Run with current graph and seed, but with forceRerun flag
      await run({
        template_id: 'canvas-graph',
        seed: seed || 1337, // Use current seed or default
        graph: { nodes, edges },
        outcome_node: outcomeNodeId || undefined
      }, { forceRerun: true }) // KEY: Bypass hash dedupe by bumping seed
    } catch (err: any) {
      console.error('[ResultsPanel] Force re-run failed:', err)
      setValidationErrors([{
        code: 'RUN_ERROR',
        message: err.message || 'Failed to run analysis',
        severity: 'error' as const
      }])
    } finally {
      setIsRunning(false)
    }

    // Call optional callback if provided (for backwards compatibility)
    if (onRunAgain) {
      onRunAgain()
    }
  }, [nodes, edges, seed, outcomeNodeId, run, onRunAgain])

  const handleShare = useCallback(() => {
    if (hash) {
      // v1.2: Use canonical format #/canvas?run=hash
      const shareUrl = `${window.location.origin}${window.location.pathname}#/canvas?run=${hash}`
      navigator.clipboard.writeText(shareUrl)
      // P1 Polish: Explicit local-only scope warning (Task E)
      showToast('Link copied! This link can only be opened on the same device/profile it was created on.', 'success')
    }
  }, [hash, showToast])

  const handleRunAnalysis = useCallback(async () => {
    const eligibility = checkRunEligibility()
    if (!eligibility.canRun) {
      return
    }

    const state = useCanvasStore.getState()

    // Clear previous validation errors and violations
    setValidationErrors([])
    setValidationViolations([])
    setIsRunning(true)

    try {
      // Validate graph using adapter (if validate is available)
      const adapter = plot as any
      if (adapter.validate && typeof adapter.validate === 'function') {
        const validationResult = await adapter.validate({ nodes, edges })

        // v1.2: Handle violations (non-blocking coaching warnings)
        if (validationResult.violations && validationResult.violations.length > 0) {
          const formattedViolations = formatErrors(validationResult.violations)
          setValidationViolations(formattedViolations)
        }

        // Only block on hard errors
        if (!validationResult.valid) {
          // Show validation errors in banner
          const formattedErrors = formatErrors(validationResult.errors)
          setValidationErrors(formattedErrors)
          setIsRunning(false)
          return
        }
      }

      // Run analysis with default seed and outcome node (if set)
      await run({
        template_id: 'canvas-graph',
        seed: 1337,
        graph: { nodes, edges },
        outcome_node: outcomeNodeId || undefined
      })
    } catch (err: any) {
      console.error('[ResultsPanel] Run failed:', err)
      setValidationErrors([{
        code: 'RUN_ERROR',
        message: err.message || 'Failed to run analysis',
        severity: 'error' as const
      }])
    } finally {
      setIsRunning(false)
    }
  }, [limits, run, formatErrors, showToast, outcomeNodeId, nodes, edges])

  if (!isOpen) return null

  const isLoading = status === 'preparing' || status === 'connecting' || status === 'streaming'
  const isComplete = status === 'complete'
  const isError = status === 'error'
  const isCancelled = status === 'cancelled'

  const decisionReviewFlagOn = isDecisionReviewEnabled()
  const ceeReview = runMeta.ceeReview ?? null
  const ceeTrace = runMeta.ceeTrace ?? null
  const ceeError = runMeta.ceeError ?? null

  let decisionReviewStatus: DecisionReviewStatus | null = null
  if (decisionReviewFlagOn && isComplete && report) {
    if (ceeError) {
      decisionReviewStatus = 'error'
    } else if (ceeReview) {
      decisionReviewStatus = 'ready'
    } else {
      decisionReviewStatus = 'empty'
    }
  }

  // Status chip
  const statusChip = (() => {
    let text = 'Idle'
    let className = 'bg-gray-100 text-gray-600'

    if (status === 'preparing' || status === 'connecting' || status === 'streaming') {
      text = status === 'preparing' ? 'Preparing' : status === 'connecting' ? 'Connecting' : 'Analyzing'
      className = 'bg-blue-100 text-blue-600'
    } else if (status === 'complete') {
      text = 'Complete'
      className = 'bg-green-100 text-green-600'
    } else if (status === 'error') {
      text = 'Error'
      className = 'bg-danger-100 text-danger-600'
    } else if (status === 'cancelled') {
      text = 'Cancelled'
      className = 'bg-warning-100 text-warning-600'
    }

    return (
      <span className={`px-2.5 py-1 rounded-full ${typography.caption} font-medium ${className}`}>
        {text}
      </span>
    )
  })()

  // Tabs component
  const tabs = (
    <div className="flex border-b border-gray-200">
      <TabButton
        active={activeTab === 'latest'}
        onClick={() => setActiveTab('latest')}
        label="Latest"
      />
      <TabButton
        active={activeTab === 'history'}
        onClick={() => setActiveTab('history')}
        label="History"
        icon={<HistoryIcon className="w-4 h-4" />}
      />
      <TabButton
        active={activeTab === 'compare'}
        onClick={() => setActiveTab('compare')}
        label="Compare"
        icon={<CompareIcon className="w-4 h-4" />}
        disabled={compareRunIds.length < 2}
        badge={compareRunIds.length >= 2 ? String(compareRunIds.length) : undefined}
      />
    </div>
  )

  // Footer with actions (only show when complete)
  const footer = isComplete && report ? (
    <>
      <button
        onClick={handleRunAgain}
        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        type="button"
      >
        Analyse again
      </button>
      <Tooltip content={hash ? 'Share this analysis' : 'Share requires a completed analysis'}>
        <button
          onClick={handleShare}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          disabled={!hash}
        >
          Share
        </button>
      </Tooltip>
      <button
        onClick={() => setActiveTab('history')}
        className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        type="button"
        aria-label="Compare runs"
      >
        <CompareIcon className="w-5 h-5" />
      </button>
    </>
  ) : undefined

  return (
    <>
      {/* Backdrop (constrained to top/bottom bars so it never covers the toolbar) */}
      <div
        className="fixed inset-x-0 bg-black/50 z-[1999]"
        style={{ top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
        onClick={handleClose}
      />

      {/* Panel Shell container (also respects top/bottom layout bars) */}
      <div
        className="fixed right-0 z-[2000]"
        ref={panelRef}
        style={{ top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
      >
        <PanelShell
          icon={<BarChart3 className="w-5 h-5" />}
          title="Analysis Results"
          chips={statusChip}
          tabs={tabs}
          onClose={handleClose}
          footer={footer}
          width="480px"
        >
          {/* Latest Run Tab */}
          {activeTab === 'latest' && (
            <>
              {/* Streaming state */}
              {isLoading && (
                <>
                  <ProgressStrip
                    isVisible={true}
                    progress={progress}
                    message={
                      status === 'preparing' ? 'Preparing analysis...' :
                      status === 'connecting' ? 'Connecting to service...' :
                      'Analyzing decision tree...'
                    }
                    canCancel={status === 'streaming'}
                    onCancel={() => {
                      if (onCancel) {
                        onCancel()
                      } else {
                        useCanvasStore.getState().resultsCancelled()
                      }
                    }}
                  />
                  {/* Loading skeleton */}
                  <ResultsSkeleton />
                </>
              )}

              {/* Complete */}
              {isComplete && report && (
                <>
                  {/* v1.2 Critique Advisory (BLOCKER items) */}
                  {(() => {
                    const blockers = report.run?.critique?.filter(c => c.severity === 'BLOCKER') ?? []

                    if (blockers.length === 0) return null

                    return (
                      <div className="mb-4 p-4 rounded-lg border border-danger-300 bg-danger-50">
                        <h3 className="text-sm font-semibold text-danger-700 mb-2">
                          Critical Issues Detected
                        </h3>
                        <ul className="space-y-1 text-sm text-danger-600">
                          {blockers.map((c, i) => (
                            <li key={i}>• {c.message}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* Most Likely Outcome */}
                  <PanelSection title="Most Likely Outcome">
                    <div className="space-y-4">
                      <KPIHeadline
                        value={mostLikelyValue}
                        label="Expected Value"
                        units={resultUnits}
                        unitSymbol={resultUnitSymbol}
                      />
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 font-medium">Range</div>
                        <RangeChips
                          conservative={conservativeValue}
                          likely={mostLikelyValue}
                          optimistic={optimisticValue}
                          units={resultUnits}
                          unitSymbol={resultUnitSymbol}
                        />
                      </div>
                    </div>
                  </PanelSection>

                  {decisionReviewStatus !== null && (
                    <PanelSection title="Decision Review">
                      <DecisionReviewPanel
                        status={decisionReviewStatus}
                        review={ceeReview ?? undefined}
                        error={ceeError ?? undefined}
                        trace={ceeTrace ?? undefined}
                      />
                    </PanelSection>
                  )}

                  {/* Decision story */}
                  <PanelSection title="Decision story">
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        {framing && (framing.title || framing.goal || framing.timeline) ? (
                          <>
                            You are deciding
                            {framing.title ? (
                              <>
                                {': '}
                                <span className="font-medium text-gray-900">{framing.title}</span>
                              </>
                            ) : (
                              ' on this decision context'
                            )}
                            {framing.goal && (
                              <>
                                {'. Primary goal: '}
                                <span className="font-medium text-gray-900">{framing.goal}</span>
                              </>
                            )}
                            {framing.timeline && (
                              <>
                                {'. Time horizon: '}
                                <span className="font-medium text-gray-900">{framing.timeline}</span>
                              </>
                            )}
                          </>
                        ) : (
                          'You are reviewing this decision based on the current graph and results.'
                        )}
                      </p>
                      <p>
                        {limitsStatusForStory ? (
                          <>
                            Limits:{' '}
                            <span className="font-medium text-gray-900">{limitsStatusForStory.zoneLabel}</span>.{' '}
                            {limitsStatusForStory.message}
                          </>
                        ) : (
                          'Limits: Limits unavailable. You can still edit the graph, but run behaviour may be constrained.'
                        )}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">{healthView.label}</span>{' '}
                        <span className="text-gray-700">{healthView.detail}</span>
                      </p>
                      {graphHealth && (
                        <>
                          <p>
                            <button
                              type="button"
                              onClick={() => setShowIssuesPanel(true)}
                              className="inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-50"
                            >
                              Open graph issues
                            </button>
                          </p>
                          <p className="text-[11px] text-gray-500">
                            See Graph Issues panel for fixable problems detected here.
                          </p>
                        </>
                      )}
                    </div>
                  </PanelSection>

                  {/* Confidence */}
                  <ConfidenceBadge
                    level={report.confidence?.level as 'low' | 'medium' | 'high' | undefined}
                    reason={report.confidence?.why}
                    score={report.run?.confidence?.score}
                  />

                  {/* Drivers */}
                  {report.drivers && report.drivers.length > 0 && (
                    <PanelSection title="Key Drivers">
                      <DriverChips drivers={report.drivers} />
                    </PanelSection>
                  )}

                  {/* Recommendations */}
                  <WhyPanel report={report} />

                  {/* Trust & reproducibility footer */}
                  <ResultsTrustFooter seed={seed} hash={hash} showToast={showToast} />
                </>
              )}

              {/* Error */}
              {isError && error && (
                <div className="p-4 rounded-lg border border-danger-200 bg-danger-50">
                  <h3 className="text-base font-semibold text-danger-700 mb-2">
                    {error.code}
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    {error.message}
                  </p>
                  {error.retryAfter && (
                    <p className="text-xs text-gray-500 mb-2">
                      Retry after {error.retryAfter} seconds
                    </p>
                  )}
                  {(runMeta.correlationIdHeader || runMeta.diagnostics?.correlation_id) && (
                    <p className="text-xs text-gray-600 font-mono mb-2">
                      Request ID: {runMeta.correlationIdHeader || runMeta.diagnostics?.correlation_id}
                    </p>
                  )}
                  <button
                    onClick={handleReset}
                    className="mt-3 px-4 py-2 text-sm rounded-md border-none bg-danger-600 hover:bg-danger-700 text-white cursor-pointer font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Cancelled */}
              {isCancelled && (
                <div className="p-4 rounded-lg border border-warning-300 bg-warning-100 text-center">
                  <p className="text-sm text-warning-700 mb-3">
                    Analysis cancelled
                  </p>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm rounded-md border-none bg-info-500 hover:bg-info-600 text-white cursor-pointer font-medium transition-colors"
                  >
                    Start New Run
                  </button>
                </div>
              )}

              {/* Idle state */}
              {status === 'idle' && (
                <>
                  {/* Validation Banner */}
                  {(validationErrors.length > 0 || validationViolations.length > 0) && (
                    <div className="mb-4">
                      <ValidationBanner
                        errors={validationErrors}
                        violations={validationViolations}
                        onDismiss={() => {
                          setValidationErrors([])
                          setValidationViolations([])
                        }}
                        onFixNow={focusError}
                      />
                    </div>
                  )}

                  <div className="text-center py-12">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                        <Play className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                      Ready to analyse
                    </h3>
                    <p className="text-sm mb-6 text-gray-400">
                      {nodes.length === 0
                        ? 'Add nodes to your canvas to get started.'
                        : !outcomeNodeId
                        ? `Your graph has ${nodes.length} node${nodes.length !== 1 ? 's' : ''}. Select an outcome node in the inspector to target your analysis, or click Run to analyse the entire graph.`
                        : `Your graph has ${nodes.length} node${nodes.length !== 1 ? 's' : ''} with outcome: "${nodes.find(n => n.id === outcomeNodeId)?.data?.label || 'Unknown'}". Click Run to analyse.`
                      }
                    </p>
                    <Tooltip
                      content={
                        nodes.length === 0
                          ? 'Add nodes to canvas to run analysis'
                          : isRunning
                          ? 'Analysis in progress...'
                          : 'Run analysis on current graph'
                      }
                    >
                      <button
                        onClick={handleRunAnalysis}
                        disabled={nodes.length === 0 || isRunning}
                        className="px-6 py-3 text-sm font-medium text-white bg-info rounded-lg hover:bg-info/90 transition-colors focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      >
                        {isRunning ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run Analysis
                          </>
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </>
              )}
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <RunHistory
              onViewRun={(run) => {
                resultsLoadHistorical(run)
                setActiveTab('latest')
              }}
              onCompare={handleCompare}
            />
          )}

          {/* Compare Tab */}
          {activeTab === 'compare' && (
            <CompareView
              onOpenInCanvas={(runId) => {
                const run = loadRuns().find(r => r.id === runId)
                if (run) {
                  resultsLoadHistorical(run)
                  setActiveTab('latest')
                }
              }}
              onBack={handleCloseCompare}
              selectedRunIds={compareRunIds}
              onSelectionChange={handleCompareSelectionChange}
            />
          )}
        </PanelShell>
      </div>
    </>
  )
}

interface ResultsTrustFooterProps {
  seed: number | undefined
  hash: string | undefined
  showToast: (message: string, variant?: 'error' | 'success' | 'info' | 'warning') => void
}

function ResultsTrustFooter({ seed, hash, showToast }: ResultsTrustFooterProps) {
  const hasSeed = seed !== undefined
  const hasHash = Boolean(hash)

  const seedValue = hasSeed ? String(seed) : 'Not available for this run'
  const hashPreview = hasHash && hash ? `${hash.slice(0, 12)}...` : 'Not available for this run'

  const engineLabel = (() => {
    if (adapterName === 'mock') return 'PLoT (mock)'
    if (adapterName === 'httpv1') return 'PLoT (staging)'
    if (adapterName === 'auto') return 'PLoT (auto-detect)'
    return 'PLoT (unknown mode)'
  })()

  const handleCopyHash = () => {
    if (!hash) return
    try {
      navigator.clipboard.writeText(hash)
      showToast('Hash copied to clipboard', 'success')
    } catch {
      // Best-effort copy; avoid noisy errors in UI
    }
  }

  return (
    <div className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-600" aria-label="Trust and reproducibility details">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Seed</span>
          <span className="font-mono text-[11px] bg-gray-50 px-2 py-0.5 rounded text-gray-800">
            {seedValue}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">Response</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] bg-gray-50 px-2 py-0.5 rounded text-gray-800">
              {hashPreview}
            </span>
            {hasHash && (
              <button
                type="button"
                onClick={handleCopyHash}
                className="px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              >
                Copy full hash
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Engine</span>
          <span className="text-[11px] text-gray-800">{engineLabel}</span>
        </div>
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  badge?: string
}

function TabButton({ active, onClick, label, icon, disabled = false, badge }: TabButtonProps) {
  const tooltipContent = disabled && label === 'Compare'
    ? 'Select 2 runs from History to compare'
    : undefined

  const button = (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 px-4 py-2 text-sm font-medium transition-colors
        ${active ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-600 border-b-2 border-transparent hover:text-gray-900 hover:bg-gray-50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      type="button"
    >
      <span className="flex items-center justify-center gap-2">
        {icon}
        {label}
        {badge && (
          <span className="px-1.5 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
            {badge}
          </span>
        )}
      </span>
    </button>
  )

  return tooltipContent ? <Tooltip content={tooltipContent}>{button}</Tooltip> : button
}
