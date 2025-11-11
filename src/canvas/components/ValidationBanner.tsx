import { X, AlertCircle, Info } from 'lucide-react'

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
            ? 'bg-warning-50 border-warning-200'
            : 'bg-danger-50 border-danger-200'
        } ${className}`}
      >
        {/* Icon */}
        <AlertCircle
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            isWarning ? 'text-warning-600' : 'text-danger-600'
          }`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isWarning ? 'text-warning-900' : 'text-danger-900'
            }`}
          >
            {firstError.message}
          </p>
          {hasMultiple && (
            <p
              className={`text-xs mt-1 ${
                isWarning ? 'text-warning-700' : 'text-danger-700'
              }`}
            >
              +{errors.length - 1} more {errors.length === 2 ? 'issue' : 'issues'}
            </p>
          )}
          {onFixNow && (firstError.node_id || firstError.edge_id) && (
            <button
              onClick={() => onFixNow(firstError)}
              className={`mt-2 text-xs font-medium underline ${
                isWarning
                  ? 'text-warning-800 hover:text-warning-900'
                  : 'text-danger-800 hover:text-danger-900'
              }`}
              type="button"
            >
              Fix now
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors ${
              isWarning ? 'text-warning-600' : 'text-danger-600'
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
        className={`flex items-start gap-3 px-4 py-3 rounded-lg border bg-info-50 border-info-200 ${className}`}
      >
        {/* Icon */}
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-info-600" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-info-900">
            {firstViolation.message}
          </p>
          {firstViolation.suggestion && (
            <p className="text-xs mt-1 text-info-700">
              Suggestion: {firstViolation.suggestion}
            </p>
          )}
          {hasMultiple && (
            <p className="text-xs mt-1 text-info-700">
              +{violations.length - 1} more {violations.length === 2 ? 'suggestion' : 'suggestions'}
            </p>
          )}
          <p className="text-xs mt-1.5 text-info-600 font-medium">
            This is advisory only — you can still run your analysis.
          </p>
          {onFixNow && (firstViolation.node_id || firstViolation.edge_id) && (
            <button
              onClick={() => onFixNow(firstViolation)}
              className="mt-2 text-xs font-medium underline text-info-800 hover:text-info-900"
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
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors text-info-600"
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
