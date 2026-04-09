/**
 * P0.8 — Debug Drawer
 *
 * Accessible via Cmd+Shift+D (or Ctrl+Shift+D on Windows/Linux).
 *
 * Shows:
 * - trace_id / response_hash
 * - meta.isl_degraded, meta.cee_degraded
 * - Current state classification
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Bug, Copy, Check, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../store'
import { classifyState } from '../../lib/resultsInstrumentation'
import { typography } from '../../styles/typography'
import { copyTextToClipboard } from '../../utils/clipboard'

interface DebugDrawerProps {
  /** External visibility control (optional) */
  isOpen?: boolean
  onClose?: () => void
}

export function DebugDrawer({ isOpen: externalIsOpen, onClose }: DebugDrawerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())

  // Use external or internal state
  const isOpen = externalIsOpen ?? internalIsOpen
  const handleClose = onClose ?? (() => setInternalIsOpen(false))

  // Get debug data from store
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceePipelineTrace = useCanvasStore((s) => s.ceePipelineTrace)
  const errorDetails = useCanvasStore((s) => s.runMeta.errorDetails)
  // Debug options
  const debugRawCeeOutput = useCanvasStore((s) => s.debugRawCeeOutput)
  const setDebugRawCeeOutput = useCanvasStore((s) => s.setDebugRawCeeOutput)

  // Keyboard shortcut: Cmd+Shift+D — gated to dev builds only.
  // P0-3: in production this drawer would surface request IDs, response hashes,
  // CEE trace data and other debug fields without an expert-mode toggle. There
  // is currently no global expert-mode store to consult, so the safest fix is
  // to make the drawer strictly dev-only. If a runtime expert toggle is added
  // later, broaden this gate to `import.meta.env.DEV || expertMode`.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        setInternalIsOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Copy to clipboard
  const copyToClipboard = useCallback(async (value: string, field: string) => {
    const ok = await copyTextToClipboard(value)
    if (!ok) return
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }, [])

  // P0-3: belt-and-braces — never render in production even if external state
  // tries to force the drawer open.
  if (!import.meta.env.DEV) return null
  if (!isOpen) return null

  // Extract debug values - prioritize V1 fields over legacy
  const ceeTraceV1 = runMeta?.ceeTraceV1
  const ceeReview = runMeta?.ceeReview
  const ceeReviewV1 = runMeta?.ceeReviewV1

  // CEE Draft call ID: From pipeline trace (draft-graph endpoint)
  // Extract request_id from pipeline trace stages or use total_duration_ms as fingerprint
  const draftCallId = (ceePipelineTrace?.stages?.[0] as any)?.request_id
    ?? (ceePipelineTrace?.llm_calls?.[0] as any)?.request_id
    ?? (ceePipelineTrace ? `draft-${ceePipelineTrace.total_duration_ms}ms` : undefined)

  // CEE Review call ID: From V1 trace (review endpoint via PLoT /v2/run)
  const reviewCallId = ceeTraceV1?.plot_request_id
    ?? ceeTraceV1?.cee_sent_request_id
    ?? runMeta?.ceeTrace?.requestId

  const responseHash = results?.report?.model_card?.response_hash ?? results?.hash

  const ceeDegraded = ceeTraceV1?.degraded === true || ceeTraceV1?.id_mismatch === true
  const islDegraded = false // ISL degradation not currently tracked

  // Classify state
  const stateClass = classifyState({
    resultsStatus: results?.status ?? 'idle',
    confidenceLevel: results?.report?.confidence?.level,
    driversInformative: results?.report?.drivers_payload?.informative,
    optionCount: nodes.filter((n) => (n.data as any)?.kind === 'option').length,
    canCompare: nodes.filter((n) => (n.data as any)?.kind === 'option').length >= 2,
    isDegraded: ceeDegraded,
    hasError: results?.status === 'error',
  })

  const debugData = [
    { label: 'Draft Call ID', value: draftCallId ?? 'N/A', copyable: !!draftCallId },
    { label: 'Review Call ID', value: reviewCallId ?? 'N/A', copyable: !!reviewCallId },
    { label: 'Response Hash', value: responseHash ?? 'N/A', copyable: !!responseHash },
    { label: 'Results Status', value: results?.status ?? 'idle', copyable: false },
    { label: 'CEE Degraded', value: String(ceeDegraded), copyable: false },
    { label: 'ISL Degraded', value: String(islDegraded), copyable: false },
    { label: 'CEE ID Mismatch', value: String(ceeTraceV1?.id_mismatch ?? false), copyable: false },
    { label: 'CEE Latency', value: ceeTraceV1?.latency_ms ? `${ceeTraceV1.latency_ms}ms` : 'N/A', copyable: false },
  ]

  return (
    <div
      className="fixed bottom-4 right-4 w-80 bg-ink-900 text-white rounded-lg shadow-2xl z-50 overflow-hidden"
      role="dialog"
      aria-label="Debug information"
      data-testid="debug-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-ink-800 border-b border-ink-700">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-option" />
          <span className={`${typography.label} text-white`}>Debug Info</span>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 hover:bg-ink-700 rounded transition-colors"
          aria-label="Close debug drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
        {/* IDs Section */}
        <section>
          <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2`}>
            Identifiers
          </h3>
          <div className="space-y-1.5">
            {debugData.map(({ label, value, copyable }) => (
              <div key={label} className="flex items-center justify-between">
                <span className={`${typography.caption} text-ink-400`}>{label}</span>
                <div className="flex items-center gap-1">
                  <code className={`${typography.caption} text-mint-300 font-mono truncate max-w-[140px]`}>
                    {value}
                  </code>
                  {copyable && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(value, label)}
                      className="p-0.5 hover:bg-ink-700 rounded"
                      aria-label={`Copy ${label}`}
                    >
                      {copiedField === label ? (
                        <Check className="w-3 h-3 text-mint-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-ink-400" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* State Classification */}
        <section>
          <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2`}>
            State Classification
          </h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>has_results</span>
              <span className={`${typography.caption} ${stateClass.has_results ? 'text-mint-400' : 'text-ink-500'}`}>
                {String(stateClass.has_results)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>confidence_level</span>
              <span className={`${typography.caption} text-sky-400`}>
                {stateClass.confidence_level ?? 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>drivers_informative</span>
              <span className={`${typography.caption} ${stateClass.drivers_informative ? 'text-mint-400' : 'text-carrot-400'}`}>
                {stateClass.drivers_informative === null ? 'N/A' : String(stateClass.drivers_informative)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>option_count</span>
              <span className={`${typography.caption} text-white`}>{stateClass.option_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-ink-400`}>can_compare</span>
              <span className={`${typography.caption} ${stateClass.can_compare ? 'text-mint-400' : 'text-ink-500'}`}>
                {String(stateClass.can_compare)}
              </span>
            </div>
          </div>
        </section>

        {/* Graph Stats */}
        <section>
          <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2`}>
            Graph Stats
          </h3>
          <div className="flex gap-4">
            <div className="text-center">
              <div className={`${typography.body} font-semibold text-white`}>{nodes.length}</div>
              <div className={`${typography.caption} text-ink-400`}>Nodes</div>
            </div>
            <div className="text-center">
              <div className={`${typography.body} font-semibold text-white`}>{edges.length}</div>
              <div className={`${typography.caption} text-ink-400`}>Edges</div>
            </div>
          </div>
        </section>

        {/* Debug Options */}
        <section>
          <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2`}>
            Debug Options
          </h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={debugRawCeeOutput}
              onChange={(e) => setDebugRawCeeOutput(e.target.checked)}
              className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-option focus:ring-option focus:ring-offset-0"
            />
            <span className={`${typography.caption} text-ink-300`}>
              Raw CEE output (bypass repairs)
            </span>
          </label>
        </section>

        {/* CEE Review Summary */}
        {(ceeReview || ceeReviewV1) && (
          <section>
            <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2`}>
              CEE Review
            </h3>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`${typography.caption} text-ink-400`}>blocks</span>
                <span className={`${typography.caption} text-white`}>
                  {ceeReviewV1?.blocks?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`${typography.caption} text-ink-400`}>story.headline</span>
                <span className={`${typography.caption} text-sky-400 truncate max-w-[140px]`}>
                  {ceeReview?.story?.headline ? 'Present' : 'N/A'}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Error Details */}
        {errorDetails && errorDetails.length > 0 && (
          <section>
            <h3 className={`${typography.caption} text-ink-400 uppercase tracking-wide mb-2 flex items-center gap-1`}>
              <AlertTriangle className="w-3 h-3 text-carrot-400" />
              Recent Errors ({errorDetails.length})
            </h3>
            <div className="space-y-2">
              {errorDetails.map((error, index) => {
                const isExpanded = expandedErrors.has(index)
                const toggleExpanded = () => {
                  setExpandedErrors((prev) => {
                    const next = new Set(prev)
                    if (next.has(index)) {
                      next.delete(index)
                    } else {
                      next.add(index)
                    }
                    return next
                  })
                }

                return (
                  <div
                    key={`${error.timestamp}-${index}`}
                    className="bg-ink-800 rounded p-2"
                  >
                    {/* Error Header - Always Visible */}
                    <button
                      type="button"
                      onClick={toggleExpanded}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3 text-ink-400 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-ink-400 flex-shrink-0" />
                        )}
                        <span className={`${typography.caption} text-carrot-400 font-medium`}>
                          {error.service}
                        </span>
                        {error.httpStatus && (
                          <code className={`${typography.caption} text-ink-300 font-mono`}>
                            {error.httpStatus}
                          </code>
                        )}
                      </div>
                      <span className={`${typography.caption} text-ink-500 flex-shrink-0`}>
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </span>
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-ink-700 space-y-1.5">
                        {/* Message */}
                        <div>
                          <span className={`${typography.caption} text-ink-400`}>Message: </span>
                          <span className={`${typography.caption} text-white break-words`}>
                            {error.message}
                          </span>
                        </div>

                        {/* Endpoint */}
                        {error.endpoint && (
                          <div>
                            <span className={`${typography.caption} text-ink-400`}>Endpoint: </span>
                            <code className={`${typography.caption} text-mint-300 font-mono break-all`}>
                              {error.endpoint}
                            </code>
                          </div>
                        )}

                        {/* Error Code */}
                        {error.errorCode && (
                          <div>
                            <span className={`${typography.caption} text-ink-400`}>Code: </span>
                            <code className={`${typography.caption} text-sky-400 font-mono`}>
                              {error.errorCode}
                            </code>
                          </div>
                        )}

                        {/* Request ID */}
                        {error.requestId && (
                          <div className="flex items-center gap-1">
                            <span className={`${typography.caption} text-ink-400`}>Request ID: </span>
                            <code className={`${typography.caption} text-mint-300 font-mono truncate max-w-[140px]`}>
                              {error.requestId}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(error.requestId!, `error-${index}-requestId`)}
                              className="p-0.5 hover:bg-ink-700 rounded"
                              aria-label="Copy request ID"
                            >
                              {copiedField === `error-${index}-requestId` ? (
                                <Check className="w-3 h-3 text-mint-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-ink-400" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Retryable */}
                        {error.retryable !== undefined && (
                          <div>
                            <span className={`${typography.caption} text-ink-400`}>Retryable: </span>
                            <span className={`${typography.caption} ${error.retryable ? 'text-mint-400' : 'text-carrot-400'}`}>
                              {String(error.retryable)}
                            </span>
                          </div>
                        )}

                        {/* Raw Body */}
                        {error.rawBody && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`${typography.caption} text-ink-400`}>Raw Body:</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(error.rawBody!, `error-${index}-rawBody`)}
                                className="p-0.5 hover:bg-ink-700 rounded"
                                aria-label="Copy raw body"
                              >
                                {copiedField === `error-${index}-rawBody` ? (
                                  <Check className="w-3 h-3 text-mint-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-ink-400" />
                                )}
                              </button>
                            </div>
                            <pre className={`${typography.caption} text-ink-300 font-mono bg-ink-900 p-1.5 rounded text-[10px] overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap break-all`}>
                              {error.rawBody.length > 500
                                ? `${error.rawBody.slice(0, 500)}...`
                                : error.rawBody}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-ink-800 border-t border-ink-700">
        <span className={`${typography.caption} text-ink-500`}>
          Press <kbd className="px-1 py-0.5 bg-ink-700 rounded text-xs">Cmd+Shift+D</kbd> to toggle
        </span>
      </div>
    </div>
  )
}

export default DebugDrawer
