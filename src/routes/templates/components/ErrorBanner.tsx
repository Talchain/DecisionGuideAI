import { memo, useEffect, useRef, useState } from 'react'
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
      {
        const field = error.fields?.field === 'graph.nodes' ? 'nodes' : 'connections'
        const max = error.fields?.max || 12
        return `Too many ${field} for this plan. Please keep it to ${max} ${field}.`
      }
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
      return 'bg-panel border-warning/30 text-warning'
    case 'LIMIT_EXCEEDED':
      return 'bg-panel border-info/30 text-info'
    case 'RATE_LIMITED':
      return 'bg-panel border-warning/30 text-warning'
    case 'UNAUTHORIZED':
    case 'SERVER_ERROR':
      return 'bg-panel border-danger/30 text-danger'
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
  const [countdown, setCountdown] = useState(retryAfter || 0)

  useEffect(() => {
    // Focus the banner when it first appears for screen readers
    if (bannerRef.current) {
      bannerRef.current.focus()
    }
  }, [error.code])

  // Countdown timer for rate limiting
  useEffect(() => {
    if (error.code !== 'RATE_LIMITED' || !retryAfter || retryAfter <= 0) {
      return
    }

    setCountdown(retryAfter)
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [error.code, retryAfter])

  const message = getErrorMessage(error)
  const isRateLimit = error.code === 'RATE_LIMITED'
  const canRetry = !isRateLimit || countdown === 0

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
          {/*
            ⚠ DELIBERATE — do NOT "fix" this in an honesty/leak sweep.
            Paul has confirmed the Reference ID is a support affordance: it is
            meant to be user-visible in production, in a role="alert" banner,
            with no dev guard. Removing it removes the only handle a user has
            when they report a failed run. It has been flagged as an internal-
            identifier leak before; it is not one.

            WHAT IT ACTUALLY IS (traced 2026-07-25 — read this before assuming):
            NOT the CEE top-level `request_id`. This value comes from PLoT's
            ERROR payload: `v1/sseClient.ts:505` probes
            `data.request_id || data.requestId || details?.request_id ||
            details?.requestId`, that lands on `EngineError.requestId`, and
            `httpV1Adapter.ts:357` maps it to `error.request_id`. The name it
            wears here is the adapter's, not the wire's.

            The CEE-side distinction matters because CEE PR #689 removed a
            top-level `request_id` from the field-coverage allowlist as a FALSE
            claim — so a reader who assumes this banner shows that field will
            conclude the banner is broken. It shows PLoT's engine request id.
            The four-way probe above means the exact producing key is not
            pinned; that has NOT been traced to a single PLoT emit site.
          */}
          {error.request_id && (
            <p className="text-xs mt-1 text-gray-700">
              Reference ID: <span className="font-mono">{error.request_id}</span>
            </p>
          )}
          {isRateLimit && countdown > 0 && (
            <p className="text-sm mt-2">
              Please retry in {countdown} second{countdown !== 1 ? 's' : ''}.
            </p>
          )}
          {isRateLimit && countdown === 0 && retryAfter && retryAfter > 0 && (
            <p className="text-sm mt-2 font-medium">
              Ready to retry!
            </p>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={!canRetry}
              className="text-sm px-3 py-1 rounded bg-white bg-opacity-50 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
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
