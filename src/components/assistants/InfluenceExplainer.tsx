/**
 * S8-EXPLAIN: Influence Model Explainer
 * Explains the influence model (not probability) to users
 * Dismissible with localStorage persistence
 */

import { useState, useEffect } from 'react'
import { Info, X, ChevronDown, ChevronUp } from 'lucide-react'

const STORAGE_KEY = 'olumi_seen_influence_explainer'
const STORAGE_VERSION = 'v1'

interface InfluenceExplainerProps {
  /**
   * Force show the explainer (e.g., when user clicks "What does this mean?")
   */
  forceShow?: boolean
  /**
   * Called when user dismisses the explainer
   */
  onDismiss?: () => void
  /**
   * Whether to show in compact mode (just the summary)
   */
  compact?: boolean
}

export function InfluenceExplainer({ forceShow = false, onDismiss, compact = false }: InfluenceExplainerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  // Load dismissed state from localStorage
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen === STORAGE_VERSION) {
        setIsDismissed(true)
      }
    } catch (e) {
      console.warn('Failed to check influence explainer status:', e)
    }
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
    } catch (e) {
      console.warn('Failed to save influence explainer status:', e)
    }

    onDismiss?.()
  }

  // Don't show if dismissed and not forced
  if (isDismissed && !forceShow) {
    return null
  }

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"
      role="region"
      aria-label="Influence model explanation"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-blue-900">
              Understanding Influence Models
            </h3>
            <button
              onClick={handleDismiss}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors shrink-0"
              aria-label="Dismiss explanation"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary */}
          <div className="mt-2 text-sm text-blue-800 space-y-2">
            <p>
              Olumi uses <strong>influence models</strong>, not probability models. Here's what that means:
            </p>

            {!compact && (
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>Nodes</strong> represent factors, beliefs, or evidence in your decision
                </li>
                <li>
                  <strong>Edges</strong> represent causal influence (not correlation) between factors
                </li>
                <li>
                  <strong>Weights</strong> (-1 to +1) represent the strength and direction of influence
                </li>
              </ul>
            )}

            {compact && (
              <p className="text-xs">
                Nodes = factors, Edges = causal influence, Weights = strength (-1 to +1)
              </p>
            )}
          </div>

          {/* Expandable details */}
          {!compact && (
            <div className="mt-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium transition-colors"
                aria-expanded={isExpanded}
                aria-controls="influence-details"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Learn more
                  </>
                )}
              </button>

              {isExpanded && (
                <div
                  id="influence-details"
                  className="mt-3 text-xs text-blue-700 space-y-2 bg-white/50 rounded p-3 border border-blue-100"
                >
                  <div>
                    <strong className="text-blue-900">Positive influence (+):</strong> When the source
                    factor increases, the target factor tends to increase. Example: "More budget" →
                    "Better outcome" (weight: +0.8)
                  </div>
                  <div>
                    <strong className="text-blue-900">Negative influence (-):</strong> When the source
                    factor increases, the target factor tends to decrease. Example: "More risk" →
                    "Team confidence" (weight: -0.6)
                  </div>
                  <div>
                    <strong className="text-blue-900">Weight magnitude:</strong> Closer to 0 = weak
                    influence, closer to ±1 = strong influence. Values like ±0.2 are subtle, ±0.8 are
                    dominant.
                  </div>
                  <div>
                    <strong className="text-blue-900">Why not probability?</strong> Influence models
                    capture how factors affect each other, not just their likelihood. This is better
                    suited for reasoning about decisions where causal relationships matter.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage influence explainer visibility
 */
export function useInfluenceExplainer() {
  const [shouldShow, setShouldShow] = useState(false)
  const [isForceShown, setIsForceShown] = useState(false)

  // Check if user has seen the explainer
  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY)
      if (seen !== STORAGE_VERSION) {
        setShouldShow(true)
      }
    } catch (e) {
      console.warn('Failed to check influence explainer status:', e)
    }
  }, [])

  const show = () => {
    setIsForceShown(true)
  }

  const hide = () => {
    setIsForceShown(false)
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
    } catch (e) {
      console.warn('Failed to save influence explainer status:', e)
    }
  }

  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      setShouldShow(true)
    } catch (e) {
      console.warn('Failed to reset influence explainer:', e)
    }
  }

  return {
    shouldShow: shouldShow || isForceShown,
    forceShow: isForceShown,
    show,
    hide,
    reset,
  }
}
