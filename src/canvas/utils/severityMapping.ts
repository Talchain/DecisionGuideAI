/**
 * Severity Mapping Utilities
 *
 * Centralised mapping of severity strings from various sources
 * (validation, critique, bias, CEE, readiness) to internal priorities.
 *
 * Single source of truth for priority classification and display.
 *
 * v2.1: Added unified SEVERITY_DISPLAY mapping for consistent UI styling
 * across Pre-Analysis Panel, Results Panel, and coaching surfaces.
 */

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'
export type GuidanceSeverity = 'blocker' | 'warning' | 'info'
export type ActionSource = 'readiness' | 'validation' | 'critique' | 'bias' | 'cee'

// =============================================================================
// Canonical Severity Types (v2.1)
// =============================================================================

/**
 * Canonical severity levels for draft warnings and normalised issues.
 * Used consistently across CEE warnings, validation, and derived issues.
 */
export type DraftWarningSeverity = 'blocker' | 'high' | 'medium' | 'low'

/**
 * Draft warning type with canonical severity.
 * This is the standard interface for warnings from CEE and validation.
 */
export interface DraftWarning {
  id: string
  code?: string
  severity: DraftWarningSeverity
  message: string
  affected_node_ids?: string[]
  affected_edge_ids?: string[]
  fix_hint?: string
}

// =============================================================================
// Unified Severity Display (v2.1)
// =============================================================================

/**
 * Severity display configuration.
 * Contains all styling and behaviour info for a severity level.
 */
export interface SeverityDisplay {
  /** Human-readable label (e.g., "Blocker", "High", "Medium", "Low") */
  label: string
  /** Tailwind background class */
  bg: string
  /** Tailwind border class */
  border: string
  /** Tailwind text class for title/heading */
  text: string
  /** Tailwind text class for icon */
  icon: string
  /** Tailwind text class for caption/description */
  caption: string
  /** Whether this severity blocks analysis */
  blocksAnalysis: boolean
  /** Sort order (lower = higher priority) */
  sortOrder: number
}

/**
 * Unified severity display mapping.
 * Single source of truth for severity styling across all surfaces.
 *
 * Colour scheme (DS v5 semantic tokens):
 * - blocker/high: danger channel — critical issues
 * - medium: warning channel — warnings
 * - low: neutral (panel) — informational
 */
export const SEVERITY_DISPLAY: Record<DraftWarningSeverity, SeverityDisplay> = {
  blocker: {
    label: 'Blocker',
    bg: 'bg-panel',
    border: 'border-danger/30',
    text: 'text-text-header',
    icon: 'text-danger',
    caption: 'text-text-body',
    blocksAnalysis: true,
    sortOrder: 0,
  },
  high: {
    label: 'High',
    bg: 'bg-panel',
    border: 'border-danger/30',
    text: 'text-text-header',
    icon: 'text-danger',
    caption: 'text-text-body',
    blocksAnalysis: false,
    sortOrder: 1,
  },
  medium: {
    label: 'Medium',
    bg: 'bg-panel',
    border: 'border-warning/30',
    text: 'text-text-header',
    icon: 'text-warning',
    caption: 'text-text-body',
    blocksAnalysis: false,
    sortOrder: 2,
  },
  low: {
    label: 'Low',
    bg: 'bg-panel',
    border: 'border-panel-border',
    text: 'text-text-header',
    icon: 'text-text-light',
    caption: 'text-text-body',
    blocksAnalysis: false,
    sortOrder: 3,
  },
}

/**
 * Get display configuration for a severity level.
 *
 * @param severity - Severity level (blocker, high, medium, low)
 * @returns SeverityDisplay with all styling and behaviour info
 *
 * @example
 * const display = getSeverityDisplay('blocker')
 * // display.label === 'Blocker'
 * // display.bg === 'bg-panel'
 * // display.blocksAnalysis === true
 */
export function getSeverityDisplay(severity: DraftWarningSeverity): SeverityDisplay {
  return SEVERITY_DISPLAY[severity] ?? SEVERITY_DISPLAY.low
}

/**
 * Get combined container classes for a severity level.
 * Useful for card/alert styling.
 *
 * @param severity - Severity level
 * @returns Combined bg + border classes
 */
export function getSeverityContainerClass(severity: DraftWarningSeverity): string {
  const display = getSeverityDisplay(severity)
  return `${display.bg} ${display.border}`
}

/**
 * Check if any warnings in the list are blocking.
 *
 * @param warnings - Array of warnings with severity
 * @returns true if any warning has blocksAnalysis = true
 *
 * @example
 * const canAnalyse = !hasBlocker(warnings)
 */
export function hasBlocker<T extends { severity: DraftWarningSeverity }>(warnings: T[]): boolean {
  return warnings.some(w => SEVERITY_DISPLAY[w.severity]?.blocksAnalysis)
}

/**
 * Sort warnings by severity (blocker first).
 *
 * @param warnings - Array of warnings with severity
 * @returns Sorted array (original not modified)
 */
export function sortBySeverity<T extends { severity: DraftWarningSeverity }>(warnings: T[]): T[] {
  return [...warnings].sort((a, b) =>
    (SEVERITY_DISPLAY[a.severity]?.sortOrder ?? 99) - (SEVERITY_DISPLAY[b.severity]?.sortOrder ?? 99)
  )
}

/**
 * Map raw CEE severity to canonical DraftWarningSeverity.
 * Handles case-insensitivity and unknown values.
 *
 * @param rawSeverity - Raw severity string from CEE
 * @returns Canonical DraftWarningSeverity
 */
export function normaliseSeverity(rawSeverity: string | undefined | null): DraftWarningSeverity {
  const upper = rawSeverity?.toUpperCase() || ''

  switch (upper) {
    case 'BLOCKER':
    case 'ERROR':
    case 'CRITICAL':
      return 'blocker'
    case 'HIGH':
    case 'WARNING':
      return 'high'
    case 'MEDIUM':
      return 'medium'
    case 'LOW':
    case 'INFO':
    default:
      return 'low'
  }
}

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
    container: 'border-danger/30 bg-panel',
    icon: 'text-danger',
    text: 'text-text-header',
    caption: 'text-text-body',
    button: 'bg-danger hover:bg-danger-hover',
  },
  warning: {
    container: 'border-warning/30 bg-panel',
    icon: 'text-warning',
    text: 'text-text-header',
    caption: 'text-text-body',
    button: 'bg-warning hover:bg-warning-hover',
  },
  info: {
    container: 'border-info/30 bg-panel',
    icon: 'text-info',
    text: 'text-text-header',
    caption: 'text-text-body',
    button: 'bg-info hover:bg-info-hover',
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
