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

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { X, History as HistoryIcon, GitCompare as CompareIcon, Eye, Check, XCircle, Play, AlertCircle } from 'lucide-react'
import { useCanvasStore, selectResultsStatus, selectProgress, selectReport, selectError, selectViolations, selectSeed, selectHash, selectPreviewMode, selectPreviewReport, selectPreviewSeed, selectPreviewHash, selectStagedNodeChanges, selectStagedEdgeChanges, selectPreviewStatus, selectPreviewProgress, selectPreviewError } from '../store'
import type { ValidationViolation } from '../store'
import { usePreviewRun } from '../hooks/usePreviewRun'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
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
import { ResultsDiff } from '../components/ResultsDiff'
import { PreviewDiff } from '../components/PreviewDiff'
import { Sparkline } from '../components/Sparkline'
import type { StoredRun } from '../store/runHistory'
import { loadRuns } from '../store/runHistory'
import { useToast } from '../ToastContext'

interface ResultsPanelProps {
  isOpen: boolean
  onClose: () => void
  onCancel?: () => void
  onRunAgain?: () => void
}

type TabId = 'latest' | 'history' | 'compare'

/**
 * Format timestamp as relative time
 * e.g., "2 minutes ago", "1 hour ago", "just now"
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

export function ResultsPanel({ isOpen, onClose, onCancel, onRunAgain }: ResultsPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  const mainStatus = useCanvasStore(selectResultsStatus)
  const mainProgress = useCanvasStore(selectProgress)
  const mainReport = useCanvasStore(selectReport)
  const mainError = useCanvasStore(selectError)
  const violations = useCanvasStore(selectViolations)
  const seed = useCanvasStore(selectSeed)
  const hash = useCanvasStore(selectHash)

  const resultsReset = useCanvasStore(s => s.resultsReset)
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)
  const { showToast } = useToast()

  // Preview Mode state and actions
  const previewMode = useCanvasStore(selectPreviewMode)
  const previewReport = useCanvasStore(selectPreviewReport)
  const previewSeed = useCanvasStore(selectPreviewSeed)
  const previewHash = useCanvasStore(selectPreviewHash)
  const previewStatus = useCanvasStore(selectPreviewStatus)
  const previewProgress = useCanvasStore(selectPreviewProgress)
  const previewError = useCanvasStore(selectPreviewError)
  const stagedNodeChanges = useCanvasStore(selectStagedNodeChanges)
  const stagedEdgeChanges = useCanvasStore(selectStagedEdgeChanges)
  const previewApply = useCanvasStore(s => s.previewApply)
  const previewDiscard = useCanvasStore(s => s.previewDiscard)
  const { runPreview } = usePreviewRun()

  // A11y: Respect motion preferences
  const prefersReducedMotion = usePrefersReducedMotion()

  // Conditionally use preview status when in preview mode
  const status = previewMode ? previewStatus : mainStatus
  const progress = previewMode ? previewProgress : mainProgress
  const report = previewMode && previewReport ? previewReport : mainReport
  const error = previewMode ? previewError : mainError

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('latest')

  // Get previous run for diff comparison
  // Memoize loadRuns() call since it reads from localStorage (expensive I/O)
  // Invalidate when hash changes (indicates new run saved)
  const allRuns = useMemo(() => loadRuns(), [hash])
  const latestRun = allRuns.length >= 1 ? allRuns[0] : null
  const previousRun = allRuns.length >= 2 ? allRuns[1] : null

  // Get sparkline data (last 5 runs' likely values)
  // Filter out undefined/NaN values to prevent SVG rendering issues
  // Memoize since this involves array operations on every render
  const sparklineValues = useMemo(() =>
    allRuns
      .slice(0, 5)
      .reverse()
      .map(run => run.report?.results?.likely)
      .filter((val): val is number => typeof val === 'number' && !isNaN(val)),
    [allRuns]
  )

  // Compare state
  const [compareRunIds, setCompareRunIds] = useState<string[]>([])

  // Extract metadata for header (template, seed, hash, timestamp)
  // Prefer preview values when in preview mode, fallback to main/latest run
  // Memoize to avoid recalculating on every render
  const { templateName, displaySeed, displayHash, displayTimestamp } = useMemo(() => ({
    templateName: latestRun?.templateId || 'Canvas',
    displaySeed: previewMode && previewSeed !== undefined ? previewSeed : (seed ?? latestRun?.seed),
    displayHash: previewMode && previewHash ? previewHash : (hash ?? latestRun?.hash),
    displayTimestamp: previewMode ? null : latestRun?.ts, // Hide timestamp in preview mode to avoid misleading stale dates
  }), [latestRun, previewMode, previewSeed, previewHash, seed, hash])

  // Rate limit countdown
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

  // Initialize countdown when error with retryAfter appears
  useEffect(() => {
    if (error?.retryAfter) {
      // Handle fractional seconds by ceiling to ensure minimum 1-second display
      setRetryCountdown(Math.ceil(error.retryAfter))
    } else {
      setRetryCountdown(null)
    }
  }, [error?.retryAfter])

  // Countdown timer
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return

    const timer = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev === null || prev <= 1) {
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [retryCountdown])

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
      // Validate hash to prevent injection attacks
      // Allow: alphanumeric, hyphens, underscores, periods, base64 padding (=)
      // This covers hex hashes, base64, and UUID variants
      const sanitizedHash = hash.replace(/[^a-zA-Z0-9\-_.=]/g, '')

      if (sanitizedHash !== hash) {
        console.warn('[ResultsPanel] Sanitized hash from:', hash, 'to:', sanitizedHash)
        showToast('Invalid run hash - contains unsafe characters', 'error')
        return
      }

      // Construct share URL with validated hash
      const shareUrl = `${window.location.origin}${window.location.pathname}#run=${encodeURIComponent(sanitizedHash)}`
      navigator.clipboard.writeText(shareUrl)
      showToast('Run URL copied to clipboard', 'success')
    }
  }, [hash, showToast])

  const handleApplyPreview = useCallback(() => {
    previewApply()
    showToast('Preview changes applied — press ⌘Z to undo', 'success')
  }, [previewApply, showToast])

  const handleDiscardPreview = useCallback(() => {
    previewDiscard()
    showToast('Changes undone - your graph is unchanged', 'info')
  }, [previewDiscard, showToast])

  const handleRunPreview = useCallback(() => {
    // Run preview with current seed or use default
    const previewSeed = seed ?? 1337
    // Template ID "canvas" indicates canvas-originated run (vs pure template run)
    // The actual graph comes from previewGetMergedGraph(), not the template
    runPreview('canvas', previewSeed)
    showToast('Testing your changes with preview analysis', 'info')
  }, [runPreview, seed, showToast])

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
            {activeTab === 'latest' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    color: 'var(--olumi-text)',
                    lineHeight: 1.2,
                  }}
                >
                  Results
                </h2>
                {latestRun && (
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      color: 'rgba(232, 236, 245, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{templateName}</span>
                    {displaySeed !== undefined && (
                      <>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span>Seed {displaySeed}</span>
                      </>
                    )}
                    {displayHash && (
                      <>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span title={displayHash}>{displayHash.substring(0, 8)}</span>
                      </>
                    )}
                    {previewMode ? (
                      <>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span style={{ fontWeight: 500, color: 'var(--olumi-primary)' }}>Preview</span>
                      </>
                    ) : displayTimestamp ? (
                      <>
                        <span style={{ opacity: 0.5 }}>•</span>
                        <span>{formatRelativeTime(displayTimestamp)}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--olumi-text)',
                }}
              >
                {activeTab === 'history' ? 'Run history' : 'Compare runs'}
              </h2>
            )}
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
            {/* Preview Mode pill */}
            {previewMode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(91, 108, 255, 0.2)',
                  border: '1px solid var(--olumi-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: 'var(--olumi-primary)',
                }}
              >
                <Eye className="w-3 h-3" />
                Preview Mode
              </div>
            )}
            {/* Sparkline - Show trend over recent runs */}
            {activeTab === 'latest' && sparklineValues.length >= 2 && isComplete && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkline
                  values={sparklineValues}
                  width={60}
                  height={20}
                  strokeColor="var(--olumi-primary)"
                  strokeWidth={1.5}
                />
                <span style={{ fontSize: '0.6875rem', color: 'rgba(232, 236, 245, 0.5)' }}>
                  Last {sparklineValues.length} runs
                </span>
              </div>
            )}
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
            prefersReducedMotion={prefersReducedMotion}
          />
          <Tab
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            label="History"
            icon={<HistoryIcon className="w-4 h-4" />}
            shortcut="⌘2"
            prefersReducedMotion={prefersReducedMotion}
          />
          <Tab
            active={activeTab === 'compare'}
            onClick={() => setActiveTab('compare')}
            label="Compare"
            icon={<CompareIcon className="w-4 h-4" />}
            shortcut="⌘⇧C"
            disabled={compareRunIds.length < 2}
            badge={compareRunIds.length >= 2 ? String(compareRunIds.length) : undefined}
            prefersReducedMotion={prefersReducedMotion}
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
                      status === 'preparing' ? 'Getting ready to run your analysis' :
                      status === 'connecting' ? 'Connecting to analysis engine' :
                      'Running your decision analysis'
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

                  {/* PreviewDiff - Show when in preview mode with preview report */}
                  {previewMode && previewReport && (
                    <PreviewDiff
                      currentReport={report}
                      previewReport={previewReport}
                    />
                  )}

                  {/* ResultsDiff - Show changes from previous run (not in preview mode) */}
                  {!previewMode && previousRun && (
                    <ResultsDiff
                      currentLikely={report.results.likely}
                      previousLikely={previousRun.report.results.likely}
                      units={report.results.units}
                      currentDrivers={report.drivers?.map(d => ({ label: d.label, impact: d.impact }))}
                      previousDrivers={previousRun.report.drivers?.map(d => ({ label: d.label, impact: d.impact }))}
                    />
                  )}

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
                          fontSize: '0.9375rem',
                          fontWeight: 600,
                          color: 'var(--olumi-text)',
                          marginBottom: '0.75rem',
                        }}
                      >
                        What's driving this outcome
                      </h3>
                      <DriverChips drivers={report.drivers} />
                    </div>
                  )}

                  {/* Recommendations */}
                  <WhyPanel report={report} />

                  {/* Preview Mode Actions */}
                  {previewMode && (
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(91, 108, 255, 0.08)',
                        border: '1px solid rgba(91, 108, 255, 0.2)',
                      }}
                    >
                      <div style={{ marginBottom: '0.75rem' }}>
                        <h4
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--olumi-text)',
                            marginBottom: '0.375rem',
                          }}
                        >
                          Preview Mode Active
                        </h4>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(232, 236, 245, 0.7)', margin: 0 }}>
                          {previewReport ? (
                            <>
                              Preview complete. Apply to save these changes to your graph, or discard to undo.
                              {(stagedNodeChanges.size > 0 || stagedEdgeChanges.size > 0) && (
                                <span style={{ display: 'block', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                  {stagedNodeChanges.size} node{stagedNodeChanges.size !== 1 ? 's' : ''}, {stagedEdgeChanges.size} edge{stagedEdgeChanges.size !== 1 ? 's' : ''} ready to apply
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              Edit nodes in the inspector, then run a preview to see how changes affect your analysis.
                              {(stagedNodeChanges.size > 0 || stagedEdgeChanges.size > 0) && (
                                <span style={{ display: 'block', marginTop: '0.25rem', fontWeight: 600, color: 'var(--olumi-primary)' }}>
                                  {stagedNodeChanges.size + stagedEdgeChanges.size} change{(stagedNodeChanges.size + stagedEdgeChanges.size) !== 1 ? 's' : ''} ready to preview
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {/* Run Preview button - shown when no preview report or want to re-run */}
                        {(!previewReport || (stagedNodeChanges.size > 0 || stagedEdgeChanges.size > 0)) && (
                          <button
                            onClick={handleRunPreview}
                            disabled={isLoading}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.375rem',
                              padding: '0.625rem 1rem',
                              fontSize: '0.875rem',
                              borderRadius: '0.375rem',
                              border: 'none',
                              backgroundColor: 'var(--olumi-primary)',
                              color: 'white',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              fontWeight: 500,
                              transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
                              opacity: isLoading ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (!isLoading) {
                                e.currentTarget.style.backgroundColor = '#4a5acc'
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'
                            }}
                          >
                            <Play className="w-4 h-4" />
                            {isLoading ? 'Testing Changes...' : 'Test Changes'}
                          </button>
                        )}

                        {/* Apply/Discard buttons - shown when preview report exists */}
                        {previewReport && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={handleApplyPreview}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.375rem',
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                borderRadius: '0.375rem',
                                border: 'none',
                                backgroundColor: 'var(--olumi-success)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 500,
                                transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#1ba870'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--olumi-success)'
                              }}
                            >
                              <Check className="w-4 h-4" />
                              Save to Graph
                            </button>
                            <button
                              onClick={handleDiscardPreview}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.375rem',
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                borderRadius: '0.375rem',
                                border: '1px solid rgba(91, 108, 255, 0.3)',
                                backgroundColor: 'rgba(91, 108, 255, 0.1)',
                                color: 'var(--olumi-text)',
                                cursor: 'pointer',
                                fontWeight: 500,
                                transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.1)'
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                              Undo Changes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
                                showToast('Hash copied to clipboard', 'success')
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

                  {/* Validation Violations List */}
                  {violations && violations.length > 0 && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        marginBottom: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(255, 107, 107, 0.05)',
                        border: '1px solid rgba(255, 107, 107, 0.2)',
                      }}
                    >
                      <h4
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: 'var(--olumi-danger)',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {violations.length} Validation Error{violations.length > 1 ? 's' : ''}
                      </h4>
                      <ul
                        style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                        }}
                        role="list"
                        aria-label="Validation errors"
                      >
                        {violations.map((violation, idx) => (
                          <li
                            key={`${violation.field}-${idx}`}
                            style={{
                              padding: '0.625rem',
                              borderRadius: '0.25rem',
                              backgroundColor: 'rgba(0, 0, 0, 0.15)',
                              fontSize: '0.8125rem',
                              color: 'rgba(232, 236, 245, 0.9)',
                              lineHeight: 1.5,
                            }}
                            role="listitem"
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ fontWeight: 500 }}>{violation.message}</span>
                              {violation.field && (
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'rgba(232, 236, 245, 0.6)',
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  Field: {violation.field}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {retryCountdown !== null && retryCountdown > 0 && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: 'rgba(247, 201, 72, 0.15)',
                        border: '1px solid rgba(247, 201, 72, 0.3)',
                        fontSize: '0.75rem',
                        color: 'var(--olumi-warning)',
                        fontWeight: 500,
                        marginBottom: '0.75rem',
                      }}
                    >
                      <span>⏱️</span>
                      <span>
                        Retry in {retryCountdown} {retryCountdown === 1 ? 'second' : 'seconds'}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    disabled={retryCountdown !== null && retryCountdown > 0}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.375rem',
                      border: 'none',
                      backgroundColor: retryCountdown !== null && retryCountdown > 0 ? '#9ca3af' : 'var(--olumi-danger)',
                      color: 'white',
                      cursor: retryCountdown !== null && retryCountdown > 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                      opacity: retryCountdown !== null && retryCountdown > 0 ? 0.6 : 1,
                    }}
                  >
                    {retryCountdown !== null && retryCountdown > 0 ? 'Please wait...' : 'Retry'}
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
                    You cancelled this analysis
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
                    Run New Analysis
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
                  <p className="text-sm" style={{ color: 'rgba(232, 236, 245, 0.6)', lineHeight: 1.5 }}>
                    Insert a template, tweak a probability, or press ⌘/Ctrl+Enter to analyze your decision tree.
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
  prefersReducedMotion?: boolean
}

function Tab({ active, onClick, label, icon, shortcut, disabled = false, badge, prefersReducedMotion = false }: TabProps) {
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
        transition: prefersReducedMotion ? 'none' : 'all 0.2s ease',
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
