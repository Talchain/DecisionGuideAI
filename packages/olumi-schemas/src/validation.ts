/**
 * Validation warning types.
 *
 * Shared type definitions for validation warnings emitted by CEE, ISL,
 * and UI-side pre-run validation.
 *
 * These are pure TypeScript types — no runtime parsing.
 */

// =============================================================================
// Validation Warning (UI pre-run)
// =============================================================================

/**
 * Validation warning from UI pre-run checks.
 * Non-blocking issues that should be addressed but don't prevent analysis.
 */
export interface ValidationWarning {
  /** Unique code for this warning type */
  code: string
  /** Human-readable message */
  message: string
  /** Additional suggestion */
  suggestion?: string
  /** Affected node/option ID */
  affectedId?: string
}

/**
 * Validation blocker from UI pre-run checks.
 * Issues that prevent analysis from proceeding.
 */
export interface ValidationBlocker {
  /** Unique code for this blocker type */
  code: string
  /** Human-readable message */
  message: string
  /** Affected node/option IDs */
  affectedIds?: string[]
  /** Suggested action */
  action?: {
    type: string
    label: string
    nodeId?: string
    optionId?: string
  }
}

/**
 * Validation result combining blockers and warnings.
 */
export interface ValidationResult {
  /** Whether analysis can proceed */
  canRun: boolean
  /** Issues that prevent running */
  blockers: ValidationBlocker[]
  /** Issues that should be addressed but don't block */
  warnings: ValidationWarning[]
  /** User-facing questions from CEE explaining why analysis can't proceed */
  userQuestions?: string[]
}
