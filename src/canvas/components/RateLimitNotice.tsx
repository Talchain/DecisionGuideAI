import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { typography } from '../../styles/typography'

interface RateLimitNoticeProps {
  retryAfterSeconds: number
  onRetry: () => void
}

export function RateLimitNotice({ retryAfterSeconds, onRetry }: RateLimitNoticeProps) {
  const [remaining, setRemaining] = useState(retryAfterSeconds)

  useEffect(() => {
    setRemaining(retryAfterSeconds)
  }, [retryAfterSeconds])

  useEffect(() => {
    if (remaining <= 0) {
      return
    }

    const id = window.setInterval(() => {
      setRemaining((previous: number) => (previous > 1 ? previous - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(id)
    }
  }, [remaining])

  const disabled = remaining > 0
  const label = disabled
    ? `Please wait ${remaining}s before trying again.`
    : 'You can try again now.'

  return (
    <div
      className="rounded-lg border border-sun-200 bg-sun-50 p-3 flex items-start gap-2"
      role="status"
      aria-live="polite"
      data-testid="cee-rate-limit-notice"
    >
      <Clock className="w-4 h-4 text-sun-700 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        <p className={`${typography.bodySmall} text-sun-800`}>
          The drafting service is currently rate limited. {label}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className={`${
            typography.button
          } inline-flex items-center px-3 py-1.5 rounded border border-sun-300 text-sun-800 bg-white hover:bg-sun-100 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
