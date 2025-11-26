/**
 * S8-EXPLAIN: Influence Model Explainer
 * Explains the influence model (not probability) to users
 * Dismissible with localStorage persistence
 */

import { useState, useEffect } from 'react'
import { Info, X, ChevronDown, ChevronUp } from 'lucide-react'
import { typography } from '../../styles/typography'

const STORAGE_KEY = 'olumi_seen_influence_explainer'
const STORAGE_VERSION = 'v1'

function getSafeLocalStorage(): Storage | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as any).localStorage as Storage
  }
  return null
}

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
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const storage = getSafeLocalStorage()
      if (storage) {
        const seen = storage.getItem(STORAGE_KEY)
        if (seen === STORAGE_VERSION && !forceShow) {
          return true
        }
      }
    } catch (e) {
      console['warn']('Failed to check influence explainer status:', e)
    }

    return false
  })
  const [isExpanded, setIsExpanded] = useState(false)

  const handleDismiss = () => {
    setIsDismissed(true)

    // Save to localStorage
    try {
      const storage = getSafeLocalStorage()
      if (storage) {
        storage.setItem(STORAGE_KEY, STORAGE_VERSION)
      }
    } catch (e) {
      console['warn']('Failed to save influence explainer status:', e)
    }

    onDismiss?.()
  }

  if (isDismissed) {
    return null
  }

  return (
    <div
      className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-3"
      role="region"
      aria-label="Influence model explanation"
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`${typography.label} text-sky-900`}>
              Understanding Influence Models
            </h3>
            <button
              onClick={handleDismiss}
              className="p-0.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition-colors shrink-0"
              aria-label="Dismiss explanation"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Summary */}
          <div className={`mt-1.5 ${typography.caption} text-sky-800 space-y-1.5`}>
            <p>
              Olumi uses influence models, not probability models.
            </p>

            {!compact && (
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Nodes = factors in your decision</li>
                <li>Edges = causal influence between factors</li>
                <li>Weights (-1 to +1) = strength and direction</li>
              </ul>
            )}

            {compact && (
              <p className={typography.code}>
                Nodes = factors, Edges = causal influence, Weights = strength (-1 to +1)
              </p>
            )}
          </div>

          {/* Expandable details */}
          {!compact && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1 ${typography.code} text-sky-700 hover:text-sky-900 font-medium transition-colors`}
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
                  className={`mt-2 ${typography.code} text-sky-700 space-y-1.5 bg-white/50 rounded p-2 border border-sky-100`}
                >
                  <div>
                    <strong className="text-sky-900">Positive (+):</strong> Source ↑ → Target ↑ (e.g., Budget → Outcome: +0.8)
                  </div>
                  <div>
                    <strong className="text-sky-900">Negative (-):</strong> Source ↑ → Target ↓ (e.g., Risk → Confidence: -0.6)
                  </div>
                  <div>
                    <strong className="text-sky-900">Magnitude:</strong> Near 0 = weak, near ±1 = strong
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
 *
 * Note: Auto-show on startup is disabled. Users can access the explainer
 * via the Help menu (?) button. This keeps the startup experience clean.
 */
export function useInfluenceExplainer() {
  // Disabled auto-show: start with shouldShow=false, only show when explicitly requested
  const [shouldShow, setShouldShow] = useState(false)
  const [isForceShown, setIsForceShown] = useState(false)

  // Auto-show on startup is DISABLED - the explainer is available via Help menu
  // To re-enable, uncomment the useEffect below:
  // useEffect(() => {
  //   try {
  //     const storage = getSafeLocalStorage()
  //     if (storage) {
  //       const seen = storage.getItem(STORAGE_KEY)
  //       if (seen !== STORAGE_VERSION) {
  //         setShouldShow(true)
  //       }
  //     }
  //   } catch (e) {
  //     console['warn']('Failed to check influence explainer status:', e)
  //   }
  // }, [])

  const show = () => {
    setIsForceShown(true)
  }

  const hide = () => {
    setShouldShow(false)
    setIsForceShown(false)
    try {
      const storage = getSafeLocalStorage()
      if (storage) {
        storage.setItem(STORAGE_KEY, STORAGE_VERSION)
      }
    } catch (e) {
      console['warn']('Failed to save influence explainer status:', e)
    }
  }

  const reset = () => {
    try {
      const storage = getSafeLocalStorage()
      if (storage) {
        storage.removeItem(STORAGE_KEY)
      }
      setShouldShow(true)
      setIsForceShown(false)
    } catch (e) {
      console['warn']('Failed to reset influence explainer:', e)
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
