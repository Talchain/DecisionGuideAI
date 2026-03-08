import { memo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ProgressStripProps {
  isVisible: boolean
  progress?: number // 0-100
  message?: string
  canCancel?: boolean
  onCancel?: () => void
}

/**
 * Progress indicator with unified panel design
 *
 * Features:
 * - Animated spinner for indeterminate state
 * - Progress bar with percentage when progress is known
 * - Cancel button with clear affordance
 * - Accessible with aria-live and role attributes
 */
export const ProgressStrip = memo<ProgressStripProps>(({
  isVisible,
  progress = 0,
  message = 'Running…',
  canCancel = false,
  onCancel
}) => {
  if (!isVisible) return null

  const showProgress = progress > 0 && progress < 100
  const isIndeterminate = progress === 0

  return (
    <div className="mb-4" data-testid="progress-strip">
      <div className="border border-info/30 rounded-lg p-4 bg-panel">
        <div className="flex items-start gap-3">
          {/* Spinner */}
          <div className="flex-shrink-0 mt-0.5">
            <Loader2 className="w-4 h-4 text-info animate-spin" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className={`${typography.body} font-medium text-gray-900`}
                aria-live="polite"
              >
                {message}
              </span>
              {showProgress && (
                <span className={`${typography.caption} font-semibold text-info tabular-nums`}>
                  {Math.round(progress)}%
                </span>
              )}
            </div>

            {/* Progress bar */}
            {showProgress && (
              <div className="w-full h-2 rounded-full overflow-hidden bg-panel">
                <div
                  className="h-full transition-all duration-300 ease-out bg-primary"
                  style={{ width: `${progress}%` }}
                  aria-valuenow={Math.round(progress)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  role="progressbar"
                  aria-label={`Progress: ${Math.round(progress)}%`}
                />
              </div>
            )}

            {/* Indeterminate state hint */}
            {isIndeterminate && (
              <p className={`${typography.caption} text-gray-600 mt-1`}>
                Connecting to analysis service…
              </p>
            )}
          </div>

          {/* Cancel button */}
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="flex-shrink-0 p-1.5 rounded-md hover:bg-panel-hover transition-colors focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1"
              aria-label="Cancel analysis"
              title="Cancel analysis"
              type="button"
            >
              <X className="w-4 h-4 text-gray-600 hover:text-gray-900" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

ProgressStrip.displayName = 'ProgressStrip'
