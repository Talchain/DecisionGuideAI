/**
 * IdentifiabilityBadge Component
 *
 * Displays whether a decision model is identifiable (solvable)
 * based on CEE/engine analysis.
 *
 * Status types:
 * - identifiable: Model has unique solution
 * - underidentified: Model lacks constraints (infinite solutions)
 * - overidentified: Model has conflicting constraints
 * - unknown: Identifiability not yet determined
 */

import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

export type IdentifiabilityStatus =
  | 'identifiable'
  | 'underidentified'
  | 'overidentified'
  | 'unknown'

/** Valid identifiability status values from backend */
const VALID_STATUSES = new Set<IdentifiabilityStatus>([
  'identifiable',
  'underidentified',
  'overidentified',
  'unknown',
])

/**
 * Safely normalize an identifiability tag from backend.
 * Returns 'unknown' for invalid/unexpected values to prevent runtime errors.
 */
export function normalizeIdentifiabilityTag(tag: string | undefined | null): IdentifiabilityStatus | null {
  if (!tag) return null
  return VALID_STATUSES.has(tag as IdentifiabilityStatus) ? (tag as IdentifiabilityStatus) : 'unknown'
}

interface IdentifiabilityBadgeProps {
  status: IdentifiabilityStatus
  message?: string
  className?: string
}

const STATUS_CONFIG: Record<
  IdentifiabilityStatus,
  {
    label: string
    icon: typeof CheckCircle2
    className: string
    description: string
  }
> = {
  identifiable: {
    label: 'Identifiable',
    icon: CheckCircle2,
    className: 'bg-green-50 border-green-200 text-green-700',
    description: 'Model has a unique solution. Analysis results are reliable.',
  },
  underidentified: {
    label: 'Under-identified',
    icon: AlertTriangle,
    className: 'bg-amber-50 border-amber-200 text-amber-700',
    description: 'Model lacks constraints. Consider adding more edges or evidence.',
  },
  overidentified: {
    label: 'Over-identified',
    icon: XCircle,
    className: 'bg-red-50 border-red-200 text-red-700',
    description: 'Model has conflicting constraints. Review edge weights and probabilities.',
  },
  unknown: {
    label: 'Run analysis to calculate',
    icon: HelpCircle,
    className: 'bg-gray-50 border-gray-200 text-gray-600',
    description: 'Identifiability has not been checked yet. Run an analysis to calculate this.',
  },
}

export function IdentifiabilityBadge({
  status,
  message,
  className = '',
}: IdentifiabilityBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const tooltipContent = message || config.description

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border
          ${config.className} ${className}
        `}
        role="status"
        aria-label={`Model identifiability: ${config.label}`}
        data-testid="identifiability-badge"
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={`${typography.labelSmall} font-medium`}>
          {config.label}
        </span>
      </div>
    </Tooltip>
  )
}
