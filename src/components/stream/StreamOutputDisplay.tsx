/**
 * StreamOutputDisplay - Output Rendering Component
 * Phase 2E-D: Extracted from SandboxStreamPanel.tsx
 *
 * Renders streaming output with markdown preview, code copy buttons, and metrics.
 * Provides accessible streaming status updates.
 */

import { memo, useRef } from 'react'
import { formatUSD } from '../../lib/currency'

interface StreamOutputProps {
  output: string
  status: 'idle' | 'starting' | 'streaming' | 'complete' | 'error' | 'cancelled' | 'aborted' | 'limited' | 'done'
  mdHtml?: string
  mdEnabled?: boolean
  copyEnabled?: boolean
  copyOverlays?: Array<{ id: number; top: number; left: number; code: string; lang?: string }>
  onCopyCode?: (id: number, code: string) => void
  copiedId?: number | null
  failedId?: number | null
  ariaCopyMsg?: string
  metrics?: {
    cost?: number
    ttfbMs?: number
    tokenCount?: number
    resumeCount?: number
    lastSseId?: string
  }
  diagEnabled?: boolean
  perfEnabled?: boolean
  bufferEnabled?: boolean
}

function StreamOutputDisplay({
  output,
  status,
  mdHtml,
  mdEnabled = false,
  copyEnabled = false,
  copyOverlays = [],
  onCopyCode,
  copiedId = null,
  failedId = null,
  ariaCopyMsg = '',
  metrics,
  diagEnabled = false,
  perfEnabled = false,
  bufferEnabled = true,
}: StreamOutputProps) {
  const mdPreviewRef = useRef<HTMLDivElement | null>(null)

  return (
    <>
      <div
        data-testid="stream-output"
        className="min-h-[6rem] whitespace-pre-wrap font-mono text-sm p-2 rounded border bg-gray-50"
        aria-live="polite"
        aria-busy={status === 'streaming' ? 'true' : 'false'}
      >
        {status === 'idle' && (
          <div
            data-testid="idle-hint"
            aria-hidden="true"
            className="text-gray-500 italic text-xs"
          >
            Press Start to begin a draft critique.
          </div>
        )}
        {output}
      </div>

      {mdEnabled && mdHtml && (
        <div
          data-testid="md-preview"
          ref={mdPreviewRef}
          className="prose prose-sm max-w-none p-2 mt-2 border rounded bg-white relative"
          aria-hidden="true"
        >
          <div dangerouslySetInnerHTML={{ __html: mdHtml }} />
          {copyEnabled && copyOverlays.map((o) => (
            <button
              key={o.id}
              type="button"
              data-testid="copy-code-btn"
              title="Copy code"
              aria-label={o.lang ? `Copy ${o.lang} code` : 'Copy code'}
              data-copied={copiedId === o.id ? 'true' : undefined}
              data-failed={failedId === o.id ? 'true' : undefined}
              className="absolute text-[11px] px-2 py-0.5 rounded border bg-white shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ top: `${o.top}px`, left: `${o.left}px`, transform: 'translate(-100%, 0)' }}
              onClick={() => onCopyCode?.(o.id, o.code)}
            >
              {copiedId === o.id ? 'Copied' : 'Copy'}
            </button>
          ))}
        </div>
      )}

      {/* ARIA live copy status */}
      {copyEnabled && (
        <div role="status" aria-live="polite" className="sr-only" data-testid="copy-aria-status">
          {ariaCopyMsg}
        </div>
      )}

      {/* Cost badge */}
      {typeof metrics?.cost === 'number' && (
        <div
          data-testid="cost-badge"
          className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2"
          title="Estimated in-flight cost. Final cost appears on 'Done'."
        >
          {formatUSD(metrics.cost)}
        </div>
      )}

      {/* Diagnostics panel */}
      {diagEnabled && metrics && (
        <div data-testid="diagnostics-panel" className="mt-2 text-[11px] text-gray-600">
          <div className="font-medium text-gray-700">Diagnostics</div>
          <div data-testid="diag-last-event-id">SSE id: {metrics.lastSseId ?? '—'}</div>
          <div data-testid="diag-reconnects">Resumes: {metrics.resumeCount ?? 0}</div>
          <div data-testid="diag-stream-state">State: {status}</div>
          <div>TTFB: {metrics.ttfbMs != null ? `${metrics.ttfbMs}ms` : '—'}</div>
          <div data-testid="diag-token-count">Tokens: {metrics.tokenCount ?? 0}</div>
        </div>
      )}

      {/* Performance panel */}
      {perfEnabled && (
        <div data-testid="perf-panel" className="mt-2 text-[11px] text-gray-600">
          <div className="font-medium text-gray-700">Performance</div>
          <div>Buffer: {bufferEnabled ? 'ON' : 'OFF'}</div>
          <div>Preview length: {mdEnabled && mdHtml ? mdHtml.length : 0}</div>
          <div>Code blocks: {copyOverlays.length}</div>
        </div>
      )}
    </>
  )
}

export default memo(StreamOutputDisplay)
export type { StreamOutputProps }
