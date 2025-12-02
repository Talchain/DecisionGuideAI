/**
 * Help Modal
 *
 * Shows keyboard shortcuts and tips for using the guide variant.
 * Includes focus management to trap focus within modal when open.
 */

import { useEffect, useRef } from 'react'
import { KEYBOARD_SHORTCUTS } from '../../hooks/useKeyboardShortcuts'
import { Button } from './Button'

export interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Focus management: trap focus within modal
  useEffect(() => {
    if (!isOpen) return

    // Focus close button when modal opens
    closeButtonRef.current?.focus()

    // Trap focus within modal
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusableElements || focusableElements.length === 0) return

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl border border-storm-200 max-w-md w-full mx-4"
      >
        {/* Header */}
        <div className="p-4 border-b border-storm-200 flex items-center justify-between">
          <h2 id="help-modal-title" className="text-lg font-semibold text-charcoal-900">
            Keyboard Shortcuts
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-storm-600 hover:text-charcoal-900 transition-colors"
            aria-label="Close help modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Shortcuts */}
          <div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-2">Shortcuts</h3>
            <div className="space-y-2">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between text-sm">
                  <span className="text-storm-700">{shortcut.description}</span>
                  <kbd className="px-2 py-1 bg-storm-100 rounded border border-storm-200 font-mono text-xs">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-2">Quick Tips</h3>
            <ul className="space-y-1 text-sm text-storm-700 list-disc list-inside">
              <li>Click any node to inspect its details</li>
              <li>Click a driver in the legend to jump to it</li>
              <li>The panel adapts to show relevant content</li>
              <li>Build your model, then run analysis</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-storm-200 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
