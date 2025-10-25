/**
 * FirstRunHint - Onboarding hint for new users
 *
 * Shows a dismissible hint on first visit with quick-start instructions.
 * Persists dismissal state to localStorage (with SSR/test safety).
 */

import { useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'canvas-onboarding-dismissed'

/**
 * Safe localStorage check for SSR/test environments
 */
function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    // localStorage might be blocked (privacy mode, etc.)
    return null
  }
}

/**
 * Safe localStorage setter for SSR/test environments
 */
function safeSetStorage(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch {
    // Fail silently if storage is unavailable
  }
}

export function FirstRunHint() {
  const [dismissed, setDismissed] = useState(() => {
    return safeGetStorage(STORAGE_KEY) === 'true'
  })

  if (dismissed) return null

  const handleDismiss = () => {
    safeSetStorage(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  return (
    <div
      role="complementary"
      aria-label="Quick start guide"
      className="fixed top-20 right-4 z-[1000] max-w-sm p-4 rounded-lg shadow-lg"
      style={{
        backgroundColor: 'var(--olumi-bg, #0E1116)',
        borderLeft: '3px solid var(--olumi-primary, #5B6CFF)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3
            className="font-medium text-sm"
            style={{ color: 'var(--olumi-text, #E8ECF5)' }}
          >
            Welcome to Templates
          </h3>
          <p
            className="text-xs"
            style={{ color: 'var(--olumi-text, #E8ECF5)', opacity: 0.9 }}
          >
            Insert a template → tweak probabilities → Run (⌘/Ctrl+Enter).
          </p>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 transition-colors"
          style={{ color: 'rgba(232, 236, 245, 0.6)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--olumi-text, #E8ECF5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(232, 236, 245, 0.6)'
          }}
          aria-label="Dismiss hint"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * Reset the onboarding hint (for testing or help menu)
 */
export function resetOnboardingHint() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Fail silently if storage is unavailable
  }
}
