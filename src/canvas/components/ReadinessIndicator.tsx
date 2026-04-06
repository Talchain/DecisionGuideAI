/**
 * ReadinessIndicator Component
 *
 * Footer component showing decision readiness level.
 * Computed from graph health, ISL validation, and CEE signals.
 *
 * R4 Implementation: Shows ready | needs_review | not_ready
 */

import { memo, useMemo } from 'react'
import { CheckCircle2, AlertCircle, XCircle, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../store'
import { computeReadiness, type ReadinessLevel, type ReadinessResult } from '../../lib/readiness'
import { typography } from '../../styles/typography'

// =============================================================================
// Types
// =============================================================================

interface ReadinessIndicatorProps {
  /** Optional click handler to show details */
  onShowDetails?: () => void
  /** Compact mode (icon + text only) */
  compact?: boolean
  /** Custom class name */
  className?: string
}

// =============================================================================
// Constants
// =============================================================================

const LEVEL_CONFIG: Record<ReadinessLevel, {
  icon: typeof CheckCircle2
  label: string
  shortLabel: string
  bgColor: string
  textColor: string
  iconColor: string
  borderColor: string
}> = {
  ready: {
    icon: CheckCircle2,
    label: 'Ready for analysis',
    shortLabel: 'Ready',
    bgColor: 'bg-mint-50',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-500',
    borderColor: 'border-mint-200',
  },
  needs_review: {
    icon: AlertCircle,
    label: 'Review suggested',
    shortLabel: 'Review',
    bgColor: 'bg-sun-50',
    textColor: 'text-sun-700',
    iconColor: 'text-sun-500',
    borderColor: 'border-sun-200',
  },
  not_ready: {
    icon: XCircle,
    label: 'Not ready',
    shortLabel: 'Not ready',
    bgColor: 'bg-carrot-50',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-500',
    borderColor: 'border-carrot-200',
  },
}

// =============================================================================
// Component
// =============================================================================

/**
 * ReadinessIndicator
 *
 * Shows current decision readiness with expandable details.
 * Automatically computes from store state.
 */
export const ReadinessIndicator = memo(({
  onShowDetails,
  compact = false,
  className = '',
}: ReadinessIndicatorProps) => {
  // Get state from store
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const graphHealth = useCanvasStore(s => s.graphHealth)

  // Compute readiness
  const readiness: ReadinessResult = useMemo(() => {
    const hasOutcome = nodes.some(n => n.type === 'outcome')
    const hasDecision = nodes.some(n => n.type === 'decision')

    return computeReadiness({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      graphHealth,
      hasOutcome,
      hasDecision,
    })
  }, [nodes, edges, graphHealth])

  const config = LEVEL_CONFIG[readiness.level]
  const Icon = config.icon

  // Compact variant (just icon + text)
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 ${className}`}
        title={readiness.summary}
        data-testid="readiness-indicator-compact"
      >
        <Icon className={`w-4 h-4 ${config.iconColor}`} aria-hidden="true" />
        <span className={`${typography.code} font-medium ${config.textColor}`}>
          {config.shortLabel}
        </span>
      </div>
    )
  }

  // Full variant with click-to-expand
  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} ${className}`}
      data-testid="readiness-indicator"
    >
      <button
        type="button"
        onClick={onShowDetails}
        disabled={!onShowDetails}
        className={`w-full flex items-center gap-3 px-3 py-2 ${
          onShowDetails ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
        } transition-opacity`}
        aria-label={`Readiness: ${config.label}. ${readiness.summary}`}
      >
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0`} aria-hidden="true" />

        <div className="flex-1 min-w-0 text-left">
          <div className={`${typography.caption} font-semibold ${config.textColor}`}>
            {config.label}
          </div>
          <div className={`${typography.code} ${config.textColor} opacity-80 truncate`}>
            {readiness.summary}
          </div>
        </div>

        {onShowDetails && (
          <ChevronRight
            className={`w-4 h-4 ${config.iconColor} flex-shrink-0`}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Score bar (only if score is meaningful) */}
      {readiness.score > 0 && (
        <div className="px-3 pb-2">
          <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                readiness.level === 'ready'
                  ? 'bg-mint-400'
                  : readiness.level === 'needs_review'
                    ? 'bg-sun-400'
                    : 'bg-carrot-400'
              } transition-all duration-400`}
              style={{ width: `${Math.min(100, readiness.score)}%` }}
            />
          </div>
          <div className={`mt-1 ${typography.code} ${config.textColor} opacity-60 text-right`}>
            {readiness.score}% ready
          </div>
        </div>
      )}
    </div>
  )
})

ReadinessIndicator.displayName = 'ReadinessIndicator'

/**
 * ReadinessChip - Minimal inline version for toolbars
 */
export const ReadinessChip = memo(({
  className = '',
}: { className?: string }) => {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const graphHealth = useCanvasStore(s => s.graphHealth)

  const readiness = useMemo(() => {
    const hasOutcome = nodes.some(n => n.type === 'outcome')
    const hasDecision = nodes.some(n => n.type === 'decision')

    return computeReadiness({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      graphHealth,
      hasOutcome,
      hasDecision,
    })
  }, [nodes, edges, graphHealth])

  const config = LEVEL_CONFIG[readiness.level]
  const Icon = config.icon

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor} ${config.borderColor} border ${className}`}
      title={readiness.summary}
      data-testid="readiness-chip"
    >
      <Icon className={`w-3 h-3 ${config.iconColor}`} aria-hidden="true" />
      <span className={`${typography.code} font-medium ${config.textColor}`}>
        {config.shortLabel}
      </span>
    </div>
  )
})

ReadinessChip.displayName = 'ReadinessChip'

export default ReadinessIndicator
