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
import { X, History as HistoryIcon, GitCompare as CompareIcon } from 'lucide-react'
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
      navigator.clipboard.writeText(hash)
      // TODO: Show toast notification
    }
  }, [hash])

  if (!isOpen) return null

  const isLoading = status === 'preparing' || status === 'connecting' || status === 'streaming'
  const isComplete = status === 'complete'
  const isError = status === 'error'
  const isCancelled = status === 'cancelled'

  // Status pill text
  let statusText = 'Idle'
  let statusColor = 'rgba(128, 128, 128, 0.2)'
  let statusTextColor = '#888'

  if (status === 'preparing') {
    statusText = 'Preparing'
    statusColor = 'rgba(91, 108, 255, 0.15)'
    statusTextColor = 'var(--olumi-primary)'
  } else if (status === 'connecting') {
    statusText = 'Connecting'
    statusColor = 'rgba(62, 142, 237, 0.15)'
    statusTextColor = 'var(--olumi-info)'
  } else if (status === 'streaming') {
    statusText = 'Analyzing'
    statusColor = 'rgba(91, 108, 255, 0.15)'
    statusTextColor = 'var(--olumi-primary)'
  } else if (status === 'complete') {
    statusText = 'Complete'
    statusColor = 'rgba(32, 201, 151, 0.15)'
    statusTextColor = 'var(--olumi-success)'
  } else if (status === 'error') {
    statusText = 'Error'
    statusColor = 'rgba(255, 107, 107, 0.15)'
    statusTextColor = 'var(--olumi-danger)'
  } else if (status === 'cancelled') {
    statusText = 'Cancelled'
    statusColor = 'rgba(247, 201, 72, 0.15)'
    statusTextColor = 'var(--olumi-warning)'
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1999,
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '480px',
          maxWidth: '100vw',
          backgroundColor: 'var(--olumi-bg)',
          borderLeft: '1px solid rgba(91, 108, 255, 0.2)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        }}
        role="dialog"
        aria-label="Results Panel"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(91, 108, 255, 0.15)',
            backgroundColor: 'rgba(91, 108, 255, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--olumi-text)',
              }}
            >
              Results
            </h2>
            {/* Status pill */}
            <div
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '9999px',
                backgroundColor: statusColor,
                fontSize: '0.75rem',
                fontWeight: 500,
                color: statusTextColor,
              }}
            >
              {statusText}
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              padding: '0.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close panel"
          >
            <X className="w-5 h-5" style={{ color: 'var(--olumi-text)' }} />
          </button>
        </div>

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(91, 108, 255, 0.2)',
            backgroundColor: 'rgba(91, 108, 255, 0.03)',
          }}
        >
          <Tab
            active={activeTab === 'latest'}
            onClick={() => setActiveTab('latest')}
            label="Latest Run"
            shortcut="⌘1"
          />
          <Tab
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
            icon={<HistoryIcon className="w-4 h-4" />}
            shortcut="⌘2"
          />
          <Tab
            active={activeTab === 'compare'}
            onClick={() => setActiveTab('compare')}
            label="Compare"
            icon={<CompareIcon className="w-4 h-4" />}
            shortcut="⌘⇧C"
            disabled={compareRunIds.length < 2}
            badge={compareRunIds.length >= 2 ? String(compareRunIds.length) : undefined}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                <div className="space-y-6">
                  {/* KPI Headline */}
                  <KPIHeadline
                    value={report.results.likely}
                    label="Most Likely Outcome"
                    units={report.results.units}
                    unitSymbol={report.results.unitSymbol}
                  />

                  {/* Range Chips */}
                  <RangeChips
                    conservative={report.results.conservative}
                    likely={report.results.likely}
                    optimistic={report.results.optimistic}
                    units={report.results.units}
                    unitSymbol={report.results.unitSymbol}
                  />

                  {/* Confidence Badge */}
                  <ConfidenceBadge
                    level={report.confidence.level}
                    reason={report.confidence.why}
                  />

                  {/* Drivers */}
                  {report.drivers && report.drivers.length > 0 && (
                    <div>
                      <h3
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--olumi-text)',
                          marginBottom: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Key Drivers
                      </h3>
                      <DriverChips drivers={report.drivers} />
                    </div>
                  )}

                  {/* Recommendations */}
                  <WhyPanel report={report} />

                  {/* Actions Row */}
                  <ActionsRow
                    onRunAgain={handleRunAgain}
                    onCompare={() => setActiveTab('history')}
                    onShare={handleShare}
                  />

                  {/* Reproducibility (collapsed metadata) */}
                  {(seed !== undefined || hash) && (
                    <details
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        border: '1px solid rgba(91, 108, 255, 0.15)',
                        backgroundColor: 'rgba(91, 108, 255, 0.03)',
                      }}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'rgba(232, 236, 245, 0.6)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Reproducibility Info
                      </summary>
                      <div
                        style={{
                          marginTop: '0.75rem',
                          fontSize: '0.8125rem',
                          color: 'rgba(232, 236, 245, 0.7)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                      >
                        {seed !== undefined && (
                          <div>
                            <span style={{ color: 'rgba(232, 236, 245, 0.5)' }}>Seed:</span>{' '}
                            <code style={{ fontFamily: 'monospace' }}>{seed}</code>
                          </div>
                        )}
                        {hash && (
                          <div>
                            <span style={{ color: 'rgba(232, 236, 245, 0.5)' }}>Hash:</span>{' '}
                            <code style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {hash.slice(0, 16)}...
                            </code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(hash)
                              }}
                              style={{
                                marginLeft: '0.5rem',
                                padding: '0.125rem 0.375rem',
                                fontSize: '0.6875rem',
                                borderRadius: '0.25rem',
                                border: '1px solid rgba(91, 108, 255, 0.3)',
                                backgroundColor: 'rgba(91, 108, 255, 0.1)',
                                color: 'var(--olumi-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
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
                // TODO: Load historical run into Latest tab
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
        </div>
      </div>
    </>
  )
}

interface TabProps {
  active: boolean
  onClick: () => void
  label: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  badge?: string
}

function Tab({ active, onClick, label, icon, shortcut, disabled = false, badge }: TabProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: '1 1 0',
        padding: '0.75rem 1rem',
        border: 'none',
        backgroundColor: active ? 'rgba(91, 108, 255, 0.1)' : 'transparent',
        color: active ? 'var(--olumi-primary)' : disabled ? 'rgba(232, 236, 245, 0.3)' : 'var(--olumi-text)',
        borderBottom: active ? '2px solid var(--olumi-primary)' : '2px solid transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.875rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.375rem',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        position: 'relative',
      }}
    >
      {icon}
      {label}
      {badge && (
        <span
          style={{
            padding: '0.125rem 0.375rem',
            borderRadius: '9999px',
            backgroundColor: 'var(--olumi-primary)',
            color: 'white',
            fontSize: '0.6875rem',
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
      {shortcut && !active && (
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'rgba(232, 236, 245, 0.4)',
            marginLeft: '0.25rem',
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  )
}
