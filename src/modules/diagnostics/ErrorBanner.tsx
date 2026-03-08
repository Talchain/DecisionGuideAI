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
    error: 'bg-panel border-danger/30 text-danger',
    warning: 'bg-panel border-warning/30 text-warning',
    info: 'bg-panel border-info/30 text-info',
    'rate-limit': 'bg-panel border-option/30 text-option'
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
              className="text-xs underline mt-2 hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-option rounded"
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
              className="px-3 py-1 text-sm font-medium rounded bg-option text-text-on-color hover:bg-option disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-option"
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
