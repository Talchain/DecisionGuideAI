/**
 * OnboardingOverlay - First-run welcome experience
 *
 * Shows on first visit with:
 * - 3 primary CTAs (Browse templates, Create from scratch, Learn shortcuts)
 * - Keyboard shortcuts legend
 * - Dismissible with "Don't show again" checkbox
 *
 * State persisted to localStorage
 */

import { useState, useEffect } from 'react'
import { Layout, Zap, Keyboard, X } from 'lucide-react'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'

const STORAGE_KEY = 'olumi-canvas-onboarding-dismissed'

interface OnboardingOverlayProps {
  onBrowseTemplates?: () => void
  onCreateNew?: () => void
  onShowShortcuts?: () => void
}

export function OnboardingOverlay({
  onBrowseTemplates,
  onCreateNew,
  onShowShortcuts
}: OnboardingOverlayProps) {
  const [show, setShow] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const openTemplatesPanel = useCanvasStore(state => state.openTemplatesPanel)

  // Check if user has dismissed onboarding
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (!dismissed) {
        // Show onboarding on first visit
        setShow(true)
      }
    } catch {
      // If localStorage unavailable, don't show
    }
  }, [])

  const handleDismiss = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(STORAGE_KEY, 'true')
      } catch {
        // Ignore localStorage errors
      }
    }
    setShow(false)
  }

  const handleCTA = (action?: () => void) => {
    action?.()
    handleDismiss()
  }

  const handleBrowseTemplates = () => {
    // Use custom callback if provided, otherwise open templates panel directly
    if (onBrowseTemplates) {
      onBrowseTemplates()
    } else {
      openTemplatesPanel()
    }
    handleDismiss()
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4"
      role="dialog"
      aria-labelledby="onboarding-title"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-panel max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-info-500 to-info-600 p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h2 id="onboarding-title" className="text-2xl font-bold mb-2">
                Welcome to Olumi
              </h2>
              <p className="text-info-100">
                Science-powered decision enhancement that supercharges how teams think, collaborate and win.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close onboarding"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 3 Primary CTAs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CTA 1: Browse templates */}
            <button
              onClick={handleBrowseTemplates}
              className="flex flex-col items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-info-500 hover:bg-info-50 transition-all text-center group"
              type="button"
            >
              <div className="w-12 h-12 rounded-full bg-info-100 group-hover:bg-info-200 flex items-center justify-center transition-colors">
                <Layout className="w-6 h-6 text-info-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Browse templates</h3>
                <p className={`${typography.body} text-gray-600`}>
                  Start with ready-made scenarios
                </p>
              </div>
            </button>

            {/* CTA 2: Create from scratch */}
            <button
              onClick={() => handleCTA(onCreateNew)}
              className="flex flex-col items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-success-500 hover:bg-success-50 transition-all text-center group"
              type="button"
            >
              <div className="w-12 h-12 rounded-full bg-success-100 group-hover:bg-success-200 flex items-center justify-center transition-colors">
                <Zap className="w-6 h-6 text-success-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Create from scratch</h3>
                <p className={`${typography.body} text-gray-600`}>
                  Build your own decision graph
                </p>
              </div>
            </button>

            {/* CTA 3: Learn shortcuts */}
            <button
              onClick={() => handleCTA(onShowShortcuts)}
              className="flex flex-col items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-warning-500 hover:bg-warning-50 transition-all text-center group"
              type="button"
            >
              <div className="w-12 h-12 rounded-full bg-warning-100 group-hover:bg-warning-200 flex items-center justify-center transition-colors">
                <Keyboard className="w-6 h-6 text-warning-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Learn shortcuts</h3>
                <p className={`${typography.body} text-gray-600`}>
                  Master keyboard navigation
                </p>
              </div>
            </button>
          </div>

          {/* Keyboard Shortcuts Legend */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className={`${typography.label} text-gray-700 mb-3`}>Essential shortcuts</h3>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 ${typography.body}`}>
              <ShortcutRow keys={['⌘', 'K']} action="Command palette" />
              <ShortcutRow keys={['⌘', 'T']} action="Browse templates" />
              <ShortcutRow keys={['⌘', 'Z']} action="Undo" />
              <ShortcutRow keys={['⌘', '⇧', 'Z']} action="Redo" />
              <ShortcutRow keys={['⌘', 'A']} action="Select all" />
              <ShortcutRow keys={['Del']} action="Delete selection" />
              <ShortcutRow keys={['⌘', 'D']} action="Duplicate" />
              <ShortcutRow keys={['?']} action="Full shortcuts list" />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <label className={`flex items-center gap-2 ${typography.body} text-gray-600 cursor-pointer`}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="rounded border-gray-300 text-info-600 focus:ring-info-500"
              />
              Don't show this again
            </label>
            <button
              onClick={handleDismiss}
              className={`px-4 py-2 ${typography.label} text-gray-700 hover:text-gray-900 transition-colors`}
              type="button"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Shortcut row component
 */
function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{action}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className={`px-2 py-1 ${typography.caption} font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded`}
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}
