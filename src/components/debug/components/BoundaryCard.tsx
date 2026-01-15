/**
 * BoundaryCard Component
 *
 * Expandable request/response viewer for Debug Panel V2 Data Flow tab.
 * Shows service boundary details with collapsible JSON sections.
 */

import { useState, useCallback, CSSProperties } from 'react'
import { copyTextToClipboard } from '../../../utils/clipboard'

export type BoundaryStatus = 'success' | 'error' | 'pending' | 'unavailable'

export interface BoundaryCardProps {
  /** Card title (e.g., "UI → CEE") */
  title: string
  /** Endpoint path */
  endpoint: string | null
  /** HTTP status code */
  status: number | null
  /** Request duration in ms */
  duration_ms: number | null
  /** Request payload */
  request?: unknown
  /** Response payload */
  response?: unknown
  /** Error message if failed */
  error?: string
  /** Download handler */
  onDownload?: () => void
  /** Default expanded state */
  defaultExpanded?: boolean
  /** Overall status indicator */
  boundaryStatus?: BoundaryStatus
}

const STATUS_INDICATORS: Record<BoundaryStatus, { color: string; label: string }> = {
  success: { color: '#22c55e', label: 'Success' },
  error: { color: '#ef4444', label: 'Error' },
  pending: { color: '#f59e0b', label: 'Pending' },
  unavailable: { color: '#94a3b8', label: 'Unavailable' },
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatStatusCode(status: number | null): string {
  if (status === null || status === undefined) return '—'
  return String(status)
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function JsonSection({
  title,
  data,
  defaultExpanded = false,
}: {
  title: string
  data: unknown
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const success = await copyTextToClipboard(formatJson(data))
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [data])

  if (data === undefined || data === null) {
    return (
      <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11 }}>
        {title}: Not available
      </div>
    )
  }

  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <div
        style={{
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${title} section, click to ${expanded ? 'collapse' : 'expand'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{title}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
            style={{
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
              color: copied ? '#22c55e' : '#334155',
            }}
            aria-label={`Copy ${title}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <span style={{ fontSize: 11, color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: 12,
            fontSize: 10,
            lineHeight: 1.4,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 300,
            overflow: 'auto',
            background: '#fafafa',
          }}
        >
          {formatJson(data)}
        </pre>
      )}
    </div>
  )
}

export function BoundaryCard({
  title,
  endpoint,
  status,
  duration_ms,
  request,
  response,
  error,
  onDownload,
  defaultExpanded = false,
  boundaryStatus = 'unavailable',
}: BoundaryCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const statusIndicator = STATUS_INDICATORS[boundaryStatus]

  // Determine if we have any data to show
  const hasData = request !== undefined || response !== undefined

  const cardStyle: CSSProperties = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  }

  const headerStyle: CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: hasData ? 'pointer' : 'default',
    background: expanded ? '#f8fafc' : '#fff',
    borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
  }

  return (
    <div style={cardStyle}>
      <div
        style={headerStyle}
        onClick={() => hasData && setExpanded((v) => !v)}
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        aria-expanded={hasData ? expanded : undefined}
        aria-label={`${title} boundary, ${boundaryStatus}`}
        onKeyDown={(e) => {
          if (hasData && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status indicator */}
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: statusIndicator.color,
            }}
            title={statusIndicator.label}
          />

          {/* Title and endpoint */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{title}</div>
            {endpoint && (
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
                {endpoint}
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Status code */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>Status</div>
            <div
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: status && status >= 400 ? '#ef4444' : status ? '#22c55e' : '#94a3b8',
              }}
            >
              {formatStatusCode(status)}
            </div>
          </div>

          {/* Duration */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#64748b' }}>Duration</div>
            <div
              style={{
                fontSize: 12,
                fontFamily: 'monospace',
                fontWeight: 600,
                color: '#334155',
              }}
            >
              {formatDuration(duration_ms)}
            </div>
          </div>

          {/* Download button */}
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
              style={{
                padding: '4px 8px',
                fontSize: 10,
                cursor: 'pointer',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                background: '#fff',
              }}
              aria-label={`Download ${title} data`}
            >
              Download
            </button>
          )}

          {/* Expand indicator */}
          {hasData && (
            <span style={{ fontSize: 12, color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '8px 16px',
            background: '#fef2f2',
            borderBottom: '1px solid #fca5a5',
            color: '#991b1b',
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      {/* Expandable content */}
      {expanded && hasData && (
        <div>
          <JsonSection title="Request" data={request} />
          <JsonSection title="Response" data={response} defaultExpanded />
        </div>
      )}

      {/* No data placeholder */}
      {!hasData && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 11,
          }}
        >
          No data available for this boundary
        </div>
      )}
    </div>
  )
}

export default BoundaryCard
