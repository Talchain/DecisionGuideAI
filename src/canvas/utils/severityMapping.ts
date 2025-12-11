/**
 * Severity Mapping Utilities
 *
 * Centralised mapping of severity strings from various sources
 * (validation, critique, bias, CEE, readiness) to internal priorities.
 *
 * Single source of truth for priority classification.
 */

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'
export type GuidanceSeverity = 'blocker' | 'warning' | 'info'
export type ActionSource = 'readiness' | 'validation' | 'critique' | 'bias' | 'cee'

/**
 * Priority sort order (lower = higher priority)
 */
export const PRIORITY_ORDER: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

/**
 * Map severity string to ActionPriority based on source context
 *
 * @param severity - Raw severity string from source
 * @param source - Source of the severity (validation, critique, bias, readiness, cee)
 * @returns ActionPriority - critical | high | medium | low
 */
export function mapSeverityToPriority(
  severity: string | undefined | null,
  source: ActionSource
): ActionPriority {
  const upperSeverity = severity?.toUpperCase() || ''

  // Validation severity mapping
  if (source === 'validation') {
    if (upperSeverity === 'ERROR' || upperSeverity === 'BLOCKER') return 'critical'
    if (upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Critique severity mapping
  if (source === 'critique') {
    if (upperSeverity === 'BLOCKER') return 'critical'
    if (upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Bias severity mapping
  if (source === 'bias') {
    if (upperSeverity === 'CRITICAL' || upperSeverity === 'HIGH') return 'critical'
    if (upperSeverity === 'MEDIUM' || upperSeverity === 'WARNING') return 'high'
    return 'medium'
  }

  // Readiness improvement priority
  if (source === 'readiness') {
    if (upperSeverity === 'HIGH') return 'high'
    if (upperSeverity === 'MEDIUM') return 'medium'
    return 'low'
  }

  // CEE quality factors
  if (source === 'cee') {
    if (upperSeverity === 'CRITICAL' || upperSeverity === 'ERROR' || upperSeverity === 'BLOCKER') {
      return 'critical'
    }
    if (upperSeverity === 'HIGH' || upperSeverity === 'WARNING') return 'high'
    if (upperSeverity === 'MEDIUM') return 'medium'
    return 'low'
  }

  // Fallback for unknown sources
  console.warn(`[severityMapping] Unknown source '${source}' with severity '${severity}'`)
  return 'medium'
}

/**
 * Map severity string to GuidanceSeverity for UI display
 *
 * @param severity - Raw severity string
 * @param source - Source of the severity
 * @returns GuidanceSeverity - blocker | warning | info
 */
export function mapSeverityToGuidance(
  severity: string | undefined | null,
  source: ActionSource
): GuidanceSeverity {
  const priority = mapSeverityToPriority(severity, source)

  switch (priority) {
    case 'critical':
      return 'blocker'
    case 'high':
      return 'warning'
    case 'medium':
    case 'low':
    default:
      return 'info'
  }
}

/**
 * Map CEE quality level to internal severity
 * CEE returns levels like 'adequate', 'strong', 'weak', 'needs_work'
 *
 * @param level - CEE quality level string
 * @returns Severity string compatible with mapSeverityToPriority
 */
export function mapCeeLevelToSeverity(level: string | undefined | null): string {
  const upperLevel = level?.toUpperCase() || ''

  // Map CEE levels to severity strings
  switch (upperLevel) {
    case 'CRITICAL':
    case 'WEAK':
    case 'NEEDS_WORK':
    case 'POOR':
    case 'MISSING':
      return 'ERROR'

    case 'WARNING':
    case 'FAIR':
    case 'MODERATE':
    case 'PARTIAL':
      return 'WARNING'

    case 'ADEQUATE':
    case 'GOOD':
    case 'STRONG':
    case 'EXCELLENT':
      return 'INFO'

    default:
      // Log unknown levels for monitoring
      if (level) {
        console.warn(`[severityMapping] Unknown CEE level '${level}', defaulting to INFO`)
      }
      return 'INFO'
  }
}

/**
 * Convert ActionPriority to GuidanceSeverity
 */
export function priorityToGuidanceSeverity(priority: ActionPriority): GuidanceSeverity {
  switch (priority) {
    case 'critical':
      return 'blocker'
    case 'high':
      return 'warning'
    case 'medium':
    case 'low':
    default:
      return 'info'
  }
}

/**
 * Check if a priority indicates a blocking issue
 */
export function isBlockingPriority(priority: ActionPriority): boolean {
  return priority === 'critical'
}

/**
 * Sort function for actions by priority
 */
export function sortByPriority<T extends { priority: ActionPriority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

/**
 * Tailwind CSS class mappings for severity levels
 * Used across validation, suggestions, and guidance components
 */
export interface SeverityClasses {
  container: string
  icon: string
  text: string
  caption: string
  button: string
}

const SEVERITY_CLASS_MAP: Record<'error' | 'warning' | 'info', SeverityClasses> = {
  error: {
    container: 'border-carrot-200 bg-carrot-50',
    icon: 'text-carrot-600',
    text: 'text-carrot-900',
    caption: 'text-carrot-700',
    button: 'bg-carrot-500 hover:bg-carrot-600',
  },
  warning: {
    container: 'border-sun-200 bg-sun-50',
    icon: 'text-sun-600',
    text: 'text-sun-900',
    caption: 'text-sun-700',
    button: 'bg-sun-500 hover:bg-sun-600',
  },
  info: {
    container: 'border-sky-200 bg-sky-50',
    icon: 'text-sky-600',
    text: 'text-sky-900',
    caption: 'text-sky-700',
    button: 'bg-sky-500 hover:bg-sky-600',
  },
}

/**
 * Get Tailwind CSS classes for a severity level
 *
 * @param severity - 'error' | 'warning' | 'info'
 * @returns Object with container, icon, text, caption, and button classes
 */
export function getSeverityClasses(severity: 'error' | 'warning' | 'info'): SeverityClasses {
  return SEVERITY_CLASS_MAP[severity]
}
