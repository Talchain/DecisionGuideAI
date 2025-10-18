// src/modules/diagnostics/useRateLimitCountdown.ts
import { useState, useEffect, useRef } from 'react'

export function useRateLimitCountdown(retryAfterSeconds: number | null) {
  const [remaining, setRemaining] = useState(retryAfterSeconds || 0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (retryAfterSeconds === null || retryAfterSeconds <= 0) {
      setRemaining(0)
      return
    }

    setRemaining(retryAfterSeconds)

    intervalRef.current = window.setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [retryAfterSeconds])

  const formatted = {
    minutes: Math.floor(remaining / 60),
    seconds: remaining % 60,
    display: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
  }

  return { remaining, formatted, isExpired: remaining === 0 }
}
