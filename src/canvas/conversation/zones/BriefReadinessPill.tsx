/**
 * BriefReadinessPill — aggregate readiness indicator.
 *
 * Outlined pill, 26px height, coloured dot + "{Level} readiness" + chevron.
 * Low = factor colour, Medium = warning, High = success.
 * Clicking toggles guidance strip visibility.
 */

import type { BriefReadiness } from '../hooks/useBriefSignals'

const READINESS_CONFIG: Record<BriefReadiness, { label: string; dotColor: string; borderColor: string }> = {
  low:    { label: 'Low readiness',    dotColor: '#B0A899', borderColor: 'rgba(176,168,153,0.3)' },
  medium: { label: 'Medium readiness', dotColor: '#FFA656', borderColor: 'rgba(255,166,86,0.3)' },
  high:   { label: 'High readiness',   dotColor: '#67C89E', borderColor: 'rgba(103,200,158,0.3)' },
}

interface BriefReadinessPillProps {
  readiness: BriefReadiness
  expanded: boolean
  onToggle: () => void
}

export function BriefReadinessPill({ readiness, expanded, onToggle }: BriefReadinessPillProps) {
  const config = READINESS_CONFIG[readiness]

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`
        inline-flex items-center rounded-full
        bg-transparent text-text-body cursor-pointer
        hover:bg-panel-hover transition-all duration-200
        focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-info
        focus-visible:outline-none
      `}
      style={{
        gap: 5,
        height: 26,
        padding: '0 9px',
        borderRadius: 999,
        border: `1px solid ${config.borderColor}`,
        fontSize: 11,
        fontWeight: 500,
      }}
      data-testid="brief-readiness-pill"
    >
      <span
        className="flex-shrink-0 rounded-full"
        style={{ width: 6, height: 6, background: config.dotColor }}
        aria-hidden="true"
      />
      <span>{config.label}</span>
      <svg
        width="10" height="10" viewBox="0 0 24 24" fill="none"
        aria-hidden="true"
        className="flex-shrink-0"
        style={{ stroke: 'var(--text-light, #908D8D)', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }}
      >
        {expanded
          ? <path d="M18 15l-6-6-6 6" />
          : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  )
}
