/**
 * RobustnessIndicator - Shows ranking stability
 *
 * Task 3.1: Displays how stable the recommendation is across scenarios.
 * - "High robustness" — top option stable
 * - "Sensitive" — close race or sensitive to assumptions
 * - "Fragile" — ranking changes under perturbation
 */

import { Shield, ShieldCheck, ShieldAlert, Info } from 'lucide-react'
import { typography } from '../../../styles/typography'

export type RobustnessLevel = 'high' | 'medium' | 'low'

export interface RobustnessIndicatorProps {
  /** Robustness level from ISL coherence_warnings */
  level: RobustnessLevel
  /** Number of scenarios that could change ranking */
  switchingScenarios?: number
  /** Detailed explanation */
  explanation?: string
  /** Compact mode (badge only) */
  compact?: boolean
}

// Configuration for each robustness level
const robustnessConfig: Record<RobustnessLevel, {
  icon: typeof Shield
  bgColor: string
  textColor: string
  iconColor: string
  label: string
  shortLabel: string
  description: string
}> = {
  high: {
    icon: ShieldCheck,
    bgColor: 'bg-mint-50',
    textColor: 'text-mint-700',
    iconColor: 'text-mint-600',
    label: 'High Robustness',
    shortLabel: 'Robust',
    description: 'Top option is stable across scenarios',
  },
  medium: {
    icon: Shield,
    bgColor: 'bg-banana-50',
    textColor: 'text-banana-700',
    iconColor: 'text-banana-600',
    label: 'Sensitive',
    shortLabel: 'Sensitive',
    description: 'Close race — some scenarios could change ranking',
  },
  low: {
    icon: ShieldAlert,
    bgColor: 'bg-carrot-50',
    textColor: 'text-carrot-700',
    iconColor: 'text-carrot-600',
    label: 'Fragile',
    shortLabel: 'Fragile',
    description: 'Ranking changes under perturbation',
  },
}

/**
 * Robustness meter visualization (5 segments)
 */
function RobustnessMeter({ level }: { level: RobustnessLevel }) {
  const config = robustnessConfig[level]
  const filledSegments = level === 'high' ? 5 : level === 'medium' ? 3 : 1

  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i < filledSegments
              ? level === 'high'
                ? 'bg-mint-500'
                : level === 'medium'
                  ? 'bg-banana-500'
                  : 'bg-carrot-500'
              : 'bg-sand-200'
          }`}
        />
      ))}
    </div>
  )
}

export function RobustnessIndicator({
  level,
  switchingScenarios,
  explanation,
  compact = false,
}: RobustnessIndicatorProps) {
  const config = robustnessConfig[level]
  const Icon = config.icon

  // Build tooltip text
  const tooltipText = explanation || config.description
  const fullTooltip = switchingScenarios !== undefined && switchingScenarios > 0
    ? `${tooltipText} (${switchingScenarios} scenario${switchingScenarios === 1 ? '' : 's'} could change ranking)`
    : tooltipText

  if (compact) {
    // Compact mode: just a badge with icon
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor}`}
        title={fullTooltip}
        data-testid="robustness-indicator-compact"
      >
        <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} aria-hidden="true" />
        <span className={`${typography.caption} font-medium ${config.textColor}`}>
          {config.shortLabel}
        </span>
      </div>
    )
  }

  // Full mode: badge with meter and tooltip
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bgColor}`}
      data-testid="robustness-indicator"
    >
      <Icon className={`h-4 w-4 ${config.iconColor}`} aria-hidden="true" />
      <span className={`${typography.caption} ${config.textColor}`}>
        Robustness:
      </span>
      <RobustnessMeter level={level} />
      <span className={`${typography.caption} font-medium ${config.textColor}`}>
        {config.label}
      </span>
      {/* Info button for explanation */}
      <button
        type="button"
        className="p-0.5 rounded hover:bg-white/50 transition-colors"
        title={fullTooltip}
        aria-label={`Robustness explanation: ${fullTooltip}`}
      >
        <Info className={`h-3 w-3 ${config.iconColor}`} />
      </button>
    </div>
  )
}

/**
 * Get robustness level from switching scenarios count
 * Utility for components that only have scenario count
 */
export function getRobustnessLevel(switchingScenarios: number): RobustnessLevel {
  if (switchingScenarios === 0) return 'high'
  if (switchingScenarios <= 2) return 'medium'
  return 'low'
}

/**
 * Get user-friendly explanation based on level
 */
export function getRobustnessExplanation(level: RobustnessLevel): string {
  return robustnessConfig[level].description
}
