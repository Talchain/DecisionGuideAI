import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useCanvasStore, selectResultsStatus, selectProgress, selectReport, selectError, selectSeed, selectHash } from '../store'
import { ProgressStrip } from '../components/ProgressStrip'
import { SummaryCard } from '../../routes/templates/components/SummaryCard'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { ReproduceShareCard } from '../../routes/templates/components/ReproduceShareCard'
import { useLayerRegistration } from '../components/LayerProvider'

interface ResultsPanelProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Results panel for PLoT analysis
 *
 * Shows streaming progress and final report.
 * Managed by ResultsStatus state machine (idle/preparing/connecting/streaming/complete/error/cancelled).
 * Registered with LayerProvider for panel exclusivity (only one of Templates/Inspect/Results open).
 */
export function ResultsPanel({ isOpen, onClose }: ResultsPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)

  const status = useCanvasStore(selectResultsStatus)
  const progress = useCanvasStore(selectProgress)
  const report = useCanvasStore(selectReport)
  const error = useCanvasStore(selectError)
  const seed = useCanvasStore(selectSeed)
  const hash = useCanvasStore(selectHash)

  const resultsReset = useCanvasStore(s => s.resultsReset)

  // Register with LayerProvider for panel exclusivity and Esc handling
  useLayerRegistration('results-panel', 'panel', isOpen, onClose)

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>('button')
      firstFocusable?.focus()
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleReset = useCallback(() => {
    resultsReset()
  }, [resultsReset])

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
    statusText = 'Streaming'
    statusColor = 'rgba(62, 142, 237, 0.15)'
    statusTextColor = 'var(--olumi-info)'
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
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="complementary"
        aria-label="Analysis Results"
        className="fixed right-0 top-0 h-full w-full md:w-96 shadow-2xl z-50 flex flex-col overflow-hidden"
        style={{
          maxWidth: '420px',
          backgroundColor: 'var(--olumi-bg)',
          color: 'var(--olumi-text)'
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{
            background: 'linear-gradient(to right, rgba(91,108,255,0.08), rgba(123,70,255,0.08))',
            borderColor: 'rgba(91, 108, 255, 0.2)'
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--olumi-text)' }}>
              Results
            </h2>
            {/* Status pill */}
            <div
              className="px-2 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: statusColor,
                color: statusTextColor
              }}
            >
              {statusText}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-md transition-colors focus:outline-none focus:ring-2"
            style={{
              '--ring-color': 'var(--olumi-primary)'
            } as React.CSSProperties}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            aria-label="Close results panel"
          >
            <X className="w-5 h-5" style={{ color: 'var(--olumi-text)' }} />
          </button>
        </div>

        {/* Secondary meta: Seed • Hash */}
        {(seed !== undefined || hash) && (
          <div
            className="px-4 py-2 text-xs border-b"
            style={{
              backgroundColor: 'rgba(91, 108, 255, 0.05)',
              borderColor: 'rgba(91, 108, 255, 0.15)',
              color: 'rgba(232, 236, 245, 0.7)'
            }}
          >
            {seed !== undefined && <span>Seed: {seed}</span>}
            {seed !== undefined && hash && <span className="mx-2">•</span>}
            {hash && <span title={hash}>Hash: {hash.slice(0, 8)}...</span>}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                  // TODO: Wire cancel from useResultsRun
                  useCanvasStore.getState().resultsCancelled()
                }}
              />
              {/* Optional live log region */}
              <div
                className="text-sm p-3 rounded border"
                style={{
                  backgroundColor: 'rgba(91, 108, 255, 0.05)',
                  borderColor: 'rgba(91, 108, 255, 0.2)',
                  color: 'rgba(232, 236, 245, 0.6)'
                }}
                aria-live="polite"
                aria-atomic="false"
              >
                <div className="font-mono text-xs space-y-1">
                  {status === 'preparing' && <div>→ Validating graph structure...</div>}
                  {status === 'connecting' && <div>→ Establishing connection...</div>}
                  {status === 'streaming' && progress > 0 && <div>→ Processing nodes ({Math.round(progress)}% complete)...</div>}
                </div>
              </div>
            </>
          )}

          {/* Complete */}
          {isComplete && report && (
            <div className="space-y-4">
              <SummaryCard
                report={report}
                onCopyHash={() => {
                  if (hash) {
                    navigator.clipboard.writeText(hash)
                  }
                }}
              />
              <WhyPanel report={report} />
              <ReproduceShareCard
                report={report}
                template={{
                  id: 'canvas',
                  name: 'Canvas Analysis',
                  version: '1.0',
                  description: 'Custom decision tree',
                  default_seed: seed ?? 1337,
                  graph: {}
                }}
                seed={seed ?? 1337}
                onCopySeed={() => {
                  if (seed !== undefined) {
                    navigator.clipboard.writeText(String(seed))
                  }
                }}
                onCopyHash={() => {
                  if (hash) {
                    navigator.clipboard.writeText(hash)
                  }
                }}
                onAddToNote={() => {
                  // TODO: Implement
                }}
              />

              {/* CTAs */}
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 text-sm rounded-md border transition-colors focus:outline-none focus:ring-2"
                  style={{
                    borderColor: 'rgba(91, 108, 255, 0.3)',
                    color: 'var(--olumi-text)',
                    '--ring-color': 'var(--olumi-primary)'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Run Again
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {isError && error && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderColor: 'rgba(255, 107, 107, 0.3)'
              }}
              role="alert"
            >
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--olumi-danger)' }}>
                {error.code === 'RATE_LIMITED' ? 'Rate Limited' : 'Something went wrong'}
              </h3>
              <p className="text-sm mb-3" style={{ color: 'var(--olumi-text)' }}>
                {error.message}
              </p>
              {error.retryAfter && (
                <p className="text-xs mb-3" style={{ color: 'rgba(232, 236, 245, 0.7)' }}>
                  Retry after {error.retryAfter}s
                </p>
              )}
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--olumi-primary)',
                  color: 'white',
                  '--ring-color': 'var(--olumi-primary)'
                } as React.CSSProperties}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Cancelled */}
          {isCancelled && (
            <div
              className="p-4 rounded-lg border text-center"
              style={{
                backgroundColor: 'rgba(247, 201, 72, 0.1)',
                borderColor: 'rgba(247, 201, 72, 0.3)'
              }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--olumi-text)' }}>
                Run cancelled.
              </p>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm rounded-md focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--olumi-primary)',
                  color: 'white',
                  '--ring-color': 'var(--olumi-primary)'
                } as React.CSSProperties}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary-600)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--olumi-primary)'}
              >
                Run Again
              </button>
            </div>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
                No analysis running.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
