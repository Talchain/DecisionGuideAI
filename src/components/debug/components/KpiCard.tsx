/**
 * KpiCard Component
 *
 * Clickable stat card for Debug Panel V2 Summary tab.
 * Displays a label, value, and optional status indicator.
 */

import { CSSProperties } from 'react'

export type KpiStatus = 'ok' | 'warn' | 'error' | 'info' | 'neutral'

export interface KpiCardProps {
  /** Display label */
  label: string
  /** Primary value to display */
  value: string | number
  /** Optional secondary value */
  subValue?: string
  /** Status indicator color */
  status?: KpiStatus
  /** Click handler for navigation */
  onClick?: () => void
  /** Tooltip text */
  tooltip?: string
  /** Accessible label */
  ariaLabel?: string
  /** Compact mode for smaller viewports */
  compact?: boolean
}

const STATUS_COLORS: Record<KpiStatus, { bg: string; border: string; text: string }> = {
  ok: { bg: '#dcfce7', border: '#86efac', text: '#166534' },
  warn: { bg: '#fef9c3', border: '#fde047', text: '#854d0e' },
  error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
  info: { bg: '#e0f2fe', border: '#7dd3fc', text: '#0369a1' },
  neutral: { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' },
}

export function KpiCard({
  label,
  value,
  subValue,
  status = 'neutral',
  onClick,
  tooltip,
  ariaLabel,
  compact = false,
}: KpiCardProps) {
  const colors = STATUS_COLORS[status]
  const isClickable = !!onClick

  const baseStyle: CSSProperties = {
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: compact ? '8px 12px' : '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? 2 : 4,
    minWidth: compact ? 80 : 120,
    minHeight: compact ? 72 : undefined,
    cursor: isClickable ? 'pointer' : 'default',
    transition: 'transform 0.1s, box-shadow 0.1s',
  }

  const hoverStyle: CSSProperties = isClickable
    ? {
        transform: 'translateY(-1px)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }
    : {}

  return (
    <div
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (isClickable) {
          Object.assign(e.currentTarget.style, hoverStyle)
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = ''
        }
      }}
      title={tooltip}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <div
        style={{
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#64748b',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: compact ? 14 : 18,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: colors.text,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {subValue && (
        <div
          style={{
            fontSize: 11,
            color: '#64748b',
            fontFamily: 'monospace',
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  )
}

export default KpiCard
