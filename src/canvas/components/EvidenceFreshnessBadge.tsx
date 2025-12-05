/**
 * EvidenceFreshnessBadge Component
 *
 * Displays a visual indicator of how fresh/stale the evidence is
 * based on when nodes/edges were last updated.
 *
 * Freshness levels:
 * - fresh: Updated within 24 hours
 * - recent: Updated within 7 days
 * - aging: Updated within 30 days
 * - stale: Not updated in over 30 days
 */

import { Clock, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { Tooltip } from './Tooltip'

export type FreshnessLevel = 'fresh' | 'recent' | 'aging' | 'stale'

interface EvidenceFreshnessBadgeProps {
  /** Last update timestamp (ISO string or Date) */
  lastUpdated: string | Date | null
  /** Override freshness level (auto-calculated if not provided) */
  level?: FreshnessLevel
  /** Additional CSS classes */
  className?: string
  /** Show relative time label */
  showRelativeTime?: boolean
}

const LEVEL_CONFIG: Record<
  FreshnessLevel,
  {
    label: string
    icon: typeof Clock
    className: string
    bgClassName: string
    description: string
  }
> = {
  fresh: {
    label: 'Fresh',
    icon: CheckCircle2,
    className: 'text-green-700',
    bgClassName: 'bg-paper-50 border-sand-200',
    description: 'Evidence was reviewed or updated recently.',
  },
  recent: {
    label: 'Recent',
    icon: Clock,
    className: 'text-info-700',
    bgClassName: 'bg-paper-50 border-sand-200',
    description: 'Evidence was updated within the past week.',
  },
  aging: {
    label: 'Aging',
    icon: AlertTriangle,
    className: 'text-amber-700',
    bgClassName: 'bg-paper-50 border-sand-200',
    description: 'Evidence may need review. Consider updating sources.',
  },
  stale: {
    label: 'Stale',
    icon: AlertCircle,
    className: 'text-red-700',
    bgClassName: 'bg-paper-50 border-sand-200',
    description: 'Evidence is outdated. Review and update sources.',
  },
}

// Time thresholds in milliseconds
const FRESH_THRESHOLD = 24 * 60 * 60 * 1000 // 24 hours
const RECENT_THRESHOLD = 7 * 24 * 60 * 60 * 1000 // 7 days
const AGING_THRESHOLD = 30 * 24 * 60 * 60 * 1000 // 30 days

function calculateLevel(lastUpdated: Date | null): FreshnessLevel {
  if (!lastUpdated) return 'stale'

  const now = Date.now()
  const elapsed = now - lastUpdated.getTime()

  if (elapsed < FRESH_THRESHOLD) return 'fresh'
  if (elapsed < RECENT_THRESHOLD) return 'recent'
  if (elapsed < AGING_THRESHOLD) return 'aging'
  return 'stale'
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Never updated'

  const now = Date.now()
  const elapsed = now - date.getTime()

  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  return `${months}mo ago`
}

export function EvidenceFreshnessBadge({
  lastUpdated,
  level,
  className = '',
  showRelativeTime = true,
}: EvidenceFreshnessBadgeProps) {
  const parsedDate = lastUpdated
    ? typeof lastUpdated === 'string'
      ? new Date(lastUpdated)
      : lastUpdated
    : null

  const effectiveLevel = level ?? calculateLevel(parsedDate)
  const config = LEVEL_CONFIG[effectiveLevel]
  const Icon = config.icon
  const relativeTime = formatRelativeTime(parsedDate)

  const tooltipContent = `${config.description}${parsedDate ? ` Last updated: ${parsedDate.toLocaleDateString()}` : ''}`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${config.bgClassName} ${className}`}
        role="status"
        aria-label={`Evidence freshness: ${config.label}`}
        data-testid="evidence-freshness-badge"
      >
        <Icon className={`w-4 h-4 ${config.className}`} aria-hidden="true" />
        <span className={`${typography.labelSmall} font-medium ${config.className}`}>
          {config.label}
        </span>
        {showRelativeTime && (
          <span className={`${typography.caption} ${config.className} opacity-75`}>
            ({relativeTime})
          </span>
        )}
      </div>
    </Tooltip>
  )
}

/**
 * Compact variant for inline use in headers or lists
 */
export function EvidenceFreshnessCompact({
  lastUpdated,
  level,
  className = '',
}: Omit<EvidenceFreshnessBadgeProps, 'showRelativeTime'>) {
  const parsedDate = lastUpdated
    ? typeof lastUpdated === 'string'
      ? new Date(lastUpdated)
      : lastUpdated
    : null

  const effectiveLevel = level ?? calculateLevel(parsedDate)
  const config = LEVEL_CONFIG[effectiveLevel]
  const Icon = config.icon
  const relativeTime = formatRelativeTime(parsedDate)

  const tooltipContent = `${config.label}: ${config.description}`

  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div
        className={`inline-flex items-center gap-1 ${config.className} ${className}`}
        role="status"
        aria-label={`Evidence freshness: ${relativeTime}`}
        data-testid="evidence-freshness-compact"
      >
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className={`${typography.code} font-medium tabular-nums`}>
          {relativeTime}
        </span>
      </div>
    </Tooltip>
  )
}

/**
 * Calculate aggregate freshness for a collection of timestamps
 * Returns the oldest (stalest) level found
 */
export function calculateAggregateFreshness(
  timestamps: (string | Date | null)[]
): FreshnessLevel {
  if (timestamps.length === 0) return 'stale'

  let stalest: FreshnessLevel = 'fresh'
  const levelPriority: FreshnessLevel[] = ['fresh', 'recent', 'aging', 'stale']

  for (const ts of timestamps) {
    const date = ts ? (typeof ts === 'string' ? new Date(ts) : ts) : null
    const level = calculateLevel(date)
    const currentIndex = levelPriority.indexOf(stalest)
    const newIndex = levelPriority.indexOf(level)
    if (newIndex > currentIndex) {
      stalest = level
    }
  }

  return stalest
}

/**
 * Hook-friendly freshness calculator
 */
export function useFreshnessLevel(lastUpdated: string | Date | null): FreshnessLevel {
  const parsedDate = lastUpdated
    ? typeof lastUpdated === 'string'
      ? new Date(lastUpdated)
      : lastUpdated
    : null
  return calculateLevel(parsedDate)
}
