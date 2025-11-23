/**
 * Empty State Component
 *
 * Displays template cards and quick-start actions when canvas is empty.
 *
 * Features:
 * - Template cards with preview thumbnails
 * - "Start from scratch" option
 * - Keyboard navigation (←/→ arrows, Enter to select)
 * - Dismissible with localStorage persistence
 * - A11y compliant (ARIA roles, focus management)
 *
 * Flag: VITE_FEATURE_ONBOARDING=0|1 (default OFF)
 */

import { useState, useEffect, useRef } from 'react'
import { sanitizeLabel } from '../persist'
import { typography } from '../../styles/typography'

export interface Template {
  id: string
  title: string
  description: string
  tags: string[]
  thumbnail?: string
}

export interface EmptyStateProps {
  /** Available templates */
  templates: Template[]

  /** Callback when template selected */
  onSelectTemplate: (templateId: string) => void

  /** Callback when "start from scratch" clicked */
  onStartFromScratch: () => void

  /** Whether to show empty state (controlled) */
  show: boolean

  /** Callback when dismissed */
  onDismiss: () => void
}

const STORAGE_KEY = 'canvas-empty-state-dismissed'

/**
 * Check if empty state has been dismissed before
 */
function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Mark empty state as dismissed
 */
function setDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}

export function EmptyState({
  templates,
  onSelectTemplate,
  onStartFromScratch,
  show,
  onDismiss,
}: EmptyStateProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Check if dismissed on mount
  useEffect(() => {
    if (isDismissed()) {
      onDismiss()
    }
  }, [onDismiss])

  // Keyboard navigation
  useEffect(() => {
    if (!show) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Arrow keys navigate templates
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, templates.length))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      }

      // Enter selects template
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectedIndex < templates.length) {
          onSelectTemplate(templates[selectedIndex].id)
        } else {
          onStartFromScratch()
        }
      }

      // Escape dismisses
      else if (e.key === 'Escape') {
        e.preventDefault()
        handleDismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, selectedIndex, templates, onSelectTemplate, onStartFromScratch])

  // Focus selected card
  useEffect(() => {
    if (show && cardRefs.current[selectedIndex]) {
      cardRefs.current[selectedIndex]?.focus()
    }
  }, [selectedIndex, show])

  const handleDismiss = () => {
    setDismissed()
    onDismiss()
  }

  if (!show) {
    return null
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-white"
      role="dialog"
      aria-label="Get started with canvas"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl px-8">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className={`${typography.h1} text-ink-900 mb-2`}>
            Start your decision canvas
          </h1>
          <p className={`${typography.body} text-ink-900/70`}>
            Pick a starting template that fits your situation, or start from scratch to build your own model.
          </p>
        </div>

        {/* Template cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
          role="list"
          aria-label="Available templates"
        >
          {templates.map((template, idx) => (
            <button
              key={template.id}
              ref={el => (cardRefs.current[idx] = el)}
              onClick={() => onSelectTemplate(template.id)}
              className={`
                p-6 rounded-lg border-2 transition-all text-left
                ${
                  selectedIndex === idx
                    ? 'border-sky-500 bg-sky-50 shadow-lg'
                    : 'border-sand-200 bg-white hover:border-sand-300 hover:shadow'
                }
              `}
              aria-selected={selectedIndex === idx}
              role="listitem"
            >
              {/* Thumbnail placeholder */}
              {template.thumbnail && (
                <div className="w-full h-24 mb-4 bg-sand-100 rounded flex items-center justify-center overflow-hidden">
                  <img
                    src={template.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title */}
              <h2 className={`${typography.h4} text-ink-900 mb-2`}>
                {sanitizeLabel(template.title)}
              </h2>

              {/* Description */}
              <p className={`${typography.body} text-ink-900/70 mb-3`}>
                {sanitizeLabel(template.description)}
              </p>

              {/* Tags */}
              {template.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.tags.map(tag => (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 ${typography.caption} rounded bg-sand-100 text-ink-900/70`}
                    >
                      {sanitizeLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}

          {/* Start from scratch card */}
          <button
            ref={el => (cardRefs.current[templates.length] = el)}
            onClick={onStartFromScratch}
            className={`
              p-6 rounded-lg border-2 border-dashed transition-all
              ${
                selectedIndex === templates.length
                  ? 'border-sky-500 bg-sky-50 shadow-lg'
                  : 'border-sand-300 bg-sand-50 hover:border-sand-400'
              }
            `}
            aria-selected={selectedIndex === templates.length}
            role="listitem"
          >
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-sky-50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-ink-900/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <h2 className={`${typography.h4} text-ink-900 mb-2`}>
                Start from Scratch
              </h2>
              <p className={`${typography.body} text-ink-900/70`}>
                Build your own decision graph
              </p>
            </div>
          </button>
        </div>

        {/* Keyboard hints */}
        <div className={`text-center ${typography.body} text-ink-900/60`}>
          <kbd className="px-2 py-1 bg-sand-100 rounded mr-1">←</kbd>
          <kbd className="px-2 py-1 bg-sand-100 rounded mr-2">→</kbd>
          to navigate
          <span className="mx-4">•</span>
          <kbd className="px-2 py-1 bg-sand-100 rounded mr-2">Enter</kbd>
          to select
          <span className="mx-4">•</span>
          <kbd className="px-2 py-1 bg-sand-100 rounded mr-2">ESC</kbd>
          to dismiss
        </div>

        {/* Dismiss link */}
        <div className="text-center mt-6">
          <button
            onClick={handleDismiss}
            className={`${typography.body} text-ink-900/60 hover:text-ink-900 underline`}
          >
            Don't show this again
          </button>
        </div>
      </div>

      {/* Screen reader status */}
      <div role="status" aria-live="polite" className="sr-only">
        {selectedIndex < templates.length
          ? `Selected: ${templates[selectedIndex].title}`
          : 'Selected: Start from scratch'}
      </div>
    </div>
  )
}
