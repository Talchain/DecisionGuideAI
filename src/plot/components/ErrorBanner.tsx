// src/plot/components/ErrorBanner.tsx
// Conditional error banner (only shows when there's a real error)

import React from 'react'

interface ErrorBannerProps {
  error: string | null
  onRetry?: () => void
}

export default function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  if (!error) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-red-50 border border-red-200 text-red-900 rounded-lg p-3 mb-4 text-sm"
      data-testid="plot-error-banner"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold">⚠ Error</span>
          <span>{error}</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-red-900 font-medium transition-colors"
            aria-label="Retry"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
