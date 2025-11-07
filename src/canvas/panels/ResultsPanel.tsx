/**
 * ResultsPanel - Enhanced with 3-tab structure
 *
 * Tabs:
 * 1. Latest Run - Shows current analysis with KPI headline, range, confidence, drivers
 * 2. History - Shows last 20 runs with pin/delete/compare
 * 3. Compare - Side-by-side comparison of selected runs
 *
 * Features:
 * - Keyboard navigation (Cmd+1-3 to switch tabs)
 * - Streaming progress with cancel
 * - Error handling with retry
 * - Auto-save runs to localStorage
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { History as HistoryIcon, GitCompare as CompareIcon, BarChart3, Play } from 'lucide-react'
import { useCanvasStore, selectResultsStatus, selectProgress, selectReport, selectError, selectSeed, selectHash } from '../store'
import { ProgressStrip } from '../components/ProgressStrip'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { useLayerRegistration } from '../components/LayerProvider'
import { DriverChips } from '../components/DriverChips'
import { RunHistory } from '../components/RunHistory'
import { CompareView } from '../components/CompareView'
import { KPIHeadline } from '../components/KPIHeadline'
import { RangeChips } from '../components/RangeChips'
import { ConfidenceBadge } from '../components/ConfidenceBadge'
import { ActionsRow } from '../components/ActionsRow'
import { loadRuns, type StoredRun } from '../store/runHistory'
import { useToast } from '../ToastContext'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'
import { plot } from '../../adapters/plot'
import { useResultsRun } from '../hooks/useResultsRun'
import { ValidationBanner, type ValidationError } from '../components/ValidationBanner'
import { useValidationFeedback } from '../hooks/useValidationFeedback'

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
  const isDuplicateRun = useCanvasStore(s => s.results.isDuplicateRun)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)

  const resultsReset = useCanvasStore(s => s.resultsReset)
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)
  const { showToast } = useToast()
  const { run } = useResultsRun()
  const { formatErrors, focusError } = useValidationFeedback()

  const [isRunning, setIsRunning] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationViolations, setValidationViolations] = useState<ValidationError[]>([]) // v1.2: coaching warnings

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('latest')

  // Compare state
  const [compareRunIds, setCompareRunIds] = useState<string[]>([])

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
          setActiveTab('compare')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, compareRunIds])

  // v1.2: Show toast when duplicate run is detected
  useEffect(() => {
    if (isDuplicateRun && status === 'complete' && hash) {
      showToast(`Already analysed (same hash: ${hash.slice(0, 8)}...)`, 'info')
    }
  }, [isDuplicateRun, status, hash, showToast])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    resultsReset()
    setActiveTab('latest')
    setCompareRunIds([])
  }, [resultsReset])

  const handleCompare = useCallback((runIds: string[]) => {
    const next = runIds.slice(0, 2)
    setCompareRunIds(next)
    setActiveTab('compare')
  }, [])

  const handleCloseCompare = useCallback(() => {
    setActiveTab('latest')
  }, [])

  const handleCompareSelectionChange = useCallback((runIds: string[]) => {
    setCompareRunIds(runIds.slice(0, 2))
  }, [])

  const handleRunAgain = useCallback(() => {
    if (onRunAgain) {
      onRunAgain()
    }
  }, [onRunAgain])

  const handleShare = useCallback(() => {
    if (hash) {
      const shareUrl = `${window.location.origin}${window.location.pathname}#run=${hash}`
      navigator.clipboard.writeText(shareUrl)
      showToast('Run URL copied to clipboard', 'success')
    }
  }, [hash, showToast])

  const handleRunAnalysis = useCallback(async () => {
    if (nodes.length === 0) {
      setValidationErrors([{
        code: 'EMPTY_GRAPH',
        message: 'Cannot run analysis: Graph is empty. Add at least one node.',
        severity: 'error' as const
      }])
      return
    }

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
  }, [nodes, edges, run, formatErrors])

  if (!isOpen) return null

  const isLoading = status === 'preparing' || status === 'connecting' || status === 'streaming'
  const isComplete = status === 'complete'
  const isError = status === 'error'
  const isCancelled = status === 'cancelled'

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
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
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
        Analyze again
      </button>
      <button
        onClick={handleShare}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        type="button"
        disabled={!hash}
      >
        Share
      </button>
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[1999]"
        onClick={handleClose}
      />

      {/* Panel Shell */}
      <div className="fixed right-0 top-0 bottom-0 z-[2000]" ref={panelRef}>
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
                  {/* Optional live log region */}
                  <div
                    className="text-sm p-3 rounded border"
                    style={{
                      backgroundColor: 'rgba(91, 108, 255, 0.05)',
                      borderColor: 'rgba(91, 108, 255, 0.15)',
                      color: 'rgba(232, 236, 245, 0.7)',
                    }}
                  >
                    {status === 'preparing' && <div>→ Validating graph structure...</div>}
                    {status === 'connecting' && <div>→ Establishing connection...</div>}
                    {status === 'streaming' && progress > 0 && <div>→ Processing nodes ({Math.round(progress)}% complete)...</div>}
                  </div>
                </>
              )}

              {/* Complete */}
              {isComplete && report && (
                <>
                  {/* v1.2 Critique Advisory (BLOCKER items) */}
                  {report.run?.critique && report.run.critique.some(c => c.severity === 'BLOCKER') && (
                    <div className="mb-4 p-4 rounded-lg border border-danger-300 bg-danger-50">
                      <h3 className="text-sm font-semibold text-danger-700 mb-2">
                        Critical Issues Detected
                      </h3>
                      <ul className="space-y-1 text-sm text-danger-600">
                        {report.run.critique
                          .filter(c => c.severity === 'BLOCKER')
                          .map((c, i) => (
                            <li key={i}>• {c.message}</li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {/* Most Likely Outcome */}
                  <PanelSection title="Most Likely Outcome">
                    <div className="space-y-4">
                      <KPIHeadline
                        value={report.run?.bands.p50 ?? report.results.likely}
                        label="Expected Value"
                        units={report.results.units}
                        unitSymbol={report.results.unitSymbol}
                      />
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 font-medium">Range</div>
                        <RangeChips
                          conservative={report.run?.bands.p10 ?? report.results.conservative}
                          likely={report.run?.bands.p50 ?? report.results.likely}
                          optimistic={report.run?.bands.p90 ?? report.results.optimistic}
                          units={report.results.units}
                          unitSymbol={report.results.unitSymbol}
                        />
                      </div>
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

                  {/* Reproducibility Info */}
                  {(seed !== undefined || hash) && (
                    <PanelSection title="Reproducibility">
                      <div className="space-y-2 text-sm">
                        {seed !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Seed</span>
                            <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{seed}</code>
                          </div>
                        )}
                        {hash && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Response Hash</span>
                              <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {hash.slice(0, 12)}...
                              </code>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(hash)
                                showToast('Hash copied to clipboard', 'success')
                              }}
                              className="w-full px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                              type="button"
                            >
                              Copy Full Hash
                            </button>
                          </div>
                        )}
                      </div>
                    </PanelSection>
                  )}
                </>
              )}

              {/* Error */}
              {isError && error && (
                <div className="p-4 rounded-lg border border-red-300 bg-red-100">
                  <h3 className="text-base font-semibold text-red-600 mb-2">
                    {error.code}
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    {error.message}
                  </p>
                  {error.retryAfter && (
                    <p className="text-xs text-gray-500">
                      Retry after {error.retryAfter} seconds
                    </p>
                  )}
                  <button
                    onClick={handleReset}
                    className="mt-3 px-4 py-2 text-sm rounded-md border-none bg-red-600 hover:bg-red-700 text-white cursor-pointer font-medium transition-colors"
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
                      Ready to analyze
                    </h3>
                    <p className="text-sm mb-6 text-gray-400">
                      {nodes.length === 0
                        ? 'Add nodes to your canvas to get started.'
                        : !outcomeNodeId
                        ? `Your graph has ${nodes.length} node${nodes.length !== 1 ? 's' : ''}. Select an outcome node in the inspector to target your analysis, or click Run to analyze the entire graph.`
                        : `Your graph has ${nodes.length} node${nodes.length !== 1 ? 's' : ''} with outcome: "${nodes.find(n => n.id === outcomeNodeId)?.data?.label || 'Unknown'}". Click Run to analyze.`
                      }
                    </p>
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

interface TabButtonProps {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  badge?: string
}

function TabButton({ active, onClick, label, icon, disabled = false, badge }: TabButtonProps) {
  return (
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
}
