/**
 * Severity-Styled Critiques
 *
 * Groups CEE critiques by severity with visual hierarchy.
 * Answers: "Which issues are critical vs nice-to-know?"
 *
 * Features:
 * - Three severity levels: ERROR (critical), WARNING (improvement), INFO (observation)
 * - Color-coded groups with icons
 * - ERROR always expanded, WARNING/INFO collapsible
 * - Shows suggested actions when available
 */

import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useState } from 'react'

interface Critique {
  message: string
  severity: 'BLOCKER' | 'IMPROVEMENT' | 'OBSERVATION'
  semantic_severity: 'ERROR' | 'WARNING' | 'INFO'
  suggested_action?: string
}

interface SeverityStyledCritiquesProps {
  critiques: Critique[]
}

type SeveritySemantic = 'ERROR' | 'WARNING' | 'INFO'

interface SeverityConfig {
  icon: typeof AlertCircle
  iconColor: string
  bgColor: string
  borderColor: string
  badgeColor: string
  label: string
  order: number
  defaultExpanded: boolean
}

const severityConfig: Record<SeveritySemantic, SeverityConfig> = {
  ERROR: {
    icon: AlertCircle,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeColor: 'bg-red-600 text-white',
    label: 'Critical',
    order: 1,
    defaultExpanded: true,
  },
  WARNING: {
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-600 text-white',
    label: 'Warning',
    order: 2,
    defaultExpanded: false,
  },
  INFO: {
    icon: Info,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-600 text-white',
    label: 'Info',
    order: 3,
    defaultExpanded: false,
  },
}

export function SeverityStyledCritiques({
  critiques,
}: SeverityStyledCritiquesProps): JSX.Element {
  // Group by semantic_severity
  const grouped = critiques.reduce(
    (acc, critique) => {
      const severity = critique.semantic_severity
      if (!acc[severity]) acc[severity] = []
      acc[severity].push(critique)
      return acc
    },
    {} as Record<SeveritySemantic, Critique[]>
  )

  // Sort groups by priority
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) => severityConfig[a as SeveritySemantic].order - severityConfig[b as SeveritySemantic].order
  )

  return (
    <div className="space-y-3 font-sans p-6">
      <h3 className="text-sm font-semibold text-storm-900">Issues & Recommendations</h3>

      {sortedGroups.map(([severity, items]) => (
        <CritiqueGroup
          key={severity}
          severity={severity as SeveritySemantic}
          items={items as Critique[]}
        />
      ))}
    </div>
  )
}

function CritiqueGroup({
  severity,
  items,
}: {
  severity: SeveritySemantic
  items: Critique[]
}): JSX.Element {
  const config = severityConfig[severity]
  const [expanded, setExpanded] = useState(config.defaultExpanded)

  const Icon = config.icon

  // ERROR is always expanded (not toggleable)
  const isExpandable = severity !== 'ERROR'

  return (
    <div className={`border ${config.borderColor} rounded-lg overflow-hidden`}>
      <button
        onClick={() => isExpandable && setExpanded(!expanded)}
        className={`
          w-full px-4 py-3 flex items-center justify-between
          ${config.bgColor} ${isExpandable ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'}
          transition
        `}
        disabled={!isExpandable}
        aria-expanded={isExpandable ? expanded : undefined}
        aria-label={`${config.label} issues`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${config.iconColor}`} aria-hidden="true" />
          <span className={`text-sm font-medium ${config.iconColor}`}>{config.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
            {items.length}
          </span>
        </div>
        {isExpandable && (
          <span className={`text-sm ${config.iconColor}`} aria-hidden="true">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </button>

      {expanded && (
        <div
          className={`p-4 space-y-3 ${config.bgColor} border-t ${config.borderColor}`}
          role="region"
          aria-label={`${config.label} issues details`}
        >
          {items.map((item, idx) => (
            <div key={idx} className="space-y-1">
              <p className="text-sm text-storm-900">{item.message}</p>
              {item.suggested_action && (
                <p className="text-xs text-storm-600 pl-3 border-l-2 border-storm-300">
                  → {item.suggested_action}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
