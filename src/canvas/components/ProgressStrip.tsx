import { memo } from 'react'
import { X } from 'lucide-react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

interface ProgressStripProps {
  isVisible: boolean
  progress?: number // 0-100
  message?: string
  canCancel?: boolean
  onCancel?: () => void
}

/**
 * Progress indicator for Results panel
 * Uses Olumi brand tokens for consistent styling
 * Respects prefers-reduced-motion for accessibility
 */
export const ProgressStrip = memo<ProgressStripProps>(({
  isVisible,
  progress = 0,
  message = 'Running…',
  canCancel = false,
  onCancel
}) => {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (!isVisible) return null

  const showProgress = progress > 0 && progress < 100

  return (
    <div className="mb-4" data-testid="progress-strip">
      <div
        className="border rounded-lg p-3"
        style={{
          backgroundColor: 'rgba(91, 108, 255, 0.08)',
          borderColor: 'rgba(91, 108, 255, 0.3)'
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-4 h-4 border-2 border-t-transparent rounded-full ${prefersReducedMotion ? '' : 'animate-spin'}`}
            style={{ borderColor: 'var(--olumi-primary) transparent transparent transparent' }}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--olumi-text)' }}
                aria-live="polite"
              >
                {message}
              </span>
              {showProgress && (
                <span
                  className="text-xs font-medium"
                  style={{ color: 'var(--olumi-primary)' }}
                >
                  {progress}%
                </span>
              )}
            </div>
            {showProgress && (
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(91, 108, 255, 0.2)' }}
              >
                <div
                  className={`h-full ${prefersReducedMotion ? '' : 'transition-all duration-300 ease-out'}`}
                  style={{
                    width: `${progress}%`,
                    backgroundColor: 'var(--olumi-primary)'
                  }}
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  role="progressbar"
                />
              </div>
            )}
          </div>
          {canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="p-1 rounded transition-colors focus:outline-none focus:ring-2"
              style={{
                '--hover-bg': 'rgba(91, 108, 255, 0.15)',
                '--ring-color': 'var(--olumi-primary)'
              } as React.CSSProperties}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              aria-label="Cancel run"
              title="Cancel run"
            >
              <X className="w-4 h-4" style={{ color: 'var(--olumi-primary)' }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

ProgressStrip.displayName = 'ProgressStrip'
