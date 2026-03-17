import { memo } from 'react'
import { X } from 'lucide-react'

interface ProgressStripProps {
  isVisible: boolean
  progress?: number // 0-100
  message?: string
  canCancel?: boolean
  onCancel?: () => void
}

export const ProgressStrip = memo<ProgressStripProps>(({
  isVisible,
  progress = 0,
  message = 'Running…',
  canCancel = false,
  onCancel
}) => {
  if (!isVisible) return null

  const showProgress = progress > 0 && progress < 100

  return (
    <div className="mb-4" data-testid="progress-strip">
      <div className="bg-panel border border-info/30 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-info border-t-transparent rounded-full animate-spin" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-info" aria-live="polite">
                {message}
              </span>
              {showProgress && (
                <span className="text-xs text-info font-medium">{progress}%</span>
              )}
            </div>
            {showProgress && (
              <div className="w-full h-1.5 bg-info/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
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
              className="p-1 hover:bg-panel-hover rounded transition-colors focus:outline-none focus:ring-2 focus:ring-info"
              aria-label="Cancel run"
              title="Cancel run"
            >
              <X className="w-4 h-4 text-info" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

ProgressStrip.displayName = 'ProgressStrip'
