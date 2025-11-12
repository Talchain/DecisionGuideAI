/**
 * Debug Tray (M1.4)
 * Collapsible developer info showing Request IDs, limits, feature flags
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLimitsStore } from '../stores/limitsStore'

interface DebugTrayProps {
  requestId?: string
  correlationId?: string
}

export function DebugTray({ requestId, correlationId }: DebugTrayProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { limits } = useLimitsStore()

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
        </div>
      )}
    </div>
  )
}
