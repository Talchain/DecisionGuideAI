/**
 * PipelineStage Component
 *
 * Accordion item with status badge for Debug Panel V2 Pipeline tab.
 * Shows pipeline processing stages with expandable details.
 */

import { useState, CSSProperties } from 'react'
import { formatDuration } from '../utils'

export type StageStatus = 'success' | 'error' | 'pending' | 'skipped'

export interface PipelineStageProps {
  /** Stage name */
  name: string
  /** Stage status */
  status: StageStatus
  /** Duration in ms */
  duration_ms?: number
  /** Stage details (JSON object) */
  details?: Record<string, unknown>
  /** Default expanded state */
  defaultExpanded?: boolean
  /** Children to render when expanded (custom content) */
  children?: React.ReactNode
}

const STATUS_BADGES: Record<StageStatus, { bg: string; text: string; label: string }> = {
  success: { bg: '#dcfce7', text: '#166534', label: 'Success' },
  error: { bg: '#fee2e2', text: '#991b1b', label: 'Error' },
  pending: { bg: '#fef3c7', text: '#854d0e', label: 'Pending' },
  skipped: { bg: '#f1f5f9', text: '#64748b', label: 'Skipped' },
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function PipelineStage({
  name,
  status,
  duration_ms,
  details,
  defaultExpanded = false,
  children,
}: PipelineStageProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const badge = STATUS_BADGES[status]
  const hasContent = details !== undefined || children !== undefined

  const headerStyle: CSSProperties = {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: hasContent ? 'pointer' : 'default',
    background: expanded ? '#f8fafc' : '#fff',
    borderBottom: expanded ? '1px solid #e2e8f0' : 'none',
    transition: 'background 0.1s',
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={headerStyle}
        onClick={() => hasContent && setExpanded((v) => !v)}
        onMouseEnter={(e) => {
          if (hasContent) {
            e.currentTarget.style.background = '#f8fafc'
          }
        }}
        onMouseLeave={(e) => {
          if (hasContent && !expanded) {
            e.currentTarget.style.background = '#fff'
          }
        }}
        role={hasContent ? 'button' : undefined}
        tabIndex={hasContent ? 0 : undefined}
        aria-expanded={hasContent ? expanded : undefined}
        aria-label={`${name} stage, ${status}${duration_ms ? `, ${formatDuration(duration_ms)}` : ''}`}
        onKeyDown={(e) => {
          if (hasContent && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Stage name */}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{name}</span>

          {/* Status badge */}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: badge.bg,
              color: badge.text,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {badge.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Duration */}
          {duration_ms !== undefined && (
            <span
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: '#64748b',
              }}
            >
              {formatDuration(duration_ms)}
            </span>
          )}

          {/* Expand indicator */}
          {hasContent && (
            <span style={{ fontSize: 12, color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && hasContent && (
        <div style={{ padding: 12 }}>
          {children}
          {details && !children && (
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
                background: '#f8fafc',
                borderRadius: 4,
              }}
            >
              {formatJson(details)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default PipelineStage
