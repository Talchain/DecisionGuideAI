/**
 * EvidenceCoverage Component
 *
 * Displays a visual indicator of how well a decision model is
 * supported by evidence (provenance data on edges).
 *
 * Coverage levels:
 * - full: All edges have provenance
 * - partial: Some edges have provenance
 * - minimal: Few edges have provenance
 * - none: No edges have provenance
 */

import { FileCheck2, FileQuestion, FileWarning, FileX } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

export type CoverageLevel = 'full' | 'partial' | 'minimal' | 'none'

interface EvidenceCoverageProps {
  /** Number of edges with provenance */
  evidencedCount: number
  /** Total number of edges */
  totalCount: number
  /** Override coverage level (auto-calculated if not provided) */
  level?: CoverageLevel
  /** Show percentage label */
  showPercentage?: boolean
  /** Additional CSS classes */
  className?: string
}

const LEVEL_CONFIG: Record<
  CoverageLevel,
  {
    label: string
    icon: typeof FileCheck2
    className: string
    progressColor: string
    description: string
  }
> = {
  full: {
    label: 'Full Coverage',
    icon: FileCheck2,
    className: 'text-green-700',
    progressColor: 'bg-green-500',
    description: 'All connections have documented evidence sources.',
  },
  partial: {
    label: 'Partial Coverage',
    icon: FileQuestion,
    className: 'text-info-700',
    progressColor: 'bg-info-500',
    description: 'Most connections have evidence, but some gaps remain.',
  },
  minimal: {
    label: 'Minimal Coverage',
    icon: FileWarning,
    className: 'text-amber-700',
    progressColor: 'bg-amber-500',
    description: 'Few connections have evidence. Consider adding sources.',
  },
  none: {
    label: 'No Coverage',
    icon: FileX,
    className: 'text-red-700',
    progressColor: 'bg-red-500',
    description: 'No connections have evidence sources documented.',
  },
}

function calculateLevel(evidencedCount: number, totalCount: number): CoverageLevel {
  if (totalCount === 0) return 'none'

  const percentage = (evidencedCount / totalCount) * 100

  if (percentage >= 100) return 'full'
  if (percentage >= 60) return 'partial'
  if (percentage > 0) return 'minimal'
  return 'none'
}

export function EvidenceCoverage({
  evidencedCount,
  totalCount,
  level,
  showPercentage = true,
  className = '',
}: EvidenceCoverageProps) {
  const effectiveLevel = level ?? calculateLevel(evidencedCount, totalCount)
  const config = LEVEL_CONFIG[effectiveLevel]
  const Icon = config.icon
  const percentage = totalCount > 0 ? Math.round((evidencedCount / totalCount) * 100) : 0

  const tooltipContent = `${config.description} (${evidencedCount}/${totalCount} edges)`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex flex-col gap-1.5 ${className}`}
        role="status"
        aria-label={`Evidence coverage: ${config.label}, ${percentage}%`}
        data-testid="evidence-coverage"
      >
        {/* Header with icon and label */}
        <div className={`flex items-center gap-1.5 ${config.className}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
          <span className={`${typography.labelSmall} font-medium`}>
            {config.label}
          </span>
          {showPercentage && (
            <span className={`${typography.code} tabular-nums`}>
              ({percentage}%)
            </span>
          )}
        </div>

        {/* Progress bar - P1.7: Added aria-valuetext for screen readers */}
        <div
          className="h-1.5 w-full bg-sand-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${percentage}% evidence coverage, ${evidencedCount} of ${totalCount} edges documented`}
          aria-label="Evidence coverage progress"
        >
          <div
            className={`h-full ${config.progressColor} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Count label */}
        <div className={`${typography.caption} text-ink-900/60`}>
          {evidencedCount} of {totalCount} edges documented
        </div>
      </div>
    </Tooltip>
  )
}

/**
 * Compact variant for inline use
 */
export function EvidenceCoverageCompact({
  evidencedCount,
  totalCount,
  level,
  className = '',
}: Omit<EvidenceCoverageProps, 'showPercentage'>) {
  const effectiveLevel = level ?? calculateLevel(evidencedCount, totalCount)
  const config = LEVEL_CONFIG[effectiveLevel]
  const Icon = config.icon
  const percentage = totalCount > 0 ? Math.round((evidencedCount / totalCount) * 100) : 0

  const tooltipContent = `${config.description} (${evidencedCount}/${totalCount} edges)`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex items-center gap-1 ${config.className} ${className}`}
        role="status"
        aria-label={`Evidence coverage: ${percentage}%`}
        data-testid="evidence-coverage-compact"
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={`${typography.code} font-medium tabular-nums`}>
          {percentage}%
        </span>
      </div>
    </Tooltip>
  )
}
