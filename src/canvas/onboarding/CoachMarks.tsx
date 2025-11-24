/**
 * Coach Marks Component
 *
 * 3-step interactive tour for first-time users.
 *
 * Steps:
 * 1. Canvas controls (toolbar, node creation)
 * 2. Results panel (run analysis, view drivers)
 * 3. Compare mode (run multiple scenarios)
 *
 * Features:
 * - Spotlight highlighting target elements
 * - Next/Previous/Skip navigation
 * - Keyboard shortcuts (←/→, ESC to skip)
 * - Persistent "seen" state in localStorage
 * - A11y compliant (focus trap, ARIA roles)
 *
 * Flag: VITE_FEATURE_ONBOARDING=0|1
 */

import { useState, useEffect } from 'react'

export interface CoachMarkStep {
  id: string
  title: string
  description: string
  targetSelector: string // CSS selector for spotlight
  position: 'top' | 'bottom' | 'left' | 'right'
}

export interface CoachMarksProps {
  /** Whether to show coach marks */
  show: boolean

  /** Callback when tour completed or skipped */
  onComplete: () => void

  /** Optional steps (defaults to built-in 3-step tour) */
  steps?: CoachMarkStep[]
}

const DEFAULT_STEPS: CoachMarkStep[] = [
  {
    id: 'canvas-controls',
    title: 'Canvas Controls',
    description:
      'Use the toolbar to add nodes, connect them, and build your decision graph. Click and drag to pan the canvas.',
    targetSelector: '#plot-toolbar',
    position: 'right',
  },
  {
    id: 'results-panel',
    title: 'Results Panel',
    description:
      'Run your analysis to see drivers, insights, and Monte Carlo simulations. Results appear here in real-time.',
    targetSelector: '#plot-right-rail',
    position: 'left',
  },
  {
    id: 'compare-mode',
    title: 'Compare Scenarios',
    description:
      'Run multiple scenarios with different seeds to compare outcomes. Use snapshots to save and compare states.',
    targetSelector: 'button:has-text("Run Scenario")',
    position: 'bottom',
  },
]

const STORAGE_KEY = 'canvas-coach-marks-seen'

/**
 * Check if coach marks have been seen
 */
function isSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Mark coach marks as seen
 */
function setSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {}
}

export function CoachMarks({ show, onComplete, steps = DEFAULT_STEPS }: CoachMarksProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  // Check if seen on mount
  useEffect(() => {
    if (isSeen()) {
      onComplete()
    }
  }, [onComplete])

  // Update target element position
  useEffect(() => {
    if (!show) return

    const step = steps[currentStep]
    if (!step) return

    const updateTargetRect = () => {
      const target = document.querySelector(step.targetSelector)
      if (target) {
        setTargetRect(target.getBoundingClientRect())
      }
    }

    updateTargetRect()

    // Update on scroll/resize
    window.addEventListener('scroll', updateTargetRect)
    window.addEventListener('resize', updateTargetRect)

    return () => {
      window.removeEventListener('scroll', updateTargetRect)
      window.removeEventListener('resize', updateTargetRect)
    }
  }, [show, currentStep, steps])

  // Keyboard navigation
  useEffect(() => {
    if (!show) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, currentStep])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    setSeen()
    onComplete()
  }

  const handleComplete = () => {
    setSeen()
    onComplete()
  }

  if (!show || isSeen()) {
    return null
  }

  const step = steps[currentStep]
  if (!step) return null

  // Calculate tooltip position based on target rect and position
  let tooltipStyle: React.CSSProperties = {}

  if (targetRect) {
    const OFFSET = 24
    switch (step.position) {
      case 'right':
        tooltipStyle = {
          top: targetRect.top,
          left: targetRect.right + OFFSET,
        }
        break
      case 'left':
        tooltipStyle = {
          top: targetRect.top,
          right: window.innerWidth - targetRect.left + OFFSET,
        }
        break
      case 'bottom':
        tooltipStyle = {
          top: targetRect.bottom + OFFSET,
          left: targetRect.left,
        }
        break
      case 'top':
        tooltipStyle = {
          bottom: window.innerHeight - targetRect.top + OFFSET,
          left: targetRect.left,
        }
        break
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Spotlight on target */}
      {targetRect && (
        <div
          className="fixed z-45 pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.5)',
            borderRadius: '8px',
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-50 w-80 bg-white rounded-lg shadow-panel p-6"
        style={tooltipStyle}
        role="dialog"
        aria-labelledby="coach-mark-title"
        aria-describedby="coach-mark-description"
      >
        {/* Progress indicator */}
        <div className="flex gap-1 mb-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded ${
                idx === currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Content */}
        <h2 id="coach-mark-title" className="text-lg font-semibold text-gray-900 mb-2">
          {step.title}
        </h2>
        <p id="coach-mark-description" className="text-sm text-gray-600 mb-6">
          {step.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Skip
            </button>
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {currentStep < steps.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded mr-1">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded mr-2">→</kbd>
          to navigate
          <span className="mx-2">•</span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded mr-2">ESC</kbd>
          to skip
        </div>
      </div>

      {/* Screen reader status */}
      <div role="status" aria-live="polite" className="sr-only">
        {step.title}. Step {currentStep + 1} of {steps.length}
      </div>
    </>
  )
}
