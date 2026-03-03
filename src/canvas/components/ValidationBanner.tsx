import { X, AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../styles/typography'

export interface ValidationError {
  code: string
  message: string
  node_id?: string
  edge_id?: string
  severity: 'error' | 'warning'
  suggestion?: string // v1.2: coaching hint for violations
}

interface ValidationBannerProps {
  errors: ValidationError[]
  violations?: ValidationError[] // v1.2: non-blocking coaching warnings
  onDismiss?: () => void
  onFixNow?: (error: ValidationError) => void
  className?: string
}

/**
 * Unified validation banner for all run entry points
 * - Shows validation errors with consistent styling
 * - v1.2: Shows coaching warnings (violations) as non-blocking info chips
 * - Optional "Fix now" button focuses first invalid element
 * - Dismissible and keyboard accessible
 * - role="alert" for screen readers
 */
export function ValidationBanner({ errors, violations, onDismiss, onFixNow, className = '' }: ValidationBannerProps) {
  // Show blocking errors first, then coaching warnings
  const hasErrors = errors.length > 0
  const hasViolations = (violations?.length ?? 0) > 0

  if (!hasErrors && !hasViolations) return null

  // Prioritize blocking errors
  if (hasErrors) {
    const firstError = errors[0]
    const hasMultiple = errors.length > 1
    const isWarning = firstError.severity === 'warning'

    return (
      <div
        role="alert"
        aria-live="polite"
        className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${
          isWarning
            ? 'bg-warning-light border-warning/30'
            : 'bg-danger-light border-danger/30'
        } ${className}`}
      >
        {/* Icon */}
        <AlertTriangle
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            isWarning ? 'text-warning' : 'text-danger'
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`${typography.label} ${
              isWarning ? 'text-warning' : 'text-danger'
            }`}
          >
            {firstError.message}
          </p>
          {hasMultiple && (
            <p
              className={`${typography.caption} mt-1 ${
                isWarning ? 'text-warning/80' : 'text-danger/80'
              }`}
            >
              +{errors.length - 1} more {errors.length === 2 ? 'issue' : 'issues'}
            </p>
          )}
          {onFixNow && (firstError.node_id || firstError.edge_id) && (
            <button
              onClick={() => onFixNow(firstError)}
              className={`mt-2 ${typography.caption} font-medium underline ${
                isWarning
                  ? 'text-warning hover:text-warning/80'
                  : 'text-danger hover:text-danger/80'
              }`}
              type="button"
            >
              {isWarning ? 'View in canvas' : 'Fix issues to run'}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors ${
              isWarning ? 'text-warning' : 'text-danger'
            }`}
            aria-label="Dismiss validation error"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  // Show coaching warnings (non-blocking)
  if (hasViolations && violations) {
    const firstViolation = violations[0]
    const hasMultiple = violations.length > 1

    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-start gap-3 px-4 py-3 rounded-lg border bg-info-light border-info/30 ${className}`}
      >
        {/* Icon */}
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-info" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`${typography.label} text-info`}>
            {firstViolation.message}
          </p>
          {firstViolation.suggestion && (
            <p className={`${typography.caption} mt-1 text-info/80`}>
              Suggestion: {firstViolation.suggestion}
            </p>
          )}
          {hasMultiple && (
            <p className={`${typography.caption} mt-1 text-info/80`}>
              +{violations.length - 1} more {violations.length === 2 ? 'suggestion' : 'suggestions'}
            </p>
          )}
          <p className={`${typography.caption} mt-1.5 text-info font-medium`}>
            This is advisory only — you can still run your analysis.
          </p>
          {onFixNow && (firstViolation.node_id || firstViolation.edge_id) && (
            <button
              onClick={() => onFixNow(firstViolation)}
              className={`mt-2 ${typography.caption} font-medium underline text-info hover:text-info/80`}
              type="button"
            >
              View in canvas
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors text-info"
            aria-label="Dismiss coaching suggestion"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    )
  }

  return null
}
