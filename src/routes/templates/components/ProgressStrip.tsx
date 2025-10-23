import { memo } from 'react'

interface ProgressStripProps {
  isVisible: boolean
  message?: string
}

export const ProgressStrip = memo<ProgressStripProps>(({ isVisible, message = 'Running…' }) => {
  if (!isVisible) return null

  return (
    <div className="mb-4" data-testid="progress-strip">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-blue-800" aria-live="polite">
            {message}
          </span>
        </div>
      </div>
    </div>
  )
})

ProgressStrip.displayName = 'ProgressStrip'
