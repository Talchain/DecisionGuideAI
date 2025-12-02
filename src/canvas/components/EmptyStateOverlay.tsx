import { useEffect } from 'react'
import { typography } from '../../styles/typography'

interface EmptyStateOverlayProps {
  onDismiss: () => void
}

const STORAGE_KEY = 'canvas.welcome.dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function setDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {}
}

export function EmptyStateOverlay({ onDismiss }: EmptyStateOverlayProps) {
  // Auto-hide when previously dismissed
  if (typeof window !== 'undefined' && isDismissed()) {
    return null
  }

  // Global Escape key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  const handleCloseClick = () => {
    onDismiss()
  }

  const handleDontShowAgain = () => {
    setDismissed()
    onDismiss()
  }

  return (
    <div
      className="absolute inset-0 z-[5000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full m-4 p-6 relative">
        <button
          type="button"
          onClick={handleCloseClick}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close welcome overlay"
        >
          ×
        </button>

        <h2
          id="welcome-title"
          className={`${typography.h3} mb-2`}
        >
          Welcome to Canvas
        </h2>
        <p className={`${typography.body} text-gray-700 mb-4`}>
          Start by adding nodes to model your decision, or use a template to get a head start.
        </p>

        <button
          type="button"
          onClick={handleDontShowAgain}
          className={`${typography.bodySmall} text-gray-600 hover:text-gray-800 underline`}
        >
          Don't show this again
        </button>
      </div>
    </div>
  )
}
