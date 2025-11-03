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
import { History as HistoryIcon, GitCompare as CompareIcon, BarChart3 } from 'lucide-react'
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
import type { StoredRun } from '../store/runHistory'
import { useToast } from '../ToastContext'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'

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

  const resultsReset = useCanvasStore(s => s.resultsReset)
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)
  const { showToast } = useToast()

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
      } else if (isMod && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        if (compareRunIds.length >= 2) {
          setActiveTab('compare')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, compareRunIds.length])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    resultsReset()
    setActiveTab('latest')
    setCompareRunIds([])
  }, [resultsReset])

  const handleCompare = useCallback((runIds: string[]) => {
    setCompareRunIds(runIds)
    setActiveTab('compare')
  }, [])

  const handleCloseCompare = useCallback(() => {
    setCompareRunIds([])
    setActiveTab('latest')
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
      className = 'bg-red-100 text-red-600'
    } else if (status === 'cancelled') {
      text = 'Cancelled'
      className = 'bg-yellow-100 text-yellow-600'
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
                  {/* Most Likely Outcome */}
                  <PanelSection title="Most Likely Outcome">
                    <div className="space-y-4">
                      <KPIHeadline
                        value={report.results.likely}
                        label="Expected Value"
                        units={report.results.units}
                        unitSymbol={report.results.unitSymbol}
                      />
                      <div className="space-y-2">
                        <div className="text-xs text-gray-500 font-medium">Range</div>
                        <RangeChips
                          conservative={report.results.conservative}
                          likely={report.results.likely}
                          optimistic={report.results.optimistic}
                          units={report.results.units}
                          unitSymbol={report.results.unitSymbol}
                        />
                      </div>
                    </div>
                  </PanelSection>

                  {/* Confidence */}
                  <ConfidenceBadge
                    level={report.confidence.level}
                    reason={report.confidence.why}
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
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderColor: 'rgba(255, 107, 107, 0.3)',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: 'var(--olumi-danger)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {error.code}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(232, 236, 245, 0.8)', marginBottom: '0.75rem' }}>
                    {error.message}
                  </p>
                  {error.retryAfter && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(232, 236, 245, 0.6)' }}>
                      Retry after {error.retryAfter} seconds
                    </p>
                  )}
                  <button
                    onClick={handleReset}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      backgroundColor: 'var(--olumi-danger)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Cancelled */}
              {isCancelled && (
                <div
                  className="p-4 rounded-lg border text-center"
                  style={{
                    backgroundColor: 'rgba(247, 201, 72, 0.1)',
                    borderColor: 'rgba(247, 201, 72, 0.3)',
                  }}
                >
                  <p style={{ fontSize: '0.875rem', color: 'var(--olumi-warning)', marginBottom: '0.75rem' }}>
                    Analysis cancelled
                  </p>
                  <button
                    onClick={handleReset}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      backgroundColor: 'var(--olumi-primary)',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Start New Run
                  </button>
                </div>
              )}

              {/* Idle state */}
              {status === 'idle' && (
                <div className="text-center py-12">
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--olumi-text)',
                    marginBottom: '0.75rem'
                  }}>
                    Ready to analyze
                  </h3>
                  <p className="text-sm" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
                    Click "Run Analysis" to start analyzing your decision tree.
                  </p>
                </div>
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
          {activeTab === 'compare' && compareRunIds.length >= 2 && (
            <CompareView
              runIds={compareRunIds}
              onClose={handleCloseCompare}
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
