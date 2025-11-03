/**
 * Confidence Badge Component
 *
 * Displays confidence level (Low/Medium/High) with semantic colors
 * and a short reason that expands on hover/focus.
 */

import { memo } from 'react'

interface ConfidenceBadgeProps {
  level: 'low' | 'medium' | 'high'
  reason: string
}

export const ConfidenceBadge = memo(function ConfidenceBadge({ level, reason }: ConfidenceBadgeProps) {
  const config = {
    low: {
      label: 'Low Confidence',
      bg: 'rgba(255, 107, 107, 0.15)',
      border: 'rgba(255, 107, 107, 0.3)',
      text: 'var(--olumi-danger)',
      icon: '⚠️'
    },
    medium: {
      label: 'Medium Confidence',
      bg: 'rgba(247, 201, 72, 0.15)',
      border: 'rgba(247, 201, 72, 0.3)',
      text: 'var(--olumi-warning)',
      icon: '📊'
    },
    high: {
      label: 'High Confidence',
      bg: 'rgba(32, 201, 151, 0.15)',
      border: 'rgba(32, 201, 151, 0.3)',
      text: 'var(--olumi-success)',
      icon: '✓'
    }
  }

  const { label, bg, border, text, icon } = config[level]

  return (
    <div
      className="confidence-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.875rem',
        borderRadius: '0.375rem',
        border: `1px solid ${border}`,
        backgroundColor: bg,
        cursor: 'default'
      }}
      title={reason}
    >
      <span
        style={{
          fontSize: '1rem',
          lineHeight: 1
        }}
      >
        {icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        <div
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: text
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'rgba(232, 236, 245, 0.7)',
            lineHeight: 1.3
          }}
        >
          {reason}
        </div>
      </div>
    </div>
  )
})
