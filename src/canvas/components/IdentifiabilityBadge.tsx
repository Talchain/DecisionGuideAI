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

const STATUS_CONFIG: Record<
  IdentifiabilityStatus,
  {
    label: string
    shortLabel: string
    icon: typeof CheckCircle2
    className: string
    description: string
    plainLanguage: string
  }
> = {
  identifiable: {
    label: 'Causal effect identifiable',
    shortLabel: 'Identifiable',
    icon: CheckCircle2,
    className: 'bg-paper-50 border-sand-200 text-green-700',
    description: 'Model has a unique solution. Analysis results are reliable.',
    plainLanguage: 'The model can reliably estimate causal effects. Your analysis results are trustworthy.',
  },
  underidentified: {
    label: 'Causal effect uncertain',
    shortLabel: 'Uncertain',
    icon: AlertTriangle,
    className: 'bg-paper-50 border-sand-200 text-amber-700',
    description: 'Possible confounding — consider adding more evidence or constraints.',
    plainLanguage: 'There may be unmeasured factors affecting results. Consider adding more edges or evidence to strengthen the model.',
  },
  overidentified: {
    label: 'Conflicting constraints',
    shortLabel: 'Conflicting',
    icon: XCircle,
    className: 'bg-paper-50 border-sand-200 text-red-700',
    description: 'Model has conflicting constraints. Review edge weights and probabilities.',
    plainLanguage: 'Some model constraints conflict with each other. Review your edge weights and probability estimates.',
  },
  unknown: {
    label: 'Run analysis to calculate',
    shortLabel: 'Unknown',
    icon: HelpCircle,
    className: 'bg-paper-50 border-sand-200 text-ink-500',
    description: 'Identifiability has not been checked yet. Run an analysis to calculate this.',
    plainLanguage: 'Run an analysis to determine whether causal effects can be reliably estimated.',
  },
}

interface IdentifiabilityBadgeProps {
  status: IdentifiabilityStatus
  message?: string
  className?: string
  /** Show short label instead of full label */
  compact?: boolean
  /** Show plain language explanation below */
  showExplanation?: boolean
}

export function IdentifiabilityBadge({
  status,
  message,
  className = '',
  compact = false,
  showExplanation = false,
}: IdentifiabilityBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  const tooltipContent = message || config.description

  return (
    <div className={showExplanation ? 'space-y-1' : ''}>
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
            {compact ? config.shortLabel : config.label}
          </span>
        </div>
      </Tooltip>
      {showExplanation && (
        <p className={`${typography.caption} text-ink-500 pl-1`}>
          {config.plainLanguage}
        </p>
      )}
    </div>
  )
}

/**
 * Get plain language explanation for an identifiability status
 */
export function getIdentifiabilityExplanation(status: IdentifiabilityStatus): string {
  return STATUS_CONFIG[status].plainLanguage
}

/**
 * Check if status indicates a problem that needs attention
 */
export function isIdentifiabilityWarning(status: IdentifiabilityStatus): boolean {
  return status === 'underidentified' || status === 'overidentified'
}
