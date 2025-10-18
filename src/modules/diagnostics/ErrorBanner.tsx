// src/modules/diagnostics/ErrorBanner.tsx
import { useState } from 'react'
import { useRateLimitCountdown } from './useRateLimitCountdown'

interface ErrorBannerProps {
  variant: 'error' | 'warning' | 'info' | 'rate-limit'
  message: string
  retryAfterSeconds?: number
  rateLimitDetails?: {
    reset?: string
    reason?: string
  }
  onRetry?: () => void
  onDismiss?: () => void
}

export function ErrorBanner({
  variant,
  message,
  retryAfterSeconds,
  rateLimitDetails,
  onRetry,
  onDismiss
}: ErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const { remaining, formatted, isExpired } = useRateLimitCountdown(
    variant === 'rate-limit' ? retryAfterSeconds || null : null
  )

  const variantStyles = {
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    'rate-limit': 'bg-purple-50 border-purple-200 text-purple-900'
  }

  const iconMap = {
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
    'rate-limit': '⏱️'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-lg border p-4 ${variantStyles[variant]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg" aria-hidden="true">{iconMap[variant]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{message}</p>
          
          {variant === 'rate-limit' && !isExpired && (
            <p className="text-sm mt-1">
              Retry in: <span className="font-mono font-semibold">{formatted.display}</span>
            </p>
          )}

          {variant === 'rate-limit' && rateLimitDetails && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs underline mt-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 rounded"
              aria-expanded={showDetails}
            >
              {showDetails ? 'Hide' : 'Show'} details
            </button>
          )}

          {showDetails && rateLimitDetails && (
            <div className="mt-2 text-xs space-y-1 bg-white bg-opacity-50 rounded p-2">
              {rateLimitDetails.reason && <div>Reason: {rateLimitDetails.reason}</div>}
              {rateLimitDetails.reset && <div>Reset: {new Date(parseInt(rateLimitDetails.reset) * 1000).toLocaleString()}</div>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {variant === 'rate-limit' && onRetry && (
            <button
              onClick={onRetry}
              disabled={!isExpired}
              className="px-3 py-1 text-sm font-medium rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              aria-label={isExpired ? 'Try again' : `Try again in ${formatted.display}`}
            >
              Try again
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 rounded px-2"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
