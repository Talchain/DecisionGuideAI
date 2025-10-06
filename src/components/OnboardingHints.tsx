// src/components/OnboardingHints.tsx
// Dismissible onboarding hints for first-time users

import { useState, useEffect } from 'react'

const HINTS_DISMISSED_KEY = 'plot_hints_dismissed'

export default function OnboardingHints() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isDismissed = localStorage.getItem(HINTS_DISMISSED_KEY) === 'true'
    setDismissed(isDismissed)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(HINTS_DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 max-w-md">
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-lg shadow-xl p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            <h3 className="font-semibold text-gray-900">Welcome to Plot!</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Dismiss (won't show again)"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2 text-sm text-gray-700 mb-3">
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">1.</span>
            <span><strong>Drag</strong> to pan, <strong>scroll</strong> to zoom. Everything moves together.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">2.</span>
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono">N</kbd> to add a node at the center of your view.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">3.</span>
            <span><strong>Draw</strong> on the canvas, <strong>drag nodes</strong> to move them, <strong>Del</strong> to delete.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-indigo-600 font-bold">4.</span>
            <span>Your work <strong>autosaves</strong> every 2 seconds. Refresh anytime!</span>
          </p>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Press <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded font-mono">?</kbd> for more shortcuts</span>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
