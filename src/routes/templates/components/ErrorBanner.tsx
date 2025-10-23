import { memo, useEffect, useRef } from 'react'
import type { ErrorV1 } from '../../../adapters/plot'

interface ErrorBannerProps {
  error: ErrorV1
  retryAfter?: number | null
  onRetry?: () => void
  onDismiss?: () => void
}

const getErrorMessage = (error: ErrorV1): string => {
  switch (error.code) {
    case 'BAD_INPUT':
      return error.error || 'Please check your input and try again.'
    case 'LIMIT_EXCEEDED':
      const field = error.fields?.field === 'graph.nodes' ? 'nodes' : 'connections'
      const max = error.fields?.max || 12
      return `Too many ${field} for this plan. Please keep it to ${max} ${field}.`
    case 'RATE_LIMITED':
      return error.error || 'You\'re going fast — please retry shortly.'
    case 'UNAUTHORIZED':
      return 'Please sign in to continue.'
    case 'SERVER_ERROR':
    default:
      return 'Something went wrong. Please try again.'
  }
}

const getBannerStyle = (code: string): string => {
  switch (code) {
    case 'BAD_INPUT':
      return 'bg-yellow-50 border-yellow-300 text-yellow-800'
    case 'LIMIT_EXCEEDED':
      return 'bg-blue-50 border-blue-300 text-blue-800'
    case 'RATE_LIMITED':
      return 'bg-orange-50 border-orange-300 text-orange-800'
    case 'UNAUTHORIZED':
    case 'SERVER_ERROR':
      return 'bg-red-50 border-red-300 text-red-800'
    default:
      return 'bg-gray-50 border-gray-300 text-gray-800'
  }
}

export const ErrorBanner = memo<ErrorBannerProps>(({ 
  error, 
  retryAfter, 
  onRetry, 
  onDismiss 
}) => {
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus the banner when it first appears for screen readers
    if (bannerRef.current) {
      bannerRef.current.focus()
    }
  }, [error.code])

  const message = getErrorMessage(error)
  const isRateLimit = error.code === 'RATE_LIMITED'

  return (
    <div
      ref={bannerRef}
      className={`border rounded-lg p-4 mb-4 ${getBannerStyle(error.code)}`}
      role="alert"
      aria-live="assertive"
      data-testid="error-banner"
      tabIndex={-1}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
          {error.hint && (
            <p className="text-sm mt-1 opacity-90">{error.hint}</p>
          )}
          {isRateLimit && retryAfter && (
            <p className="text-sm mt-2">
              Please retry in {retryAfter} seconds.
            </p>
          )}
        </div>
        
        <div className="flex gap-2 ml-4">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isRateLimit && retryAfter && retryAfter > 0}
              className="text-sm px-3 py-1 rounded bg-white bg-opacity-50 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm px-2 py-1 rounded bg-white bg-opacity-50 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-1"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

ErrorBanner.displayName = 'ErrorBanner'
