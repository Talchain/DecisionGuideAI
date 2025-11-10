/**
 * FirstRunHint - Onboarding hint for new users
 *
 * Shows a dismissible hint on first visit with quick-start instructions.
 * Persists dismissal state to localStorage (with SSR/test safety).
 */

import { useState, useRef } from 'react'
import { X, Layout } from 'lucide-react'
import { useCanvasStore } from '../store'

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const openTemplatesPanel = useCanvasStore(state => state.openTemplatesPanel)

  if (dismissed) return null

  const handleDismiss = () => {
    safeSetStorage(STORAGE_KEY, 'true')
    setDismissed(true)
  }

  const handleBrowseTemplates = () => {
    // Don't pass button ref - just open the templates panel directly
    openTemplatesPanel()
    // Auto-dismiss the welcome hint when templates are opened
    handleDismiss()
  }

  return (
    <div
      role="complementary"
      aria-label="Quick start guide"
      className="fixed top-20 right-4 z-[1000] max-w-sm rounded-lg shadow-lg bg-white border border-gray-200 pointer-events-auto"
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-base text-gray-900 mb-1">
              Welcome to Olumi
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Science-powered decision enhancement that supercharges how teams think, collaborate and win.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 transition-colors text-gray-400 hover:text-gray-900"
            aria-label="Dismiss hint"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <button
        onClick={handleBrowseTemplates}
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-info-500"
        type="button"
        data-testid="btn-open-templates-welcome"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 mb-1">
              Browse templates
            </div>
            <div className="text-xs text-gray-600">
              Start with ready-made scenarios
            </div>
          </div>
        </div>
      </button>
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
