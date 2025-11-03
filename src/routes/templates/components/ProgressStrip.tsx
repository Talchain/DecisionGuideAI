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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-blue-800" aria-live="polite">
                {message}
              </span>
              {showProgress && (
                <span className="text-xs text-blue-600 font-medium">{progress}%</span>
              )}
            </div>
            {showProgress && (
              <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
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
              className="p-1 hover:bg-blue-100 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label="Cancel run"
              title="Cancel run"
            >
              <X className="w-4 h-4 text-blue-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

ProgressStrip.displayName = 'ProgressStrip'
