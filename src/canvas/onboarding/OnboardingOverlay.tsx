/**
 * S8-ONBOARD: First-Run Onboarding Overlay
 * Guides new users through core workflows: Create → Tweak → Analyse → Compare → Capture
 * Appears once on first load, can be reopened from Help menu
 */

import { useState, useEffect, useRef, type ReactNode } from 'react'
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  Save,
  Edit3,
  PlayCircle,
  GitCompare,
  Share2,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react'
import { markOnboardingSeen } from './useOnboarding'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: ReactNode
  bullets: string[]
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Olumi',
    description:
      'Create → Tweak → Analyse → Compare → Capture. Olumi keeps the whole decision journey in one canvas so you can see causality, document rationale, and replay results with confidence.',
    icon: <Sparkles className="w-8 h-8 text-blue-600" aria-hidden="true" />,
    bullets: [
      'Create nodes for goals, options, risks, evidence, and outcomes.',
      'Tweak edges to express influence using weight (effect size) plus belief (confidence).',
      'Analyse to produce p10 / p50 / p90 projections then capture the rationale in-line.',
    ],
  },
  {
    id: 'templates',
    title: 'Templates & Merging',
    description:
      'Jump-start with curated templates or merge a template into your current work without overwriting anything.',
    icon: <Layers className="w-8 h-8 text-purple-600" aria-hidden="true" />,
    bullets: [
      'Start from Template: creates a fresh scenario seeded with ready-made nodes and edges.',
      'Merge into current: adds the template alongside your existing graph — safe, non-destructive.',
      'Templates list who authored them and when they were last reviewed.',
    ],
  },
  {
    id: 'save',
    title: 'Save & Autosave',
    description:
      'Saved by you · just now ✓ — Olumi autosaves locally every 30 seconds and records who last edited each scenario.',
    icon: <Save className="w-8 h-8 text-emerald-600" aria-hidden="true" />,
    bullets: [
      'Recovery banners highlight any divergence between autosave and the current canvas.',
      'Export or import .olumi files to back up snapshots or share securely.',
      'Undo/redo history persists for the active session even after autosave.',
    ],
  },
  {
    id: 'editing',
    title: 'Editing Essentials',
    description: 'Stay in flow with quick-add and inline editing controls.',
    icon: <Edit3 className="w-8 h-8 text-amber-600" aria-hidden="true" />,
    bullets: [
      'Press Q for the Radial Quick-Add menu anywhere on the canvas.',
      'Inline edge editor lets you nudge weight/belief with arrow keys or Shift+arrow for coarse changes.',
      'F2 renames documents, nodes, or edges; undo/redo keeps changes reversible.',
    ],
  },
  {
    id: 'analyse',
    title: 'Analyse with Confidence',
    description:
      'Run (⌘/Ctrl+Enter) executes the influence model with reproducible seeds so you can compare p10/p50/p90 outcomes.',
    icon: <PlayCircle className="w-8 h-8 text-sky-600" aria-hidden="true" />,
    bullets: [
      'Runs respect engine health checks and honour the live limits before sending payloads.',
      'Results show p10 / p50 / p90 plus sensitivity so you can reason about upside/downside.',
      'Seed + response hash appear in the Debug Tray for reproducibility and sharing.',
    ],
  },
  {
    id: 'compare',
    title: 'Compare & Capture Rationale',
    description:
      'Save snapshots (Scenario A, Scenario B, etc.), compare them side-by-side, then capture the decision rationale for auditability.',
    icon: <GitCompare className="w-8 h-8 text-rose-600" aria-hidden="true" />,
    bullets: [
      'Top-5 edge diffs highlight the biggest causal changes between snapshots.',
      'Capture rationale directly in Compare view so reviewers see “why” next to the data.',
      'Promote the preferred snapshot to become the working scenario when you are ready.',
    ],
  },
  {
    id: 'share',
    title: 'Share & Export Safely',
    description:
      'Everything runs locally for single-user mode. Share links stay on your device unless you copy them out.',
    icon: <Share2 className="w-8 h-8 text-indigo-600" aria-hidden="true" />,
    bullets: [
      'Decision Brief export bundles scenarios, p10/p50/p90 deltas, rationale, and provenance metadata.',
      'Clipboard helpers redact sensitive snippets by default; toggle redaction per viewer.',
      'Use export/import flows to move work between environments without leaking secrets.',
    ],
  },
  {
    id: 'limits',
    title: 'Know Your Limits',
    description:
      'The toolbar shows a “Using live limits” chip so you always know how much headroom remains.',
    icon: <ShieldCheck className="w-8 h-8 text-teal-600" aria-hidden="true" />,
    bullets: [
      'Graph size: 50 nodes / 200 edges per run.',
      'Payload guard: 96 KB max body (client-side check before sending).',
      'Rate limit: 60 requests per minute — replays respect Retry-After headers automatically.',
    ],
  },
  {
    id: 'next',
    title: 'Next steps',
    description:
      'Need a refresher later? Use Help → Show onboarding. Keyboard shortcuts and the Influence model explainer live there too.',
    icon: <HelpCircle className="w-8 h-8 text-gray-700" aria-hidden="true" />,
    bullets: [
      'Keyboard legend (press ?): discover every shortcut without leaving the canvas.',
      'Influence explainer: understand why Olumi uses weight + belief instead of probability trees.',
      'Both panels are accessible, focus-managed, and safe to open mid-session.',
    ],
  },
]

interface OnboardingOverlayProps {
  onClose: () => void
  isOpen: boolean
  onShowKeyboardLegend?: () => void
  onShowInfluenceExplainer?: () => void
}

export function OnboardingOverlay({ onClose, isOpen, onShowKeyboardLegend, onShowInfluenceExplainer }: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Reset step whenever overlay re-opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
    }
  }, [isOpen])

  // Focus trap management
  useEffect(() => {
    if (!isOpen) return

    const focusableElements = overlayRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    if (!focusableElements || focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element on open
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isOpen, currentStep])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleClose = () => {
    // Mark as seen
    markOnboardingSeen()
    setCurrentStep(0)
    onClose()
  }

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    handleClose()
  }

  if (!isOpen) return null

  const step = ONBOARDING_STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1
  const totalSteps = ONBOARDING_STEPS.length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      ref={overlayRef}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 relative">
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
          aria-label="Close onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress indicator */}
        <div
          className="flex gap-2 mb-6"
          role="progressbar"
          aria-valuenow={((currentStep + 1) / totalSteps) * 100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Onboarding progress: Step ${currentStep + 1} of ${totalSteps}`}
        >
          {ONBOARDING_STEPS.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Content */}
        <div className="mb-8" aria-describedby="onboarding-step-description">
          <div className="flex items-center gap-4 mb-4">
            {step.icon}
            <div>
              <p className="text-sm font-semibold text-gray-500" aria-live="polite">
                Step {currentStep + 1} of {totalSteps}
              </p>
              <h2 id="onboarding-title" className="text-2xl font-bold text-gray-900">
                {step.title}
              </h2>
            </div>
          </div>
          <p id="onboarding-step-description" className="text-gray-700 text-lg leading-relaxed">
            {step.description}
          </p>

          <ul className="mt-4 space-y-3 text-gray-700">
            {step.bullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {step.id === 'next' && (onShowKeyboardLegend || onShowInfluenceExplainer) && (
            <div className="mt-6 flex flex-wrap gap-3" aria-label="Helpful links">
              {onShowKeyboardLegend && (
                <button
                  onClick={onShowKeyboardLegend}
                  className="px-4 py-2 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                >
                  Open keyboard shortcuts
                </button>
              )}
              {onShowInfluenceExplainer && (
                <button
                  onClick={onShowInfluenceExplainer}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:outline-none"
                >
                  View influence explainer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
              isFirstStep
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            aria-label="Previous step"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
              aria-label={isLastStep ? 'Finish onboarding' : 'Next step'}
            >
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Step counter (for screen readers) */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Step {currentStep + 1} of {totalSteps}: {step.title}
        </p>
      </div>
    </div>
  )
}
