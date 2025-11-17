/**
 * Debug Tray (M1.4 + S5-DEBUG)
 * Collapsible developer info showing Request IDs, limits, feature flags,
 * response hashes (determinism), performance metrics, and error logs
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { useLimitsStore } from '../stores/limitsStore'

interface DebugTrayProps {
  requestId?: string
  correlationId?: string
  responseHash?: string // S5-DEBUG: Determinism tracking
  lastRunTimestamp?: number // S5-DEBUG: Last run time
  performanceMetrics?: { // S5-DEBUG: Performance tracking
    runDuration?: number // ms
    nodeCount?: number
    edgeCount?: number
  }
  errors?: Array<{ // S5-DEBUG: Error logging
    timestamp: number
    message: string
    stack?: string
    correlationId?: string
  }>
}

export function DebugTray({
  requestId,
  correlationId,
  responseHash,
  lastRunTimestamp,
  performanceMetrics,
  errors
}: DebugTrayProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const { limits } = useLimitsStore()

  // S5-DEBUG: Check if clipboard API is available
  const clipboardAvailable = typeof navigator !== 'undefined' &&
                              navigator.clipboard &&
                              typeof navigator.clipboard.writeText === 'function'

  // S5-DEBUG: Copy hash to clipboard with feature detection
  const copyHash = async () => {
    if (!responseHash || !clipboardAvailable) return

    try {
      await navigator.clipboard.writeText(responseHash)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    } catch (error) {
      console.error('[DebugTray] Failed to copy to clipboard:', error)
    }
  }

  // S5-DEBUG: Format timestamp
  const formatTimestamp = (ts: number) => {
    const date = new Date(ts)
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  if (!import.meta.env.DEV && !import.meta.env.VITE_SHOW_DEBUG) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-gray-100 rounded-lg shadow-lg max-w-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-800 rounded-t-lg transition-colors"
      >
        <span className="text-xs font-mono font-semibold">Debug Info</span>
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="px-4 py-3 space-y-3 text-xs font-mono border-t border-gray-700">
          {requestId && (
            <div>
              <div className="text-gray-400 mb-1">PLoT Request ID:</div>
              <div className="text-green-400 break-all">{requestId}</div>
            </div>
          )}

          {correlationId && (
            <div>
              <div className="text-gray-400 mb-1">Assist Correlation ID:</div>
              <div className="text-blue-400 break-all">{correlationId}</div>
            </div>
          )}

          {limits && (
            <div>
              <div className="text-gray-400 mb-1">PLoT Limits:</div>
              <div className="text-gray-300 space-y-1">
                <div>Nodes: {limits.max_nodes}</div>
                <div>Edges: {limits.max_edges}</div>
                <div>Payload: {limits.max_body_kb} KB</div>
                <div>Rate: {limits.rate_limit_rpm} RPM</div>
                {limits.flags?.scm_lite !== undefined && (
                  <div>SCM Lite: {limits.flags.scm_lite ? 'ON' : 'OFF'}</div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="text-gray-400 mb-1">Environment:</div>
            <div className="text-gray-300">{import.meta.env.MODE}</div>
          </div>

          {/* S5-DEBUG: Response Hash (Determinism) */}
          {responseHash && (
            <div>
              <div className="text-gray-400 mb-1">Response Hash (Determinism):</div>
              <div className="flex items-center gap-2">
                <div className="text-purple-400 break-all font-mono text-xs">
                  {responseHash.substring(0, 16)}...
                </div>
                <button
                  onClick={copyHash}
                  disabled={!clipboardAvailable}
                  className={`p-1 rounded transition-colors ${
                    clipboardAvailable ? 'hover:bg-gray-700 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                  }`}
                  aria-label={clipboardAvailable ? 'Copy hash' : 'Clipboard unavailable'}
                  title={clipboardAvailable ? 'Copy full hash' : 'Clipboard API not available (requires HTTPS)'}
                >
                  {copiedHash ? (
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className={`w-3 h-3 ${clipboardAvailable ? 'text-gray-400' : 'text-gray-600'}`} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* S5-DEBUG: Last Run Timestamp */}
          {lastRunTimestamp && (
            <div>
              <div className="text-gray-400 mb-1">Last Run:</div>
              <div className="text-gray-300">
                {formatTimestamp(lastRunTimestamp)}
                <span className="text-gray-500 ml-2">
                  ({Math.round((Date.now() - lastRunTimestamp) / 1000)}s ago)
                </span>
              </div>
            </div>
          )}

          {/* S5-DEBUG: Performance Metrics */}
          {performanceMetrics && (
            <div>
              <div className="text-gray-400 mb-1">Performance:</div>
              <div className="text-gray-300 space-y-1">
                {performanceMetrics.runDuration !== undefined && (
                  <div>
                    Run: <span className="text-yellow-400">{performanceMetrics.runDuration}ms</span>
                  </div>
                )}
                {performanceMetrics.nodeCount !== undefined && (
                  <div>Nodes: {performanceMetrics.nodeCount}</div>
                )}
                {performanceMetrics.edgeCount !== undefined && (
                  <div>Edges: {performanceMetrics.edgeCount}</div>
                )}
              </div>
            </div>
          )}

          {/* S5-DEBUG: Error Logs */}
          {errors && errors.length > 0 && (
            <div>
              <div className="text-gray-400 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-400" />
                <span>Errors ({errors.length}):</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {errors.slice(0, 5).map((error, idx) => (
                  <div key={idx} className="bg-red-900/20 border border-red-800/30 rounded p-2">
                    <div className="text-red-400 text-xs mb-1">
                      {formatTimestamp(error.timestamp)}
                      {error.correlationId && (
                        <span className="text-gray-500 ml-2">
                          [{error.correlationId.substring(0, 8)}...]
                        </span>
                      )}
                    </div>
                    <div className="text-red-300 text-xs break-words">{error.message}</div>
                    {error.stack && (
                      <details className="mt-1">
                        <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-400">
                          Stack trace
                        </summary>
                        <pre className="text-xs text-gray-400 mt-1 overflow-x-auto max-w-full whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                {errors.length > 5 && (
                  <div className="text-gray-500 text-xs text-center">
                    ...and {errors.length - 5} more errors
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
