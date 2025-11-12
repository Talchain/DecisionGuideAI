/**
 * Rate Limit Chip (M1.3)
 * Shows countdown when rate-limited with auto-retry
 */

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface RateLimitChipProps {
  retryAfter: number // seconds
  reason?: string
  onRetryReady: () => void
}

export function RateLimitChip({ retryAfter, reason, onRetryReady }: RateLimitChipProps) {
  const [remaining, setRemaining] = useState(retryAfter)

  useEffect(() => {
    if (remaining <= 0) {
      onRetryReady()
      return
    }

    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval)
          return 0
        }
        return r - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [remaining, onRetryReady])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
      title={reason}
    >
      <Clock className="w-3 h-3" />
      <span>Rate-limited — try again in {remaining}s</span>
    </div>
  )
}
