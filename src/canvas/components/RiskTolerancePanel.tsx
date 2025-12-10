/**
 * RiskTolerancePanel - Risk tolerance selection with CEE integration
 *
 * Shows:
 * - CEE suggestion with Accept/Override pattern
 * - Quick preset buttons
 * - Active profile display
 * - Persists to localStorage
 */

import { useState, useCallback, useEffect, memo } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Settings2, Info } from 'lucide-react'
import { typography } from '../../styles/typography'
import { AcceptOverrideControl } from './AcceptOverrideControl'
import { RiskProfileBadge } from './RiskProfileBadge'
import { RiskProfileSelector } from './RiskProfileSelector'
import { useRiskToleranceSuggestion } from '../hooks/useRiskToleranceSuggestion'
import { RISK_PRESETS } from '../hooks/useRiskProfile'
import type { RiskProfile, RiskProfilePreset } from '../../adapters/plot/types'

const STORAGE_KEY = 'canvas.riskProfile.v1'

interface RiskTolerancePanelProps {
  /** Called when profile changes */
  onProfileChange?: (profile: RiskProfile | null) => void
  /** Decision context for better suggestions */
  context?: {
    decision_domain?: string
    time_horizon?: 'short' | 'medium' | 'long'
    stakes?: 'low' | 'medium' | 'high'
  }
  /** Start expanded (default: false) */
  defaultExpanded?: boolean
}

export const RiskTolerancePanel = memo(function RiskTolerancePanel({
  onProfileChange,
  context,
  defaultExpanded = false,
}: RiskTolerancePanelProps) {
  // Load initial profile from localStorage
  const [profile, setProfile] = useState<RiskProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showSelector, setShowSelector] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // Fetch CEE suggestion
  const {
    suggestion,
    loading: suggestionLoading,
    fetchSuggestion,
  } = useRiskToleranceSuggestion({
    context,
    autoFetch: !profile, // Only auto-fetch if no profile set
    currentProfile: profile,
  })

  // Persist profile changes to localStorage
  useEffect(() => {
    try {
      if (profile) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {}
  }, [profile])

  // Handle profile change
  const handleProfileChange = useCallback((newProfile: RiskProfile | null) => {
    setProfile(newProfile)
    setShowSelector(false)
    setSuggestionDismissed(true)
    onProfileChange?.(newProfile)
  }, [onProfileChange])

  // Handle accepting suggestion
  const handleAcceptSuggestion = useCallback(() => {
    if (suggestion?.profile) {
      handleProfileChange(suggestion.profile)
    }
  }, [suggestion, handleProfileChange])

  // Handle override (show selector)
  const handleOverride = useCallback(() => {
    setSuggestionDismissed(true)
    setShowSelector(true)
  }, [])

  // Handle selecting a clarification option
  const handleSelectOption = useCallback((preset: RiskProfilePreset) => {
    const config = RISK_PRESETS[preset]
    const newProfile: RiskProfile = {
      profile: preset,
      label: config.label,
      score: config.score,
      confidence: 'medium',
      reasoning: `Selected "${config.label}": ${config.description}`,
    }
    handleProfileChange(newProfile)
  }, [handleProfileChange])

  // Handle edit from badge
  const handleEdit = useCallback(() => {
    setIsExpanded(true)
    setShowSelector(true)
  }, [])

  // Clear profile
  const handleClear = useCallback(() => {
    handleProfileChange(null)
    setSuggestionDismissed(false)
    fetchSuggestion()
  }, [handleProfileChange, fetchSuggestion])

  // Determine if suggestion should be shown
  const showSuggestion = suggestion && !suggestionDismissed && !profile

  return (
    <div
      className="rounded-lg border border-sand-200 bg-white"
      data-testid="risk-tolerance-panel"
    >
      {/* Header - always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-sand-50 transition-colors rounded-t-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-ink-500" aria-hidden="true" />
          <span className={`${typography.label} text-ink-800`}>
            Risk Tolerance
          </span>
          {profile && (
            <span className="text-lg" aria-hidden="true">
              {RISK_PRESETS[profile.profile]?.icon || '🎯'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {profile && (
            <span className={`${typography.caption} text-ink-600`}>
              {profile.label}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-ink-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-ink-400" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-sand-100">
          {/* Info text */}
          <div className="flex items-start gap-2 pt-3">
            <Info className="w-4 h-4 text-ink-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className={`${typography.caption} text-ink-500`}>
              Your risk tolerance affects how results are weighted between conservative and optimistic scenarios.
            </p>
          </div>

          {/* CEE Suggestion */}
          {showSuggestion && !showSelector && (
            <div className="space-y-3">
              {suggestion.needs_clarification && suggestion.options ? (
                // Clarification mode - show options
                <div className="p-4 rounded-lg border border-sand-200 bg-sand-50">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`${typography.caption} px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium`}>
                          AI asks
                        </span>
                      </div>
                      <p className={`${typography.body} text-ink-800`}>
                        {suggestion.clarifying_question}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestion.options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelectOption(opt.value)}
                            className={`${typography.button} flex items-center gap-2 px-4 py-2 rounded-lg
                              border border-sand-300 bg-white text-ink-700
                              hover:bg-sand-50 hover:border-sand-400 transition-colors`}
                          >
                            <span>{RISK_PRESETS[opt.value].icon}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Standard suggestion with Accept/Override
                <AcceptOverrideControl
                  suggestedValue={suggestion.profile}
                  formatValue={(p) => `${RISK_PRESETS[p.profile].icon} ${p.label}`}
                  confidence={suggestion.confidence}
                  rationale={suggestion.rationale}
                  onAccept={handleAcceptSuggestion}
                  onOverride={handleOverride}
                  suggestionLabel="AI suggests"
                  testIdPrefix="risk-tolerance-suggestion"
                />
              )}
            </div>
          )}

          {/* Loading state */}
          {suggestionLoading && !suggestion && !profile && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-sand-50 border border-sand-200">
              <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" aria-hidden="true" />
              <span className={`${typography.caption} text-ink-500`}>
                Analyzing decision context...
              </span>
            </div>
          )}

          {/* Profile display / selector */}
          {showSelector ? (
            <div className="space-y-3">
              <RiskProfileSelector
                initialProfile={profile}
                context={context}
                onProfileChange={handleProfileChange}
              />
              {profile && (
                <button
                  type="button"
                  onClick={() => setShowSelector(false)}
                  className={`${typography.caption} text-ink-500 hover:text-ink-700 underline`}
                >
                  Cancel
                </button>
              )}
            </div>
          ) : profile ? (
            <div className="space-y-3">
              {/* Current profile display */}
              <div className="p-4 rounded-lg border border-sand-200 bg-paper-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{RISK_PRESETS[profile.profile]?.icon}</span>
                    <div>
                      <h4 className={`${typography.label} text-ink-800`}>
                        {profile.label}
                      </h4>
                      <p className={`${typography.caption} text-ink-500`}>
                        {profile.reasoning}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Score visualisation */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between">
                    <span className={`${typography.caption} text-ink-400`}>Cautious</span>
                    <span className={`${typography.caption} text-ink-400`}>Bold</span>
                  </div>
                  <div className="h-2 bg-sand-200 rounded-full relative">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-sky-500 rounded-full border-2 border-white shadow"
                      style={{
                        left: `${Math.max(0, Math.min(100, profile.score * 100))}%`,
                        marginLeft: '-8px',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSelector(true)}
                  className={`${typography.caption} text-sky-600 hover:text-sky-700 font-medium`}
                >
                  Change
                </button>
                <span className="text-ink-300">·</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className={`${typography.caption} text-ink-500 hover:text-ink-700`}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : !showSuggestion && !suggestionLoading ? (
            // No profile, no suggestion - show quick presets
            <div className="space-y-3">
              <p className={`${typography.caption} text-ink-500`}>
                Select your risk tolerance:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['risk_averse', 'neutral', 'risk_seeking'] as RiskProfilePreset[]).map((preset) => {
                  const config = RISK_PRESETS[preset]
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectOption(preset)}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg border border-sand-300
                        bg-white text-ink-700 hover:bg-sand-50 hover:border-sand-400 transition-colors"
                    >
                      <span className="text-2xl">{config.icon}</span>
                      <span className={`${typography.caption} font-medium text-center`}>
                        {config.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
})

/**
 * Hook to get the current risk profile from localStorage
 */
export function useStoredRiskProfile(): RiskProfile | null {
  const [profile, setProfile] = useState<RiskProfile | null>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      setProfile(stored ? JSON.parse(stored) : null)
    } catch {
      setProfile(null)
    }

    // Listen for changes from other components
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          setProfile(e.newValue ? JSON.parse(e.newValue) : null)
        } catch {
          setProfile(null)
        }
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return profile
}
