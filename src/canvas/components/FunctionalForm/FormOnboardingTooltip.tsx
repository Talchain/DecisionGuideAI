/**
 * FormOnboardingTooltip - First-time user onboarding
 *
 * Brief 11.8: Contextual onboarding tooltip explaining functional forms
 * Shows once per user, can be dismissed permanently.
 */

import { memo, useState, useEffect, useCallback } from 'react'
import { X, Info, ArrowRight } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { FORM_DISPLAY_NAMES, type EdgeFunctionType } from '../../domain/edges'
import type { FormOnboardingTooltipProps, FormOnboardingState } from './types'

// Local storage key for onboarding state
const ONBOARDING_KEY = 'canvas.formOnboarding.v1'

/**
 * Hook to manage onboarding state
 */
export function useFormOnboarding(): {
  show: boolean
  dismiss: () => void
  reset: () => void
} {
  const [state, setState] = useState<FormOnboardingState>(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_KEY)
      return stored ? JSON.parse(stored) : { hasSeenOnboarding: false }
    } catch {
      return { hasSeenOnboarding: false }
    }
  })

  const dismiss = useCallback(() => {
    const newState: FormOnboardingState = {
      hasSeenOnboarding: true,
      dismissedAt: Date.now(),
    }
    setState(newState)
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const reset = useCallback(() => {
    const newState: FormOnboardingState = { hasSeenOnboarding: false }
    setState(newState)
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState))
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  return {
    show: !state.hasSeenOnboarding,
    dismiss,
    reset,
  }
}

/**
 * Example form card for onboarding
 */
const FormExample = memo(function FormExample({
  form,
  example,
}: {
  form: EdgeFunctionType
  example: string
}) {
  const info = FORM_DISPLAY_NAMES[form]

  return (
    <div className="flex items-start gap-2">
      <span className="text-lg font-mono text-teal-600" aria-hidden="true">
        {info?.icon || '─'}
      </span>
      <div>
        <p className={`${typography.caption} font-medium text-ink-700`}>
          {info?.name || form}
        </p>
        <p className={`${typography.caption} text-ink-500`}>{example}</p>
      </div>
    </div>
  )
})

/**
 * FormOnboardingTooltip - Dismissible onboarding tooltip
 */
export const FormOnboardingTooltip = memo(function FormOnboardingTooltip({
  onDismiss,
  show,
}: FormOnboardingTooltipProps) {
  // Don't render if not shown
  if (!show) {
    return null
  }

  return (
    <div
      data-testid="form-onboarding-tooltip"
      className="fixed bottom-6 right-6 w-80 bg-white rounded-xl border border-sand-200 shadow-xl z-50"
      role="dialog"
      aria-label="Understanding relationship forms"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sand-100">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-teal-600" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-700`}>
            Relationship Forms
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded hover:bg-sand-100 text-ink-400 hover:text-ink-600 transition-colors"
          aria-label="Dismiss onboarding"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className={`${typography.caption} text-ink-600 mb-4`}>
          Relationships between nodes can have different patterns. The AI suggests
          forms based on context, but you can adjust them manually.
        </p>

        {/* Examples */}
        <div className="space-y-3 mb-4">
          <FormExample
            form="diminishing_returns"
            example="More marketing spend has less impact over time"
          />
          <FormExample
            form="threshold"
            example="Must reach minimum quality to pass compliance"
          />
          <FormExample
            form="s_curve"
            example="Market adoption starts slow, then accelerates"
          />
        </div>

        {/* Tip */}
        <div className="flex items-start gap-2 p-2.5 bg-sand-50 rounded-lg">
          <ArrowRight className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className={`${typography.caption} text-ink-600`}>
            <strong>Tip:</strong> Click on any edge and use the inspector panel to
            change its relationship form.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end p-3 bg-sand-50 rounded-b-xl border-t border-sand-100">
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
})

export default FormOnboardingTooltip
